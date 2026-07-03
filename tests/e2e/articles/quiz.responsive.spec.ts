import {
	expectScore,
	openQuiz,
	pickRadio,
	seedQuiz,
	stubQuizNotTaken,
	stubQuizScore,
	submitQuiz
} from '../utils/article-quiz-helpers';
import { expect, skipIfIntegration, test } from '../utils/fixtures';
import { makeArticle, makeQuizQuestion, makeQuizScoreResult, makeUser } from '../utils/mock-data';

const ARTICLE_ID = 'quiz-art-mobile';

async function seedArticle(mockApi: any) {
	const writer = makeUser({ id: 'writer-1', username: 'writer-1' });
	const article = makeArticle({
		id: ARTICLE_ID,
		title: 'Mobile Quiz Article',
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
}

test.describe('Article quiz (mobile)', () => {
	test('quiz modal is usable on a small viewport: answer + submit + score', async ({
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
		await expect(page.getByRole('heading', { level: 1, name: 'Mobile Quiz Article' })).toBeVisible({
			timeout: 12_000
		});

		await openQuiz(page);

		// the modal fills the viewport on mobile (min-w-full); the question heading
		// and the radios must be reachable within the narrow layout
		const question = page.getByRole('heading', { level: 2 }).first();
		await expect(question).toBeVisible();

		await pickRadio(page, '4');
		await submitQuiz(page);
		await expectScore(page, 100);
	});
});
