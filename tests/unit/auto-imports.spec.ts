// @vitest-environment node

/**
 * Guards `src/**` against the unimport scope leak that nuxt 4.5 exposed.
 *
 * Nuxt 4.5's imports module passes `parser: 'oxc'` to `createUnimport`, which swaps the old
 * regex scanner for unimport's estree scope walker. On `BlockStatement` that walker adds the
 * owning function's plain-identifier params to `scopeCurrent.declarations` BEFORE it calls
 * `pushScope(node)`, so a param named `ref` registers as a binding of the scope AROUND the
 * function. Every sibling `ref(...)` then looks already-declared, no `import { ref } from
 * 'vue'` is injected, and the module throws `ReferenceError: ref is not defined` the instant
 * it loads. The same transform runs the production build, so this is a real crash and not a
 * test-only artifact (it hit sky on exactly one name in one file).
 *
 * Rather than pattern-match the shape, `shadowedAutoImports` resolves every read twice - once
 * under correct scoping and once with the leak - and reports the reads that only resolve
 * because of the leak. On top of that the reactivity core may not be bound at all, since those
 * are the names a module is most likely to start calling after the fact.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { babelParse, parse } from 'vue/compiler-sfc';

const PROJECT_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const SRC = join(PROJECT_ROOT, 'src');
const NUXT_DIR = join(PROJECT_ROOT, '.nuxt');

const RESERVED = new Set([
	'computed',
	'h',
	'nextTick',
	'reactive',
	'ref',
	'shallowReactive',
	'shallowRef',
	'toRef',
	'toRefs',
	'toValue',
	'unref',
	'useRoute',
	'useRouter',
	'useState',
	'watch',
	'watchEffect'
]);

// #region auto-import universe

/** every name nuxt injects, read off the generated declarations rather than a hand list */
function autoImportUniverse(): Set<string> {
	const names = new Set<string>();

	// re-exports of vue + `#app` + module-contributed composables
	const reExports = readFileSync(join(NUXT_DIR, 'imports.d.ts'), 'utf8');
	for (const match of reExports.matchAll(/export \{([^}]*)\}/g))
		for (const entry of (match[1] ?? '').split(','))
			names.add(
				entry
					.trim()
					.split(/\s+as\s+/)
					.pop()
					?.trim() ?? ''
			);

	// crust's own `composables/`, `shared/utils/` and `shared/types/` exports
	const globals = readFileSync(join(NUXT_DIR, 'types/imports.d.ts'), 'utf8');
	for (const match of globals.matchAll(/^\s*const (\w+):/gm)) names.add(match[1] ?? '');

	names.delete('');
	return names;
}

// #endregion

// #region scope model

type Node = {
	type?: string;
	loc?: { start: { line: number } };
	[key: string]: unknown;
};

// babel splits out the method nodes estree models as a plain FunctionExpression, so unimport
// leaks their params too
const PARAM_OWNERS = new Set([
	'ArrowFunctionExpression',
	'ClassMethod',
	'ClassPrivateMethod',
	'FunctionDeclaration',
	'FunctionExpression',
	'ObjectMethod'
]);

type Scope = {
	parent: Scope | null;
	/** bindings real javascript scoping puts here */
	declared: Set<string>;
	/** params unimport misfiles here instead of inside the function */
	leaked: Set<string>;
};

type Finding = { name: string; line: number; reason: 'strands a read' | 'reserved name' };

function childScope(parent: Scope): Scope {
	return { parent, declared: new Set(), leaked: new Set() };
}

function resolvable(scope: Scope, name: string, withLeak: boolean): boolean {
	for (let current: Scope | null = scope; current; current = current.parent)
		if (current.declared.has(name) || (withLeak && current.leaked.has(name))) return true;
	return false;
}

