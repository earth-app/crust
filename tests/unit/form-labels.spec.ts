// @vitest-environment node

/**
 * Guards the `UFormField` label association across `src/**`.
 *
 * `UFormField` renders `<label :for="id">` and hands that generated id to its child
 * through `provide(inputIdInjectionKey)`. Only Nuxt UI inputs read that injection (via
 * `useFormField`), so a RAW `<input>` / `<select>` / `<textarea>` inside a labelled
 * `UFormField` never receives the id: the `for` points at nothing and the control ships
 * with no accessible name at all. Those controls need an explicit `aria-label`.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const SRC = join(PROJECT_ROOT, 'src');

const RAW_CONTROL = /^<(input|select|textarea)(?![a-zA-Z-])/;
// leading boundary keeps `aria-label` from reading as the field's own `label`
const FIELD_LABEL = /(?:^|\s):?label="([^"]*)"/;
const HAS_ARIA_LABEL = /(?:^|\s):?aria-label="/;

function vueFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...vueFiles(full));
		else if (entry.name.endsWith('.vue')) out.push(full);
	}
	return out;
}

// collects a (possibly multi-line) opening tag starting at `start`
function readTag(lines: string[], start: number): { text: string; end: number } {
	let text = lines[start]!.trim();
	let end = start;
	while (end < lines.length - 1 && !/>$/.test(text)) {
		end++;
		text += ' ' + lines[end]!.trim();
	}
	return { text, end };
}

function orphanedControls(): string[] {
	const offenders: string[] = [];

	for (const file of vueFiles(SRC)) {
		const relative = file.slice(PROJECT_ROOT.length + 1);
		const lines = readFileSync(file, 'utf-8').split('\n');
		// one entry per open UFormField; the innermost one owns the injected id
		const stack: { label: string }[] = [];

		for (let i = 0; i < lines.length; i++) {
			const trimmed = lines[i]!.trim();

			if (trimmed.startsWith('</UFormField')) {
				stack.pop();
				continue;
			}

			if (trimmed.startsWith('<UFormField')) {
				const { text, end } = readTag(lines, i);
				i = end;
				if (text.endsWith('/>')) continue;
				stack.push({ label: FIELD_LABEL.exec(text)?.[1] ?? '' });
				continue;
			}

			const field = stack.at(-1);
			if (!field?.label || !RAW_CONTROL.test(trimmed)) continue;

			const { text, end } = readTag(lines, i);
			const at = i + 1;
			i = end;
			if (HAS_ARIA_LABEL.test(text)) continue;
			offenders.push(
				`${relative}:${at} <${RAW_CONTROL.exec(trimmed)![1]}> in UFormField "${field.label}"`
			);
		}
	}

	return offenders;
}

describe('UFormField label association', () => {
	it('gives every raw form control inside a labelled UFormField an explicit aria-label', () => {
		expect(orphanedControls()).toEqual([]);
	});
});
