export type SavedWord = {
	word: string;
	partOfSpeech: string;
	definition: string;
	savedAt?: number;
};

const SAVED_KEY = 'wordoftheday:saved';
const SAVED_CAP = 30;

function isValidEntry(item: unknown): item is SavedWord {
	if (!item || typeof item !== 'object') return false;
	const e = item as Partial<SavedWord>;
	return (
		typeof e.word === 'string' &&
		typeof e.partOfSpeech === 'string' &&
		typeof e.definition === 'string'
	);
}

function readSavedFromStorage(): SavedWord[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = window.localStorage.getItem(SAVED_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(isValidEntry);
	} catch {
		return [];
	}
}

function writeSavedToStorage(list: SavedWord[]): boolean {
	if (typeof window === 'undefined') return false;
	try {
		window.localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(0, SAVED_CAP)));
		return true;
	} catch {
		return false;
	}
}

// useState makes the saved-words list reactive across pages and survives route changes.
// localStorage stays the source of truth on hard reload; we hydrate on first read.
export function useSavedWords() {
	const list = useState<SavedWord[]>('saved-words', () => []);
	const hydrated = useState<boolean>('saved-words-hydrated', () => false);

	function hydrate() {
		if (hydrated.value) return;
		list.value = readSavedFromStorage();
		hydrated.value = true;
	}

	function refresh() {
		list.value = readSavedFromStorage();
		hydrated.value = true;
	}

	function isSaved(word: string): boolean {
		if (!hydrated.value) hydrate();
		const lower = word.toLowerCase();
		return list.value.some((w) => w.word.toLowerCase() === lower);
	}

	function save(entry: SavedWord): boolean {
		if (!hydrated.value) hydrate();
		const lower = entry.word.toLowerCase();
		if (list.value.some((w) => w.word.toLowerCase() === lower)) return false;
		const next: SavedWord[] = [
			{ ...entry, savedAt: entry.savedAt ?? Date.now() },
			...list.value
		].slice(0, SAVED_CAP);
		list.value = next;
		writeSavedToStorage(next);
		return true;
	}

	function remove(word: string): boolean {
		if (!hydrated.value) hydrate();
		const lower = word.toLowerCase();
		const next = list.value.filter((w) => w.word.toLowerCase() !== lower);
		if (next.length === list.value.length) return false;
		list.value = next;
		writeSavedToStorage(next);
		return true;
	}

	function clearAll() {
		list.value = [];
		writeSavedToStorage([]);
	}

	if (import.meta.client && !hydrated.value) hydrate();

	return {
		list: readonly(list),
		hydrate,
		refresh,
		isSaved,
		save,
		remove,
		clearAll,
		cap: SAVED_CAP
	};
}
