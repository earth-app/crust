import { createPinia, setActivePinia } from 'pinia';
import { useArticleStore } from 'stores/article';
import type { Article, ArticleQuizAnswer, ArticleQuizQuestion } from 'types/article';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useArticle, useArticles } from '~/composables/useArticle';

vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return { ...actual, makeAPIRequest: vi.fn(), makeClientAPIRequest: vi.fn() };
});

import { makeAPIRequest, makeClientAPIRequest } from 'utils';

// minimal valid article shape (store's isValidArticle needs id + author.id)
function article(id: string, tags: string[] = []): Article {
	return {
		id,
		title: id,
		description: '',
		tags,
		content: '',
		author: { id: `author-${id}` },
		author_id: `author-${id}`,
		color: 0,
		color_hex: '#000000',
		created_at: '2026-01-01'
	} as unknown as Article;
}

const ok = <T>(data: T) => ({ success: true as const, data });
const fail = (message = 'boom') => ({ success: false as const, message });

// useArticle() construction runs fetchQuizScore() on the (test) client, so serverRequest
// always sees a *-quiz-score call first. count only the calls whose cache key contains `frag`.
const callsFor = (sr: ReturnType<typeof vi.fn>, frag: string) =>
	sr.mock.calls.filter((c) => String(c[0]).includes(frag));