/** identifier nodes a pattern binds; a default value on the right stays a read */
function bindingIdentifiers(pattern: unknown, out: Node[] = []): Node[] {
	if (!pattern || typeof pattern !== 'object') return out;
	const node = pattern as Node;
	switch (node.type) {
		case 'Identifier':
			out.push(node);
			return out;
		case 'AssignmentPattern':
			return bindingIdentifiers(node.left, out);
		case 'RestElement':
			return bindingIdentifiers(node.argument, out);
		case 'TSParameterProperty':
			return bindingIdentifiers(node.parameter, out);
		case 'ObjectPattern':
			for (const property of (node.properties as Node[]) ?? [])
				bindingIdentifiers(property.value ?? property.argument, out);
			return out;
		case 'ArrayPattern':
			for (const element of (node.elements as Node[]) ?? []) bindingIdentifiers(element, out);
			return out;
	}
	return out;
}

/**
 * Auto-imported names a module binds in a way nuxt's transform cannot survive.
 *
 * @param autoImported every name nuxt would inject
 * @param reserved subset that may never be bound at all
 */
export function shadowedAutoImports(
	source: string,
	autoImported: Set<string>,
	reserved: Set<string> = RESERVED
): Finding[] {
	const ast = babelParse(source, { sourceType: 'module', plugins: ['typescript'] });
	const moduleScope: Scope = { parent: null, declared: new Set(), leaked: new Set() };
	const reads: { name: string; scope: Scope }[] = [];
	const leakLines = new Map<string, number>();
	const boundLines = new Map<string, number>();
	const notRead = new Set<object>();

	const line = (node: Node | undefined): number => node?.loc?.start.line ?? 0;
	const bind = (pattern: unknown, scope: Scope): Node[] => {
		const identifiers = bindingIdentifiers(pattern);
		for (const identifier of identifiers) {
			notRead.add(identifier);
			scope.declared.add(identifier.name as string);
		}
		return identifiers;
	};

	const visit = (value: unknown, scope: Scope): void => {
		if (!value || typeof value !== 'object') return;
		if (Array.isArray(value)) {
			for (const entry of value) visit(entry, scope);
			return;
		}
		const node = value as Node;
		if (typeof node.type !== 'string') return;
		// types are stripped before unimport runs, so nothing inside them can shadow
		if (node.type.startsWith('TS') && node.type !== 'TSParameterProperty') return;

		let inner = scope;
		switch (node.type) {
			case 'ImportDeclaration':
				for (const specifier of (node.specifiers as Node[]) ?? []) bind(specifier.local, scope);
				return;
			case 'ExportSpecifier':
				notRead.add(node.exported as object);
				break;
			case 'VariableDeclarator':
				bind(node.id, scope);
				break;
			case 'ClassDeclaration':
			case 'FunctionDeclaration':
				if (node.id) bind(node.id, scope);
				break;
			case 'BlockStatement':
			case 'CatchClause':
			case 'ForInStatement':
			case 'ForOfStatement':
			case 'ForStatement':
				inner = childScope(scope);
				break;
			case 'MemberExpression':
			case 'OptionalMemberExpression':
				if (!node.computed) notRead.add(node.property as object);
				break;
			case 'ClassMethod':
			case 'ClassProperty':
			case 'ObjectMethod':
			case 'ObjectProperty':
				if (!node.computed && !node.shorthand) notRead.add(node.key as object);
				break;
			case 'BreakStatement':
			case 'ContinueStatement':
			case 'LabeledStatement':
				if (node.label) notRead.add(node.label as object);
				break;
		}

		if (PARAM_OWNERS.has(node.type)) {
			inner = childScope(scope);
			// unimport only lifts plain identifiers, and only for a block body
			const leaks = (node.body as Node | undefined)?.type === 'BlockStatement';
			for (const param of (node.params as unknown[]) ?? [])
				for (const identifier of bind(param, inner)) {
					const name = identifier.name as string;
					if (!boundLines.has(name)) boundLines.set(name, line(identifier));
					if (!leaks || (param as Node).type !== 'Identifier') continue;
					scope.leaked.add(name);
					if (!leakLines.has(name)) leakLines.set(name, line(identifier));
				}
		}

		if (node.type === 'CatchClause') {
			for (const identifier of bind(node.param, inner))
				if (!boundLines.has(identifier.name as string))
					boundLines.set(identifier.name as string, line(identifier));
		}

		if (node.type === 'Identifier' && !notRead.has(node))
			reads.push({ name: node.name as string, scope });

		for (const [key, child] of Object.entries(node)) {
			if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue;
			if (child && typeof child === 'object') visit(child, inner);
		}
	};

	visit(ast.program, moduleScope);

	const findings: Finding[] = [];
	const stranded = new Set<string>();
	for (const read of reads) {
		if (!autoImported.has(read.name) || stranded.has(read.name)) continue;
		// nuxt would inject this read, but the leaked param convinces unimport it is declared
		if (resolvable(read.scope, read.name, false)) continue;
		if (!resolvable(read.scope, read.name, true)) continue;
		stranded.add(read.name);
		findings.push({
			name: read.name,
			line: leakLines.get(read.name) ?? 0,
			reason: 'strands a read'
		});
	}
	for (const [name, at] of boundLines)
		if (reserved.has(name) && autoImported.has(name) && !moduleScope.declared.has(name))
			findings.push({ name, line: at, reason: 'reserved name' });

	return findings.sort(
		(a, b) => a.name.localeCompare(b.name) || a.reason.localeCompare(b.reason) || a.line - b.line
	);
}

