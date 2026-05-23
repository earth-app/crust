/**
 * V8 → Istanbul coverage collection.
 *
 * Playwright's chromium fixture exposes raw V8 coverage from CDP. We convert
 * each script's V8 coverage to Istanbul (`coverage-final.json`-style) buckets
 * via the `v8-to-istanbul` package and stream them to `.coverage/raw/{testId}.json`.
 *
 * After the run completes a separate `merge-coverage` script reads every file
 * in `.coverage/raw/`, merges them, and emits:
 *   - coverage/lcov.info       (codecov + GitHub action consumers)
 *   - coverage/coverage-final.json (full istanbul detail)
 *   - coverage/coverage-summary.json (CLI-friendly summary)
 *
 * Coverage only meaningfully covers browser-shipped JS — Nuxt SSR runs in a
 * separate Node process which we do not instrument here. For SSR coverage,
 * the integration workflow (e2e.yml) collects c8 coverage of the Nitro server.
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const RAW_DIR = resolve(PROJECT_ROOT, '.coverage', 'raw');
const OUT_DIR = resolve(PROJECT_ROOT, 'coverage');
const CHUNK_DIR = resolve(PROJECT_ROOT, '.output/public/_nuxt');

// After sourcemap remap, keep only app source files (not vendor/runtime).
const KEEP_PREFIXES = [
	'src/',
	'/src/',
	'pages/',
	'components/',
	'composables/',
	'stores/',
	'shared/'
];

// First-pass URL filter: drop only the things we KNOW are not app code.
// We intentionally keep `/_nuxt/{hash}.js` chunks — these compile from src/
// and after sourcemap remap will surface as `src/pages/foo.vue` etc. The
// post-merge KEEP_PREFIXES filter trims any vendor chunks that remap to
// `node_modules/`.
function isCandidateUrl(url: string): boolean {
	if (!url) return false;
	if (url.includes('node_modules')) return false;
	if (url.startsWith('data:')) return false;
	if (url.startsWith('chrome-extension:')) return false;
	if (url.includes('hot-update')) return false;
	if (url.includes('/_nuxt/builds/')) return false;
	// Only chunks served from the dev/prod server matter — skip cross-origin
	// scripts (which would have been blocked by our route handler anyway).
	return url.startsWith('http://127.0.0.1:3000/') || url.includes('/_nuxt/');
}

function isAppSourcePath(filePath: string): boolean {
	if (!filePath) return false;
	if (filePath.includes('node_modules')) return false;
	return KEEP_PREFIXES.some((p) => filePath.includes(p));
}

export async function saveCoverageForTest(
	testId: string,
	entries: Array<{ url: string; source?: string; functions: any[] }>
) {
	if (!entries.length) return;
	const filtered = entries.filter((e) => e.source && isCandidateUrl(e.url));
	if (!filtered.length) return;
	if (!existsSync(RAW_DIR)) await mkdir(RAW_DIR, { recursive: true });
	await writeFile(resolve(RAW_DIR, `${testId}.json`), JSON.stringify(filtered), 'utf8');
}

interface V8Entry {
	url: string;
	source: string;
	functions: any[];
}

/**
 * Merge all raw V8 coverage files into istanbul format and emit lcov.
 * Called by `bun run test:coverage:report` after a test run completes.
 */