describe('useArticle', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
		// auto-fetch on useArticles() construction resolves to a no-op
		(makeAPIRequest as any).mockResolvedValue(fail('not loaded'));
	});

	// seed the store so article.value is loaded without hitting fetch()
	const seed = (...arts: Article[]) => {
		useArticleStore().setArticles(arts);
	};

	describe('fetchSimilar', () => {
		it('uses the server result when upstream returns a non-empty list', async () => {
			seed(article('current'));
			(makeClientAPIRequest as any).mockResolvedValue(ok([article('p1'), article('p2')]));
			const serverRequest = vi.fn().mockResolvedValue(ok([article('s1'), article('s2')]));

			const { fetchSimilar } = useArticle('current', serverRequest as any);
			const res = await fetchSimilar(2);

			expect(res.success).toBe(true);
			expect((res as any).data.map((a: Article) => a.id)).toEqual(['s1', 's2']);
		});

		it('falls back to the random pool when the server returns an empty list', async () => {
			seed(article('current'));
			(makeClientAPIRequest as any).mockResolvedValue(
				ok([article('p1'), article('p2'), article('p3')])
			);
			const serverRequest = vi.fn().mockResolvedValue(ok([] as Article[]));

			const { fetchSimilar } = useArticle('current', serverRequest as any);
			const res = await fetchSimilar(2);

			// fell back to pool slice, never blanked
			expect(res.success).toBe(true);
			expect((res as any).data.length).toBe(2);
			expect((res as any).data.every((a: Article) => a.id !== 'current')).toBe(true);
		});

		it('falls back to the random pool when the server request fails', async () => {
			seed(article('current'));
			// pool contains current; the fallback must filter it out, leaving p1+p2
			(makeClientAPIRequest as any).mockResolvedValue(
				ok([article('current'), article('p1'), article('p2')])
			);
			const serverRequest = vi.fn().mockResolvedValue(fail());

			const { fetchSimilar } = useArticle('current', serverRequest as any);
			const res = await fetchSimilar(5);

			expect(res.success).toBe(true);
			// degrades gracefully: pool minus current
			expect((res as any).data.length).toBe(2);
			expect((res as any).data.map((a: Article) => a.id).sort()).toEqual(['p1', 'p2']);
		});

		it('excludes the current article from the fallback pool', async () => {
			seed(article('current'));
			(makeClientAPIRequest as any).mockResolvedValue(
				ok([article('current'), article('p1'), article('p2')])
			);
			const serverRequest = vi.fn().mockResolvedValue(fail());

			const { fetchSimilar } = useArticle('current', serverRequest as any);
			const res = await fetchSimilar(10);

			expect((res as any).data.map((a: Article) => a.id)).not.toContain('current');
		});

		it('slices the fallback to the requested count', async () => {
			seed(article('current'));
			const pool = Array.from({ length: 12 }, (_, i) => article(`p${i}`));
			(makeClientAPIRequest as any).mockResolvedValue(ok(pool));
			const serverRequest = vi.fn().mockResolvedValue(fail());

			const { fetchSimilar } = useArticle('current', serverRequest as any);
			const res = await fetchSimilar(3);

			expect((res as any).data.length).toBe(3);
		});

		it('returns empty data (no throw) when the random pool itself is empty', async () => {
			seed(article('current'));
			(makeClientAPIRequest as any).mockResolvedValue(ok([] as Article[]));
			const serverRequest = vi.fn().mockResolvedValue(fail());

			const { fetchSimilar } = useArticle('current', serverRequest as any);
			const res = await fetchSimilar(5);

			expect(res).toEqual({ success: true, data: [], message: '' });
			// short-circuits before ever hitting the similar endpoint
			expect(callsFor(serverRequest, '-similar_articles')).toHaveLength(0);
		});

		it('reports not found when the article cannot be loaded', async () => {
			// nothing seeded; fetch() (mocked makeAPIRequest) leaves it null
			const serverRequest = vi.fn().mockResolvedValue(fail());
			const { fetchSimilar } = useArticle('missing', serverRequest as any);
			const res = await fetchSimilar();

			expect(res).toEqual({ success: false, message: 'Article not found' });
			expect(callsFor(serverRequest, '-similar_articles')).toHaveLength(0);
		});
	});

	describe('fetchRecommended', () => {
		it('short-circuits when unauthenticated', async () => {
			// no session token set on auth store
			const { fetchRecommended } = useArticles(1, 25, '', 'desc');
			const res = await fetchRecommended(3);

			expect(res).toEqual({ success: false, message: 'User not authenticated' });
			// never reached the pool fetch
			expect(makeClientAPIRequest).not.toHaveBeenCalled();
		});

		it('falls back to the random pool when the server returns empty', async () => {
			const { useAuthStore } = await import('stores/auth');
			const authStore = useAuthStore();
			authStore.setSessionToken('token');
			authStore.currentUser = { id: 'u1' } as any;

			(makeClientAPIRequest as any).mockResolvedValue(
				ok([article('p1'), article('p2'), article('p3')])
			);
			const serverRequest = vi.fn().mockResolvedValue(ok([] as Article[]));

			const { fetchRecommended } = useArticles(1, 25, '', 'desc', serverRequest as any);
			const res = await fetchRecommended(2);

			expect(res.success).toBe(true);
			expect((res as any).data.length).toBe(2);
		});

		it('falls back to the random pool when the server fails', async () => {
			const { useAuthStore } = await import('stores/auth');
			const authStore = useAuthStore();
			authStore.setSessionToken('token');
			authStore.currentUser = { id: 'u1' } as any;

			(makeClientAPIRequest as any).mockResolvedValue(ok([article('p1'), article('p2')]));
			const serverRequest = vi.fn().mockResolvedValue(fail());

			const { fetchRecommended } = useArticles(1, 25, '', 'desc', serverRequest as any);
			const res = await fetchRecommended(5);

			expect(res.success).toBe(true);
			expect((res as any).data.map((a: Article) => a.id).sort()).toEqual(['p1', 'p2']);
		});

		it('returns empty data when the random pool is empty', async () => {
			const { useAuthStore } = await import('stores/auth');
			const authStore = useAuthStore();
			authStore.setSessionToken('token');
			authStore.currentUser = { id: 'u1' } as any;

			(makeClientAPIRequest as any).mockResolvedValue(ok([] as Article[]));
			const serverRequest = vi.fn();

			const { fetchRecommended } = useArticles(1, 25, '', 'desc', serverRequest as any);
			const res = await fetchRecommended(3);

			expect(res).toEqual({ success: true, data: [], message: '' });
			expect(serverRequest).not.toHaveBeenCalled();
		});
	});

	describe('submitQuiz', () => {
		const mcQuestion = (q: string): ArticleQuizQuestion =>
			({
				type: 'multiple_choice',
				question: q,
				options: ['a', 'b'],
				correct_answer: 'a',
				correct_answer_index: 0
			}) as ArticleQuizQuestion;

		it('throws when the article cannot be loaded', async () => {
			const serverRequest = vi.fn();
			const { submitQuiz } = useArticle('missing', serverRequest as any);

			await expect(submitQuiz([{ question: '', text: 'a' }])).rejects.toThrow(
				/Article must be loaded/
			);
		});

		it('throws when the quiz is not loaded', async () => {
			seed(article('a1'));
			const serverRequest = vi.fn();
			const { submitQuiz } = useArticle('a1', serverRequest as any);

			await expect(submitQuiz([{ question: '', text: 'a' }])).rejects.toThrow(
				/Quiz must be loaded/
			);
		});

		it('throws when answer count does not match question count', async () => {
			seed(article('a1'));
			useArticleStore().setQuiz('a1', [mcQuestion('Q1'), mcQuestion('Q2')]);
			const serverRequest = vi.fn().mockResolvedValue(fail());
			const { submitQuiz } = useArticle('a1', serverRequest as any);

			await expect(submitQuiz([{ question: '', text: 'a' }])).rejects.toThrow(
				/does not match number of questions/
			);
			expect(callsFor(serverRequest, '-quiz-submit')).toHaveLength(0);
		});

		it('stamps each answer with the question text by index', async () => {
			seed(article('a1', ['Hiking', 'Trail Running']));
			useArticleStore().setQuiz('a1', [mcQuestion('First?'), mcQuestion('Second?')]);
			const serverRequest = vi
				.fn()
				.mockResolvedValue(ok({ score: 2, scorePercent: 100, total: 2, results: [] }));

			const { submitQuiz } = useArticle('a1', serverRequest as any);
			// intentionally pass blank question fields; the composable should stamp them
			await submitQuiz([
				{ question: '', text: 'a' },
				{ question: '', text: 'b' }
			]);

			const submitCalls = callsFor(serverRequest, '-quiz-submit');
			expect(submitCalls).toHaveLength(1);
			const body = (submitCalls[0] as any[])[3].body;
			expect(body.answers.map((a: ArticleQuizAnswer) => a.question)).toEqual(['First?', 'Second?']);
			// tags upper-snake-cased into articleTypes
			expect(body.articleTypes).toEqual(['HIKING', 'TRAIL_RUNNING']);
			expect(body.articleId).toBe('a1');
		});
	});

	describe('generateQuiz', () => {
		it('caches the quiz directly when the server returns questions', async () => {
			seed(article('a1'));
			const questions: ArticleQuizQuestion[] = [
				{
					type: 'multiple_choice',
					question: 'Q?',
					options: ['a', 'b'],
					correct_answer: 'a',
					correct_answer_index: 0
				} as ArticleQuizQuestion
			];
			const serverRequest = vi.fn().mockResolvedValue(ok(questions));

			const { generateQuiz, quiz } = useArticle('a1', serverRequest as any);
			await generateQuiz();

			expect(quiz.value).toEqual(questions);
		});

		it('falls back to a GET refetch when the server returns an empty array', async () => {
			seed(article('a1'));
			const serverRequest = vi.fn().mockResolvedValue(ok([] as ArticleQuizQuestion[]));
			// fetchQuiz (store) GET goes through makeAPIRequest — return refetched questions
			const refetched: ArticleQuizQuestion[] = [
				{
					type: 'true_false',
					question: 'TF?',
					options: ['True', 'False'],
					correct_answer: 'True',
					correct_answer_index: 0,
					is_true: true,
					is_false: false
				} as ArticleQuizQuestion
			];
			(makeAPIRequest as any).mockResolvedValue(
				ok({ questions: refetched, summary: { total: 1 } })
			);

			const { generateQuiz, quiz } = useArticle('a1', serverRequest as any);
			await generateQuiz();

			// fell back to GET and populated cache from it
			expect(quiz.value).toEqual(refetched);
		});

		it('reports not found when the article cannot be loaded', async () => {
			const serverRequest = vi.fn().mockResolvedValue(fail());
			const { generateQuiz } = useArticle('missing', serverRequest as any);
			const res = await generateQuiz();

			expect(res).toEqual({ success: false, message: 'Article not found' });
			expect(callsFor(serverRequest, '-create-quiz')).toHaveLength(0);
		});
	});

	describe('fetchRandom tag filter', () => {
		it('drops articles that do not carry the requested tag', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(
				ok([
					article('a', ['Hiking']),
					article('b', ['Cycling']),
					article('c', ['Hiking', 'Camping'])
				])
			);

			const { fetchRandom } = useArticles(1, 25, '', 'desc');
			const res = await fetchRandom(15, undefined, 'hiking');

			expect(res.success).toBe(true);
			expect((res as any).data.map((a: Article) => a.id).sort()).toEqual(['a', 'c']);
		});

		it('normalizes case and underscores when matching (rock_climbing vs "Rock Climbing")', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(
				ok([article('a', ['Rock Climbing']), article('b', ['Swimming'])])
			);

			const { fetchRandom } = useArticles(1, 25, '', 'desc');
			const res = await fetchRandom(15, undefined, 'rock_climbing');

			expect((res as any).data.map((a: Article) => a.id)).toEqual(['a']);
		});

		it('leaves results untouched when no tag is requested', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(
				ok([article('a', ['Hiking']), article('b', [])])
			);

			const { fetchRandom } = useArticles(1, 25, '', 'desc');
			const res = await fetchRandom(15);

			expect((res as any).data.map((a: Article) => a.id).sort()).toEqual(['a', 'b']);
		});
	});

	// a submit in the quiz modal must flip the Take Quiz button without a refresh; both are
	// separate useArticle(id) instances reading the shared store-backed score
	describe('shared quiz score', () => {
		it('a submit in one instance updates score in another instance of the same article', async () => {
			seed(article('a1'));
			useArticleStore().setQuiz('a1', [
				{
					type: 'multiple_choice',
					question: 'Q?',
					options: ['a', 'b'],
					correct_answer: 'a',
					correct_answer_index: 0
				} as ArticleQuizQuestion
			]);

			// instance A is the page button; its score starts empty
			const a = useArticle('a1', vi.fn().mockResolvedValue(fail()) as any);
			expect(a.score.value).toBeUndefined();

			// instance B is the modal; only its submit (not the construction-time score GET) returns a score
			const scoreResult = { score: 1, scorePercent: 100, total: 1, results: [] };
			const bServer = vi
				.fn()
				.mockImplementation((key: string) =>
					Promise.resolve(String(key).includes('-quiz-submit') ? ok(scoreResult) : fail())
				);
			const b = useArticle('a1', bServer as any);
			await b.submitQuiz([{ question: '', text: 'a' }]);

			// instance A sees the score with no re-fetch
			expect(a.score.value).toEqual(scoreResult);
		});
	});
});
