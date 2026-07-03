import type { Page } from '@playwright/test';
import { expect } from './fixtures';
import type { MockClient } from './mock-client';

function summarize(questions: any[]) {
	const count = (t: string) => questions.filter((q) => q.type === t).length;
	return {
		total: questions.length,
		multiple_choice_count: count('multiple_choice'),
		multi_select_count: count('multi_select'),
		true_false_count: count('true_false'),
		order_count: count('order')
	};
}

/** Override the quiz-questions fetch for one article. */
export async function seedQuiz(
	mockApi: MockClient,
	articleId: string,
	quiz: { questions: any[]; summary?: any }
): Promise<void> {
	await mockApi.set({
		method: 'GET',
		path: `^/v2/articles/${escapeRe(articleId)}/quiz$`,
		body: { questions: quiz.questions, summary: quiz.summary ?? summarize(quiz.questions) },
		once: false
	});
}

/** Override the graded-score submit (the POST /api/article/quiz proxy hits cloud submit). */
export async function stubQuizScore(
	mockApi: MockClient,
	scoreResult: Record<string, any>
): Promise<void> {
	await mockApi.set({
		backend: 'cloud',
		method: 'POST',
		path: '^/v1/articles/quiz/submit$',
		body: scoreResult,
		once: false
	});
}

/** Ensure the GET score route says "not taken yet" so the Take Quiz button shows. */
export async function stubQuizNotTaken(mockApi: MockClient): Promise<void> {
	await mockApi.set({
		backend: 'cloud',
		method: 'GET',
		path: '^/v1/articles/quiz/score',
		status: 404,
		body: { message: 'not taken' },
		once: false
	});
}

/** Click Take Quiz and wait for the quiz modal to render its first question. */
export async function openQuiz(page: Page): Promise<void> {
	const btn = page.locator('#quiz-button');
	await expect(btn).toBeVisible({ timeout: 12_000 });
	await btn.click();
	await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible({ timeout: 8_000 });
}

/** Pick a single-choice (multiple_choice / true_false) option by visible label. */
export async function pickRadio(page: Page, label: string | RegExp): Promise<void> {
	await page.getByRole('radio', { name: label }).check();
}

/** Toggle a multi_select checkbox by its adjacent label text. */
export async function toggleCheckbox(page: Page, label: string): Promise<void> {
	await page.getByText(label, { exact: true }).click();
}

export async function nextQuestion(page: Page): Promise<void> {
	await page
		.locator('button:has(.i-mdi\\:arrow-right)')
		.filter({ hasNotText: 'Submit' })
		.first()
		.click();
}

/** Submit the quiz (enabled only once every question is answered). */
export async function submitQuiz(page: Page): Promise<void> {
	const submit = page.getByRole('button', { name: 'Submit', exact: true });
	await expect(submit).toBeEnabled({ timeout: 8_000 });
	await submit.click();
}

/** Assert the post-submit score header (e.g. "100% (1 / 1)"). */
export async function expectScore(page: Page, percent: number): Promise<void> {
	await expect(page.getByRole('heading', { level: 3 })).toContainText(`${percent}%`, {
		timeout: 8_000
	});
}

function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
