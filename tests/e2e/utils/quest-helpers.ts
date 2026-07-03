import type { Page } from '@playwright/test';
import { expect } from './fixtures';
import type { MockClient } from './mock-client';

export const QUEST_HARNESS = '/__test__/quest-harness';

export async function seedActiveQuest(
	mockApi: MockClient,
	userId: string,
	activeQuest: Record<string, any>
): Promise<void> {
	await mockApi.set({
		method: 'GET',
		path: `^/v2/users/${escapeRe(userId)}/quest$`,
		body: activeQuest,
		once: false
	});
}

export async function seedQuestHistory(
	mockApi: MockClient,
	userId: string,
	entries: Record<string, any>[]
): Promise<void> {
	const history: Record<string, any> = {};
	for (const entry of entries) {
		const key = entry.questId ?? entry.quest?.id;
		if (key) history[key] = entry;
	}
	await mockApi.set({
		method: 'GET',
		path: `^/v2/users/${escapeRe(userId)}/quest/history`,
		body: { history, items: entries, total: entries.length, page: 1, limit: 25 },
		once: false
	});
}

export async function stubQuestUpdate(
	mockApi: MockClient,
	userId: string,
	result: { validated?: boolean; completed?: boolean; message?: string } = {}
): Promise<void> {
	await mockApi.set({
		backend: 'cloud',
		method: 'PATCH',
		path: `^/v1/users/quests/progress/${escapeRe(userId)}/update$`,
		body: {
			validated: result.validated ?? true,
			completed: result.completed ?? false,
			message: result.message ?? 'ok'
		},
		once: false
	});
}

/** Wait for the harness store to finish seeding the active quest. */
export async function waitForHarnessReady(page: Page): Promise<void> {
	await expect(page.getByTestId('harness-ready')).toHaveText('ready', { timeout: 15_000 });
}

/** Open the fullscreen quest modal (idempotent if it auto-opened via ?open=1). */
export async function openQuestModal(page: Page): Promise<void> {
	const opener = page.getByTestId('open-quest');
	if (await opener.isVisible().catch(() => false)) {
		await opener.click();
	}
	// timeline start/end button is the stable in-modal marker
	await expect(page.locator('#quest-button')).toBeVisible({ timeout: 12_000 });
}

/** Click a timeline step tile to open its step modal. Single steps live at #tile-N:0. */
export async function openStep(page: Page, index: number, altIndex = 0): Promise<void> {
	const tile = page.locator(`#tile-${index}\\:${altIndex}`);
	await tile.scrollIntoViewIfNeeded();
	await tile.click();
	// step modal renders the Submission body
	await expect(page.getByRole('button', { name: 'Close' }).last()).toBeVisible({ timeout: 8_000 });
}

/** Assert the global Quest Complete overlay is showing. */
export async function expectQuestComplete(page: Page): Promise<void> {
	await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 8_000 });
	await expect(page.getByRole('heading', { name: 'Quest Complete!' })).toBeVisible();
}

export function longAnswer(minChars = 220): string {
	const base =
		'I spent the afternoon exploring a nearby trail and noticed how the light shifted through the trees. ';
	let out = '';
	let i = 0;
	while (out.length < minChars) {
		out += base.replace('afternoon', `afternoon ${i++}`);
	}
	return out.slice(0, Math.max(minChars, out.length));
}

/** Fill + submit a describe_text step (no hardware needed). */
export async function submitDescribeText(page: Page, text: string): Promise<void> {
	const box = page.getByPlaceholder('Type your answer here...');
	await expect(box).toBeVisible();
	// keystroke-by-keystroke; the component blocks paste
	await box.click();
	await page.keyboard.insertText(text);
	const submit = page.getByRole('button', { name: 'Submit', exact: true });
	await expect(submit).toBeEnabled();
	await submit.click();
}

function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
