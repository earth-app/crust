const paletteOpen = ref(false);
const helpOpen = ref(false);

let initialized = false;

const isEditable = (el: EventTarget | null): boolean => {
	if (!(el instanceof HTMLElement)) return false;
	const tag = el.tagName;
	if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
	if (el.isContentEditable) return true;
	return false;
};

export function initShortcuts(router: ReturnType<typeof useRouter>) {
	if (initialized) return;
	if (!import.meta.client) return;
	initialized = true;

	let chordBuffer = '';
	let chordTimeout: ReturnType<typeof setTimeout> | null = null;

	const clearChord = () => {
		chordBuffer = '';
		if (chordTimeout) {
			clearTimeout(chordTimeout);
			chordTimeout = null;
		}
	};

	const goPath = (path: string) => {
		clearChord();
		void router.push(path);
	};

	window.addEventListener('keydown', (e: KeyboardEvent) => {
		// Cmd/Ctrl+K opens the palette regardless of focus context — power-user expectation
		if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
			e.preventDefault();
			paletteOpen.value = true;
			return;
		}

		// don't hijack typing when the user is in a text field
		if (isEditable(e.target)) return;
		if (e.altKey || e.metaKey || e.ctrlKey) return;

		// "?" — open help overlay (shift+/ on most layouts)
		if (e.key === '?') {
			e.preventDefault();
			helpOpen.value = true;
			return;
		}

		// "/" — open palette
		if (e.key === '/') {
			e.preventDefault();
			paletteOpen.value = true;
			return;
		}

		// "g <letter>" chord shortcuts
		if (chordBuffer === 'g') {
			let path: string | null = null;
			if (e.key === 'h') path = '/';
			else if (e.key === 'a') path = '/activities';
			else if (e.key === 'p') path = '/prompts';
			else if (e.key === 'r') path = '/articles';
			else if (e.key === 'e') path = '/events';
			else if (e.key === 'q') path = '/profile/quests';
			else if (e.key === 'm') path = '/profile';
			if (path) {
				e.preventDefault();
				goPath(path);
				return;
			}
			clearChord();
		}

		if (e.key === 'g') {
			chordBuffer = 'g';
			if (chordTimeout) clearTimeout(chordTimeout);
			chordTimeout = setTimeout(clearChord, 1500);
		}
	});
}

export function useShortcuts() {
	return {
		paletteOpen,
		helpOpen,
		openPalette: () => (paletteOpen.value = true),
		closePalette: () => (paletteOpen.value = false),
		openHelp: () => (helpOpen.value = true),
		closeHelp: () => (helpOpen.value = false)
	};
}

export const SHORTCUT_LIST: ReadonlyArray<{ keys: string; label: string }> = [
	{ keys: 'Cmd/Ctrl+K', label: 'Open command palette' },
	{ keys: '/', label: 'Open command palette' },
	{ keys: '?', label: 'Show this help overlay' },
	{ keys: 'g h', label: 'Go to home' },
	{ keys: 'g a', label: 'Go to activities' },
	{ keys: 'g r', label: 'Go to articles' },
	{ keys: 'g p', label: 'Go to prompts' },
	{ keys: 'g e', label: 'Go to events' },
	{ keys: 'g q', label: 'Go to your quests' },
	{ keys: 'g m', label: 'Go to your profile' }
];
