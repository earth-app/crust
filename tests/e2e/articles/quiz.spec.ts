import {
	expectScore,
	nextQuestion,
	openQuiz,
	pickRadio,
	seedQuiz,
	stubQuizNotTaken,
	stubQuizScore,
	submitQuiz,
	toggleCheckbox
} from '../utils/article-quiz-helpers';
import { expect, skipIfIntegration, test } from '../utils/fixtures';
import { makeArticle, makeQuizQuestion, makeQuizScoreResult, makeUser } from '../utils/mock-data';

const ARTICLE_ID = 'quiz-art-1';

// register the article in the mock so the detail page resolves its title + author
async function seedArticle(mockApi: any) {
	const writer = makeUser({ id: 'writer-1', username: 'writer-1' });
	const article = makeArticle({
		id: ARTICLE_ID,
		title: 'Quiz Article',
		author: writer,
		author_id: writer.id,
		tags: ['SCIENCE']
	});
	await mockApi.set({
		method: 'GET',
		path: `^/v2/articles/${ARTICLE_ID}$`,
		body: article,
		once: false
	});
	return article;
}

// taken-state: stub the GET score so the button reads "View Quiz Score"
async function stubQuizTaken(mockApi: any, scoreResult: Record<string, any>) {
	await mockApi.set({
		backend: 'cloud',
		method: 'GET',
		path: '^/v1/articles/quiz/score',
		body: scoreResult,
		once: false
	});
}

test.describe('Article quiz - take flow', () => {
	test('single multiple_choice question: pick correct -> submit -> 100%', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		await seedArticle(mockApi);
		await seedQuiz(mockApi, ARTICLE_ID, {
			questions: [
				makeQuizQuestion({
					type: 'multiple_choice',
					question: 'What is 2 + 2?',
					options: ['3', '4', '5', '6']
				})
			]
		});
		await stubQuizNotTaken(mockApi);
		await stubQuizScore(mockApi, makeQuizScoreResult({ score: 1, total: 1, scorePercent: 100 }));

		await asUser();
		await gotoHydrated(`/articles/${ARTICLE_ID}`);
		await expect(page.getByRole('heading', { level: 1, name: 'Quiz Article' })).toBeVisible({
			timeout: 12_000
		});

		await openQuiz(page);
		await pickRadio(page, '4');
		await submitQuiz(page);
		await expectScore(page, 100);
	});

	test('multi-question quiz: Submit disabled until every question answered', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		await seedArticle(mockApi);
		await seedQuiz(mockApi, ARTICLE_ID, {
			questions: [
				makeQuizQuestion({
					type: 'multiple_choice',
					question: 'Pick the primary color.',
					options: ['Blue', 'Green', 'Purple']
				}),
				makeQuizQuestion({ type: 'true_false', question: 'The sky is blue.', options: [] }),
				makeQuizQuestion({
					type: 'multi_select',
					question: 'Select the even numbers.',
					options: ['1', '2', '3', '4']
				})
			]
		});
		await stubQuizNotTaken(mockApi);
		await stubQuizScore(mockApi, makeQuizScoreResult({ score: 3, total: 3, scorePercent: 100 }));

		await asUser();
		await gotoHydrated(`/articles/${ARTICLE_ID}`);
		await expect(page.getByRole('heading', { level: 1, name: 'Quiz Article' })).toBeVisible({
			timeout: 12_000
		});

		await openQuiz(page);

		const submit = page.getByRole('button', { name: 'Submit', exact: true });
		// nothing answered yet -> disabled
		await expect(submit).toBeDisabled();

		// q1 multiple_choice
		await pickRadio(page, 'Blue');
		await nextQuestion(page);
		// q2 true_false (options empty -> True/False labels)
		await pickRadio(page, 'True');
		await nextQuestion(page);
		// still disabled until the multi_select has at least one pick
		await expect(submit).toBeDisabled();
		// q3 multi_select
		await toggleCheckbox(page, '2');
		await toggleCheckbox(page, '4');

		await submitQuiz(page);
		await expectScore(page, 100);
	});

	test('order question: tap-to-place all items -> Submit enables -> submit', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		const items = ['Alpha', 'Beta', 'Gamma'];
		await seedArticle(mockApi);
		await seedQuiz(mockApi, ARTICLE_ID, {
			questions: [makeQuizQuestion({ type: 'order', question: 'Order the letters.', items })]
		});
		await stubQuizNotTaken(mockApi);
		await stubQuizScore(mockApi, makeQuizScoreResult({ score: 1, total: 1, scorePercent: 100 }));

		await asUser();
		await gotoHydrated(`/articles/${ARTICLE_ID}`);
		await expect(page.getByRole('heading', { level: 1, name: 'Quiz Article' })).toBeVisible({
			timeout: 12_000
		});

		await openQuiz(page);

		// the embedded Orderer renders a [data-bank] with one tile button per item
		const bank = page.locator('[data-bank]');
		await expect(bank).toBeVisible({ timeout: 8_000 });
		for (const item of items) {
			await expect(bank.getByRole('button', { name: item })).toBeVisible();
		}

		// Orderer supports tap-to-place (selectBankTile -> onSlotClick): far less
		// flaky than driving the pointer drag inside a modal. Place each item into
		// the next empty slot in order.
		const slots = page.locator('[data-slot-index]');
		for (let i = 0; i < items.length; i++) {
			await bank.getByRole('button', { name: items[i]! }).click();
			await slots.nth(i).click();
		}

		await submitQuiz(page);
		await expectScore(page, 100);
	});
});

