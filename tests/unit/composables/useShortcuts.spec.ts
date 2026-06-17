import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initShortcuts, useShortcuts } from '~/composables/useShortcuts';

// initShortcuts wires a single global keydown listener (module singleton). It's
// never asserted in e2e (palette/help open via clicks there), so the keyboard
// branches — Cmd/Ctrl+K, /, ?, the `g _` chords, and the editable-target guard —
// live here. Init once, then drive it by dispatching real KeyboardEvents.

const router = { push: vi.fn() };

const key = (init: KeyboardEventInit & { key: string }, target?: EventTarget) => {
	const ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
	(target ?? window).dispatchEvent(ev);
	return ev;
};

beforeAll(() => {
	initShortcuts(router as any);
});

beforeEach(() => {
	router.push.mockClear();
	const { closePalette, closeHelp } = useShortcuts();
	closePalette();
	closeHelp();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('useShortcuts toggles', () => {
	it('open/close palette and help flip the shared refs', () => {
		const s = useShortcuts();
		s.openPalette();
		expect(s.paletteOpen.value).toBe(true);
		s.closePalette();
		expect(s.paletteOpen.value).toBe(false);

		s.openHelp();
		expect(s.helpOpen.value).toBe(true);
		s.closeHelp();
		expect(s.helpOpen.value).toBe(false);
	});
});

describe('initShortcuts keydown', () => {
	it('Cmd+K and Ctrl+K open the palette and preventDefault', () => {
		const { paletteOpen } = useShortcuts();
		const ev = key({ key: 'k', metaKey: true });
		expect(paletteOpen.value).toBe(true);
		expect(ev.defaultPrevented).toBe(true);

		paletteOpen.value = false;
		key({ key: 'K', ctrlKey: true });
		expect(paletteOpen.value).toBe(true);
	});

	it('Cmd+K still works while typing in an input', () => {
		const input = document.createElement('input');
		document.body.appendChild(input);
		const { paletteOpen } = useShortcuts();

		key({ key: 'k', metaKey: true }, input);
		expect(paletteOpen.value).toBe(true);

		input.remove();
	});

	it('"/" opens the palette and "?" opens help', () => {
		const { paletteOpen, helpOpen } = useShortcuts();

		key({ key: '/' });
		expect(paletteOpen.value).toBe(true);

		key({ key: '?' });
		expect(helpOpen.value).toBe(true);
	});

	it('ignores bare shortcuts while focus is in an editable field', () => {
		const input = document.createElement('input');
		document.body.appendChild(input);
		const { paletteOpen } = useShortcuts();

		key({ key: '/' }, input);
		expect(paletteOpen.value).toBe(false);

		input.remove();
	});

	it('ignores a contenteditable target too', () => {
		const div = document.createElement('div');
		div.setAttribute('contenteditable', 'true');
		// happy-dom derives isContentEditable from the attribute
		Object.defineProperty(div, 'isContentEditable', { value: true, configurable: true });
		document.body.appendChild(div);
		const { paletteOpen } = useShortcuts();

		key({ key: '/' }, div);
		expect(paletteOpen.value).toBe(false);

		div.remove();
	});

	it('does not hijack a modified bare key (e.g. Alt+/)', () => {
		const { paletteOpen } = useShortcuts();
		key({ key: '/', altKey: true });
		expect(paletteOpen.value).toBe(false);
	});

	it.each([
		['h', '/'],
		['a', '/activities'],
		['p', '/prompts'],
		['r', '/articles'],
		['e', '/events'],
		['q', '/profile/quests'],
		['m', '/profile']
	])('the "g %s" chord navigates to %s', (letter, path) => {
		key({ key: 'g' });
		key({ key: letter });
		expect(router.push).toHaveBeenCalledWith(path);
	});

	it('an unknown second chord key clears the buffer without navigating', () => {
		key({ key: 'g' });
		key({ key: 'z' }); // not a mapped destination
		expect(router.push).not.toHaveBeenCalled();

		// buffer was cleared, so a following "h" alone does nothing
		key({ key: 'h' });
		expect(router.push).not.toHaveBeenCalled();
	});

	it('clears the chord buffer after the 1.5s timeout', () => {
		vi.useFakeTimers();
		key({ key: 'g' });
		vi.advanceTimersByTime(1500);
		key({ key: 'h' });
		expect(router.push).not.toHaveBeenCalled();
	});
});