// #endregion

// #region source scan

function sourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...sourceFiles(full));
		else if (entry.name.endsWith('.ts') || entry.name.endsWith('.vue')) out.push(full);
	}
	return out.sort();
}

/** every script block nuxt runs the imports transform over, with the line it starts on */
function scriptBlocks(file: string): { content: string; lineOffset: number }[] {
	const source = readFileSync(file, 'utf8');
	if (file.endsWith('.ts')) return [{ content: source, lineOffset: 0 }];
	const { descriptor } = parse(source);
	return [descriptor.script, descriptor.scriptSetup]
		.filter((block): block is NonNullable<typeof block> => !!block)
		.map((block) => ({
			content: block.content,
			lineOffset: source.slice(0, block.loc.start.offset).split('\n').length - 1
		}));
}

// #endregion

const AUTO_IMPORTED = autoImportUniverse();

describe('autoImportUniverse', () => {
	it('reads the generated declarations, not a hand-maintained list', () => {
		expect(AUTO_IMPORTED.size).toBeGreaterThan(500);
	});

	it('covers vue reactivity, nuxt app composables and crust helpers alike', () => {
		for (const name of ['ref', 'computed', 'watch', 'h', 'useState', 'useRoute', 'toTitleCase'])
			expect(AUTO_IMPORTED.has(name), name).toBe(true);
	});

	it('holds every reserved name so the reserved rule can never go dark', () => {
		for (const name of RESERVED) expect(AUTO_IMPORTED.has(name), name).toBe(true);
	});
});

