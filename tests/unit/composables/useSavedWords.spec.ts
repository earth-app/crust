import { beforeEach, describe, expect, it } from 'vitest';
import type { SavedWord } from '~/composables/useSavedWords';
import { useSavedWords } from '~/composables/useSavedWords';

// word-of-the-day saved list lives in localStorage with a 30-item cap and
// case-insensitive dedupe; no e2e drives the cap/dedupe/corruption edges.

const SAVED_KEY = 'wordoftheday:saved';
const word = (w: string): SavedWord => ({
	word: w,
	partOfSpeech: 'noun',
	definition: `definition of ${w}`
});

describe('useSavedWords', () => {
	beforeEach(() => {
		window.localStorage.clear();
		// useState is shared within the nuxt test context — reset it explicitly
		useState<SavedWord[]>('saved-words', () => []).value = [];
		useState<boolean>('saved-words-hydrated', () => false).value = false;
	});

	it('saves a new word, persists it, and reports it as saved', () => {
		const { save, isSaved, list } = useSavedWords();

		expect(save(word('serendipity'))).toBe(true);
		expect(isSaved('serendipity')).toBe(true);
		expect(list.value).toHaveLength(1);

		const persisted = JSON.parse(window.localStorage.getItem(SAVED_KEY)!);
		expect(persisted[0].word).toBe('serendipity');
	});

	it('stamps savedAt when absent', () => {
		const { save, list } = useSavedWords();
		save(word('ephemeral'));
		expect(typeof list.value[0]!.savedAt).toBe('number');
	});

	it('refuses duplicates case-insensitively', () => {
		const { save, list } = useSavedWords();
		expect(save(word('Aurora'))).toBe(true);
		expect(save(word('aurora'))).toBe(false);
		expect(list.value).toHaveLength(1);
	});

	it('matches isSaved case-insensitively', () => {
		const { save, isSaved } = useSavedWords();
		save(word('Quixotic'));
		expect(isSaved('QUIXOTIC')).toBe(true);
		expect(isSaved('nope')).toBe(false);
	});

	it('prepends newest first and caps the list at 30', () => {
		const { save, list, isSaved, cap } = useSavedWords();
		expect(cap).toBe(30);

		for (let i = 0; i <= 30; i++) save(word(`w${i}`)); // 31 distinct words

		expect(list.value).toHaveLength(30);
		expect(list.value[0]!.word).toBe('w30'); // newest on top
		expect(isSaved('w0')).toBe(false); // oldest evicted
		expect(isSaved('w30')).toBe(true);
	});

	it('removes a word case-insensitively and reports whether it changed', () => {
		const { save, remove, isSaved, list } = useSavedWords();
		save(word('Liminal'));

		expect(remove('LIMINAL')).toBe(true);
		expect(isSaved('liminal')).toBe(false);
		expect(remove('liminal')).toBe(false); // already gone
		expect(list.value).toHaveLength(0);
	});

	it('clearAll empties the list and storage', () => {
		const { save, clearAll, list } = useSavedWords();
		save(word('petrichor'));
		clearAll();

		expect(list.value).toHaveLength(0);
		expect(JSON.parse(window.localStorage.getItem(SAVED_KEY)!)).toEqual([]);
	});

	it('hydrates valid entries from storage and drops malformed ones', () => {
		window.localStorage.setItem(
			SAVED_KEY,
			JSON.stringify([
				word('valid'),
				{ word: 'missing-fields' }, // no partOfSpeech/definition
				'garbage'
			])
		);

		const { list, isSaved } = useSavedWords(); // auto-hydrates on construction
		expect(list.value).toHaveLength(1);
		expect(isSaved('valid')).toBe(true);
	});

	it('treats corrupt storage as an empty list', () => {
		window.localStorage.setItem(SAVED_KEY, 'not-json{');
		const { refresh, list } = useSavedWords();
		refresh();
		expect(list.value).toEqual([]);
	});
});