export async function mergeAndReport(): Promise<void> {
	if (!existsSync(RAW_DIR)) {
		console.log('[coverage] no raw coverage to report');
		return;
	}
	const files = (await readdir(RAW_DIR)).filter((f) => f.endsWith('.json'));
	if (!files.length) {
		console.log('[coverage] no raw coverage files found');
		return;
	}

	const v8ToIstanbulMod = await import(
		pathToFileURL(resolve(PROJECT_ROOT, 'node_modules/v8-to-istanbul/index.js')).href
	).catch(() => import('v8-to-istanbul'));
	const v8toIstanbul = (v8ToIstanbulMod as any).default ?? (v8ToIstanbulMod as any);

	const merged: Record<string, any> = {};

	for (const file of files) {
		const raw = JSON.parse(await readFile(resolve(RAW_DIR, file), 'utf8')) as V8Entry[];
		for (const entry of raw) {
			try {
				// Map the served URL (`http://127.0.0.1:3000/_nuxt/abc.js`) to
				// the on-disk chunk path so v8-to-istanbul can read the
				// adjacent `.js.map` and remap coverage onto `src/*` paths.
				// SSR/HTML entries (no `/_nuxt/` segment) have no sourcemap
				// to follow — convert them in source-only mode.
				const chunkMatch = entry.url.match(/\/_nuxt\/([^/?#]+\.js)(?:[?#]|$)/);
				const chunkName = chunkMatch?.[1];
				const scriptPath = chunkName ? resolve(CHUNK_DIR, chunkName) : '';
				const converter = v8toIstanbul(scriptPath, 0, { source: entry.source });
				await converter.load();
				converter.applyCoverage(entry.functions);
				const istanbul = converter.toIstanbul();
				for (const [filePath, fileCov] of Object.entries(istanbul)) {
					if (!isAppSourcePath(filePath)) continue;
					if (!merged[filePath]) {
						merged[filePath] = fileCov;
					} else {
						mergeFileCoverage(merged[filePath], fileCov as any);
					}
				}
				converter.destroy();
			} catch (err) {
				console.warn(`[coverage] failed to convert ${entry.url}:`, (err as Error).message);
			}
		}
	}

	if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });

	await writeFile(resolve(OUT_DIR, 'coverage-final.json'), JSON.stringify(merged, null, 2));

	// lcov
	const lcov = toLcov(merged);
	await writeFile(resolve(OUT_DIR, 'lcov.info'), lcov);

	// summary
	const summary = toSummary(merged);
	await writeFile(resolve(OUT_DIR, 'coverage-summary.json'), JSON.stringify(summary, null, 2));

	const total = summary.total;
	console.log(`[coverage] reports written to ${OUT_DIR}/`);
	console.log(
		`[coverage] statements: ${total.statements.pct}%  branches: ${total.branches.pct}%  ` +
			`functions: ${total.functions.pct}%  lines: ${total.lines.pct}%`
	);
}

function mergeFileCoverage(target: any, src: any) {
	for (const [k, v] of Object.entries(src.s as Record<string, number>)) {
		target.s[k] = (target.s[k] ?? 0) + (v as number);
	}
	for (const [k, v] of Object.entries(src.f as Record<string, number>)) {
		target.f[k] = (target.f[k] ?? 0) + (v as number);
	}
	for (const [k, v] of Object.entries(src.b as Record<string, number[]>)) {
		const existing = target.b[k] as number[] | undefined;
		target.b[k] = existing
			? existing.map((n, i) => n + ((v as number[])[i] ?? 0))
			: [...(v as number[])];
	}
}

function toLcov(merged: Record<string, any>): string {
	let out = '';
	for (const [filePath, cov] of Object.entries(merged)) {
		out += `TN:\nSF:${filePath}\n`;
		const fnEntries = Object.entries(cov.fnMap as Record<string, any>);
		for (const [, fn] of fnEntries) {
			out += `FN:${fn.decl.start.line},${fn.name || '(anonymous)'}\n`;
		}
		let fnHit = 0;
		for (const [id, count] of Object.entries(cov.f as Record<string, number>)) {
			const fn = cov.fnMap[id];
			if (!fn) continue;
			out += `FNDA:${count},${fn.name || '(anonymous)'}\n`;
			if ((count as number) > 0) fnHit++;
		}
		out += `FNF:${Object.keys(cov.f).length}\nFNH:${fnHit}\n`;

		const lineCounts: Record<number, number> = {};
		for (const [id, count] of Object.entries(cov.s as Record<string, number>)) {
			const stmt = cov.statementMap[id];
			if (!stmt) continue;
			const line = stmt.start.line;
			lineCounts[line] = (lineCounts[line] ?? 0) + (count as number);
		}
		let lineHit = 0;
		for (const [line, count] of Object.entries(lineCounts)) {
			out += `DA:${line},${count}\n`;
			if ((count as number) > 0) lineHit++;
		}
		out += `LF:${Object.keys(lineCounts).length}\nLH:${lineHit}\n`;

		let branchHit = 0;
		let branchTotal = 0;
		for (const [id, counts] of Object.entries(cov.b as Record<string, number[]>)) {
			const branch = cov.branchMap[id];
			if (!branch) continue;
			for (let i = 0; i < (counts as number[]).length; i++) {
				out += `BRDA:${branch.line},${id},${i},${(counts as number[])[i]}\n`;
				branchTotal++;
				if (((counts as number[])[i] ?? 0) > 0) branchHit++;
			}
		}
		out += `BRF:${branchTotal}\nBRH:${branchHit}\n`;

		out += 'end_of_record\n';
	}
	return out;
}

interface SummaryEntry {
	total: number;
	covered: number;
	skipped: number;
	pct: number;
}

function toSummary(merged: Record<string, any>) {
	const totals = {
		statements: 0,
		statementsHit: 0,
		functions: 0,
		functionsHit: 0,
		branches: 0,
		branchesHit: 0,
		lines: 0,
		linesHit: 0
	};
	for (const cov of Object.values(merged)) {
		const sCounts = Object.values(cov.s) as number[];
		totals.statements += sCounts.length;
		totals.statementsHit += sCounts.filter((n) => n > 0).length;

		const fCounts = Object.values(cov.f) as number[];
		totals.functions += fCounts.length;
		totals.functionsHit += fCounts.filter((n) => n > 0).length;

		const bCounts = Object.values(cov.b as Record<string, number[]>);
		for (const arr of bCounts) {
			totals.branches += arr.length;
			totals.branchesHit += arr.filter((n) => n > 0).length;
		}

		const lineSet = new Set<number>();
		const hitSet = new Set<number>();
		for (const [id, count] of Object.entries(cov.s)) {
			const stmt = cov.statementMap[id];
			if (!stmt) continue;
			lineSet.add(stmt.start.line);
			if ((count as number) > 0) hitSet.add(stmt.start.line);
		}
		totals.lines += lineSet.size;
		totals.linesHit += hitSet.size;
	}
	const pct = (hit: number, total: number): number =>
		total === 0 ? 100 : Math.round((hit / total) * 10000) / 100;
	const entry = (total: number, covered: number): SummaryEntry => ({
		total,
		covered,
		skipped: 0,
		pct: pct(covered, total)
	});
	return {
		total: {
			statements: entry(totals.statements, totals.statementsHit),
			functions: entry(totals.functions, totals.functionsHit),
			branches: entry(totals.branches, totals.branchesHit),
			lines: entry(totals.lines, totals.linesHit)
		}
	};
}

if (import.meta.url === `file://${process.argv[1]}`) {
	mergeAndReport().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