describe('shadowedAutoImports', () => {
	const universe = new Set(['ref', 'watch', 'navigateTo', 'useEvents']);
	const report = (source: string) =>
		shadowedAutoImports(source, universe).map((finding) => `${finding.name} ${finding.reason}`);

	it('flags the exact shape that crashed sky', () => {
		const source = [
			'export function distanceStorageKey(ref: { questId: string }): string {',
			'	return ref.questId;',
			'}',
			'const granted = ref<boolean | null>(null);',
			'export { granted };'
		].join('\n');
		expect(report(source)).toEqual(['ref reserved name', 'ref strands a read']);
	});

	it('accepts the same module once the param is renamed', () => {
		const source = [
			'export function distanceStorageKey(stepRef: { questId: string }): string {',
			'	return stepRef.questId;',
			'}',
			'const granted = ref<boolean | null>(null);',
			'export { granted };'
		].join('\n');
		expect(report(source)).toEqual([]);
	});

	it('accepts a leak the module neutralised with an explicit import', () => {
		const source = [
			"import { ref } from 'vue';",
			'export function distanceStorageKey(ref: { questId: string }): string {',
			'	return ref.questId;',
			'}',
			'const granted = ref(null);',
			'export { granted };'
		].join('\n');
		expect(report(source)).toEqual([]);
	});

	it('flags a leaked non-reserved name only once a sibling reads it', () => {
		const bound = 'export function open(navigateTo: string) {\n	return navigateTo;\n}';
		expect(report(bound)).toEqual([]);
		expect(report(`${bound}\nexport const go = () => navigateTo('/');`)).toEqual([
			'navigateTo strands a read'
		]);
	});

	it('leaves a param that only shadows itself alone', () => {
		const source = [
			'export function first(navigateTo: string) {',
			'	return navigateTo.trim();',
			'}',
			'export function second(navigateTo: string) {',
			'	return navigateTo.length;',
			'}'
		].join('\n');
		expect(report(source)).toEqual([]);
	});

	it('resolves a read against its own block-local declaration', () => {
		const source = [
			'export function build(navigateTo: number) {',
			'	return navigateTo * 2;',
			'}',
			'export function draw(scale: number) {',
			'	const navigateTo = scale * 4;',
			'	return navigateTo + 1;',
			'}'
		].join('\n');
		expect(report(source)).toEqual([]);
	});

	it('does not leak a destructured or defaulted param (unimport only lifts identifiers)', () => {
		const source = [
			'export function read({ navigateTo }: { navigateTo: boolean }) {',
			'	return navigateTo;',
			'}',
			'export const go = () => navigateTo("/");'
		].join('\n');
		expect(report(source)).toEqual([]);
	});

	it('does not leak a concise arrow param either (no block, no scope push)', () => {
		const source = [
			'export const pick = (rows: { navigateTo: string }[]) =>',
			'	rows.find((navigateTo) => !!navigateTo);',
			'export const go = () => navigateTo("/");'
		].join('\n');
		expect(report(source)).toEqual([]);
	});

	it('still flags a destructured reserved name', () => {
		const source = 'export function read({ watch }: { watch: boolean }) {\n	return watch;\n}';
		expect(report(source)).toEqual(['watch reserved name']);
	});

	it('ignores a name that only appears as a type-level param', () => {
		const source = [
			'type Factory = (navigateTo: string) => string;',
			'export const make: Factory = (value) => value;',
			'export const go = () => navigateTo("/");'
		].join('\n');
		expect(report(source)).toEqual([]);
	});

	it('reads a property key as a key, not as a stranded read', () => {
		const source = [
			'export function build(useEvents: string) {',
			'	return useEvents;',
			'}',
			'export const shape = { useEvents: 1, nested: ({ a: 1 } as never).useEvents };'
		].join('\n');
		expect(report(source)).toEqual([]);
	});

	it('flags a catch binding of a reserved name', () => {
		const source = [
			'export function run() {',
			'	try {',
			'		JSON.parse("");',
			'	} catch (watch) {',
			'		return watch;',
			'	}',
			'}'
		].join('\n');
		expect(report(source)).toEqual(['watch reserved name']);
	});
});

describe('src never shadows an auto-import', () => {
	const files = sourceFiles(SRC);

	it('scans every source module', () => {
		expect(files.length).toBeGreaterThan(300);
	});

	it('finds no module that binds an auto-imported name it relies on', () => {
		const offenders = files.flatMap((file) =>
			scriptBlocks(file).flatMap((block) =>
				shadowedAutoImports(block.content, AUTO_IMPORTED).map(
					(finding) =>
						`${relative(PROJECT_ROOT, file)}:${finding.line + block.lineOffset} ${finding.name} (${finding.reason})`
				)
			)
		);
		expect(offenders).toEqual([]);
	});
});