test.describe('Article quiz - taken state', () => {
	test('"View Quiz Score" opens score header + per-question breakdown', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		await seedArticle(mockApi);
		await seedQuiz(mockApi, ARTICLE_ID, {
			questions: [
				makeQuizQuestion({
					type: 'multiple_choice',
					question: 'What is 2 + 2?',
					options: ['3', '4', '5']
				})
			]
		});
		// completed score result so the GET resolves -> button reads "View Quiz Score"
		const result = makeQuizScoreResult({
			score: 1,
			total: 1,
			scorePercent: 100,
			results: [{ correct: true, correct_answer_index: 1, user_answer_index: 1 }]
		});
		await stubQuizTaken(mockApi, result);

		await asUser();
		await gotoHydrated(`/articles/${ARTICLE_ID}`);
		await expect(page.getByRole('heading', { level: 1, name: 'Quiz Article' })).toBeVisible({
			timeout: 12_000
		});

		const btn = page.locator('#quiz-button');
		await expect(btn).toHaveText(/View Quiz Score/i, { timeout: 12_000 });
		await btn.click();

		// score header (h3) shows the percent + ratio
		await expect(page.getByRole('heading', { level: 3 })).toContainText('100%', {
			timeout: 8_000
		});
		// per-question result row: "Correct" with the check icon
		await expect(page.getByText('Correct', { exact: true }).first()).toBeVisible({
			timeout: 8_000
		});
	});

	test('incorrect answer shows the Incorrect breakdown', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		await seedArticle(mockApi);
		await seedQuiz(mockApi, ARTICLE_ID, {
			questions: [
				makeQuizQuestion({
					type: 'multiple_choice',
					question: 'What is 2 + 2?',
					options: ['3', '4', '5']
				})
			]
		});
		const result = makeQuizScoreResult({
			score: 0,
			total: 1,
			scorePercent: 0,
			results: [{ correct: false, correct_answer_index: 1, user_answer_index: 0 }]
		});
		await stubQuizTaken(mockApi, result);

		await asUser();
		await gotoHydrated(`/articles/${ARTICLE_ID}`);
		await expect(page.getByRole('heading', { level: 1, name: 'Quiz Article' })).toBeVisible({
			timeout: 12_000
		});

		const btn = page.locator('#quiz-button');
		await expect(btn).toHaveText(/View Quiz Score/i, { timeout: 12_000 });
		await btn.click();

		await expect(page.getByRole('heading', { level: 3 })).toContainText('0%', { timeout: 8_000 });
		await expect(page.getByText('Incorrect', { exact: true }).first()).toBeVisible({
			timeout: 8_000
		});
	});
});

test.describe('Article quiz - button gating', () => {
	test('admin sees "Generate Quiz" when no quiz exists', async ({
		asAdmin,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		await seedArticle(mockApi);
		// empty quiz -> quiz.length === 0 -> admin generate path
		await seedQuiz(mockApi, ARTICLE_ID, { questions: [] });
		await stubQuizNotTaken(mockApi);

		await asAdmin();
		await gotoHydrated(`/articles/${ARTICLE_ID}`);
		await expect(page.getByRole('heading', { level: 1, name: 'Quiz Article' })).toBeVisible({
			timeout: 12_000
		});

		const btn = page.locator('#quiz-button');
		await expect(btn).toBeVisible({ timeout: 12_000 });
		await expect(btn).toHaveText(/Generate Quiz/i);
	});

	test('anonymous never sees the quiz button', async ({
		asAnonymous,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		await seedArticle(mockApi);
		await seedQuiz(mockApi, ARTICLE_ID, {
			questions: [makeQuizQuestion({ type: 'multiple_choice' })]
		});
		await stubQuizNotTaken(mockApi);

		await asAnonymous();
		await gotoHydrated(`/articles/${ARTICLE_ID}`);
		await expect(page.getByRole('heading', { level: 1, name: 'Quiz Article' })).toBeVisible({
			timeout: 12_000
		});

		// the button is gated on `user` (Take Quiz) and `user?.is_admin` (Generate)
		await expect(page.locator('#quiz-button')).toHaveCount(0);
	});
});
