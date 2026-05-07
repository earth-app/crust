import { defineStore } from 'pinia';
import type {
	Article,
	ArticleQuizQuestion,
	ArticleQuizQuestionSubmission,
	ArticleQuizScoreResult
} from 'types/article';
import { makeAPIRequest, makeClientAPIRequest, makeServerRequest } from 'utils';
import { reactive } from 'vue';
import { useAuthStore } from './auth';

const RANDOM_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const useArticleStore = defineStore('article', () => {
	const MAX_CACHE_SIZE = 100; // Limit cache to prevent memory leaks
	const cache = reactive(new Map<string, Article>());
	const fetchQueue = new Map<string, Promise<void>>();

	const quizCache = reactive(new Map<string, ArticleQuizQuestion[]>());
	const quizSummaryCache = reactive(
		new Map<string, { total: number; multiple_choice_count: number; true_false_count: number }>()
	);
	const scoreCache = reactive(new Map<string, ArticleQuizScoreResult>());
	const randomCache = reactive(new Map<string, { items: Article[]; timestamp: number }>());

	// LRU cache eviction
	const evictOldestIfNeeded = () => {
		if (cache.size >= MAX_CACHE_SIZE) {
			const firstKey = cache.keys().next().value;
			if (firstKey) {
				cache.delete(firstKey);
				quizCache.delete(firstKey);
				quizSummaryCache.delete(firstKey);
				scoreCache.delete(firstKey);
			}
		}
	};

	const get = (id: string): Article | undefined => {
		return cache.get(id);
	};

	const has = (id: string): boolean => {
		return cache.has(id);
	};

	const getRandomCached = (count: number): Article[] | null => {
		const entry = randomCache.get(`random-${count}`);
		if (entry && Date.now() - entry.timestamp < RANDOM_CACHE_TTL) {
			return entry.items;
		}
		return null;
	};

	const setRandomCached = (count: number, items: Article[]) => {
		randomCache.set(`random-${count}`, { items, timestamp: Date.now() });
	};

	const getQuiz = (id: string): ArticleQuizQuestion[] | undefined => {
		return quizCache.get(id);
	};

	const getQuizSummary = (
		id: string
	): { total: number; multiple_choice_count: number; true_false_count: number } | undefined => {
		return quizSummaryCache.get(id);
	};

	const getScore = (id: string): ArticleQuizScoreResult | undefined => {
		return scoreCache.get(id);
	};

	const fetchArticle = async (id: string, force: boolean = false): Promise<Article | null> => {
		if (!id) return null;

		if (cache.has(id) && !force && !fetchQueue.has(id)) {
			return cache.get(id)!;
		}

		const existingFetch = fetchQueue.get(id);
		if (existingFetch && !force) {
			await existingFetch;
			return cache.get(id) || null;
		}

		const fetchPromise = (async () => {
			try {
				const authStore = useAuthStore();

				const res = await makeAPIRequest<Article>(
					`article-${id}`,
					`/v2/articles/${id}`,
					authStore.sessionToken
				);

				if (res.success && res.data) {
					if ('message' in res.data || 'error' in (res.data as any) || !('id' in res.data)) {
						console.warn(`Failed to fetch article ${id}:`, res.data);
						return;
					}
					evictOldestIfNeeded();
					cache.set(id, res.data);
				} else {
					console.warn(`Failed to fetch article ${id}:`, res.message);
				}
			} catch (error) {
				console.warn(`Failed to fetch article ${id}:`, error);
			} finally {
				fetchQueue.delete(id);
			}
		})();

		fetchQueue.set(id, fetchPromise);
		await fetchPromise;

		return cache.get(id) || null;
	};

	const setArticles = (articles: Article[]) => {
		for (const article of articles) {
			cache.set(article.id, article);
		}
	};

	const fetchQuiz = async (id: string): Promise<ArticleQuizQuestion[] | null> => {
		try {
			const authStore = useAuthStore();
			const res = await makeAPIRequest<{
				questions: ArticleQuizQuestion[];
				summary: { total: number; multiple_choice_count: number; true_false_count: number };
			}>(`article-${id}-quiz`, `/v2/articles/${id}/quiz`, authStore.sessionToken);

			if (res.success && res.data) {
				if ('message' in res.data) {
					quizCache.set(id, []);
					return null;
				}

				quizCache.set(id, res.data.questions);
				quizSummaryCache.set(id, res.data.summary);
				return res.data.questions;
			}

			quizCache.set(id, []);
			return null;
		} catch (error) {
			console.warn(`Failed to fetch quiz for article ${id}:`, error);
			quizCache.set(id, []);
			return null;
		}
	};

	const changeQuiz = async (id: string, quiz: ArticleQuizQuestionSubmission[]) => {
		try {
			const authStore = useAuthStore();
			const normalizedQuiz = quiz.map((question) => {
				if (question.type === 'true_false') {
					return {
						type: 'true_false' as const,
						question: question.question || '',
						options: ['True', 'False'] as const,
						correct_answer: question.correct_answer === 'True' ? 'True' : 'False'
					};
				}

				const options = (question.options || []).map((option) => option || '').slice(0, 6);
				while (options.length < 2) {
					options.push('');
				}

				const correctAnswer = options.includes(question.correct_answer)
					? question.correct_answer
					: '';

				return {
					type: 'multiple_choice' as const,
					question: question.question || '',
					options,
					correct_answer: correctAnswer
				};
			});

			const res = await makeAPIRequest<{
				message: string;
				questions: ArticleQuizQuestion[];
			}>(`article-${id}-quiz-update`, `/v2/articles/${id}/quiz`, authStore.sessionToken, {
				method: 'POST',
				body: { questions: normalizedQuiz }
			});

			if (res.success && res.data) {
				if ('code' in res.data) {
					console.warn(`Failed to update quiz for article ${id}:`, res.data);
					return { success: false, message: res.data.message };
				}

				quizCache.set(id, res.data.questions);
				quizSummaryCache.set(id, {
					total: res.data.questions.length,
					multiple_choice_count: res.data.questions.filter((q) => q.type === 'multiple_choice')
						.length,
					true_false_count: res.data.questions.filter((q) => q.type === 'true_false').length
				});
			} else {
				console.warn(`Failed to update quiz for article ${id}:`, res.message);
			}

			return res;
		} catch (error) {
			console.warn(`Failed to update quiz for article ${id}:`, error);
			return { success: false, message: 'Failed to update quiz.' };
		}
	};

	const deleteQuiz = async (id: string) => {
		try {
			const authStore = useAuthStore();
			const res = await makeAPIRequest<{ message: string }>(
				`article-${id}-quiz-delete`,
				`/v2/articles/${id}/quiz`,
				authStore.sessionToken,
				{ method: 'DELETE' }
			);

			if (res.success) {
				quizCache.delete(id);
				quizSummaryCache.delete(id);
				scoreCache.delete(id);
			} else {
				console.warn(`Failed to delete quiz for article ${id}:`, res.message);
			}
		} catch (error) {
			console.warn(`Failed to delete quiz for article ${id}:`, error);
		}
	};

	const fetchQuizScore = async (id: string): Promise<ArticleQuizScoreResult | null> => {
		try {
			const authStore = useAuthStore();
			const res = await makeServerRequest<ArticleQuizScoreResult>(
				`article-${id}-quiz-score`,
				`/api/article/quiz?articleId=${id}`,
				authStore.sessionToken
			);

			if (res.success && res.data) {
				if ('message' in res.data) {
					return null;
				}

				scoreCache.set(id, res.data);
				return res.data;
			}

			return null;
		} catch (error) {
			console.warn(`Failed to fetch quiz score for article ${id}:`, error);
			return null;
		}
	};

	const setQuizScore = (id: string, score: ArticleQuizScoreResult) => {
		scoreCache.set(id, score);
	};

	const createArticle = async (
		article: Partial<Article> & { title: string; description: string; content: string }
	) => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<Article>('/v2/articles', authStore.sessionToken, {
			method: 'POST',
			body: article
		});

		if (res.success && res.data && !('message' in res.data)) {
			cache.set(res.data.id, res.data);
		}

		return res;
	};

	const updateArticle = async (article: Partial<Article> & { id: string }) => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<Article>(
			`/v2/articles/${article.id}`,
			authStore.sessionToken,
			{
				method: 'PATCH',
				body: article
			}
		);

		if (res.success && res.data && !('message' in res.data)) {
			cache.set(res.data.id, res.data);
		}

		return res;
	};

	const deleteArticle = async (id: string) => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<void>(`/v2/articles/${id}`, authStore.sessionToken, {
			method: 'DELETE'
		});

		if (res.success) {
			cache.delete(id);
			quizCache.delete(id);
			quizSummaryCache.delete(id);
			scoreCache.delete(id);
		}

		return res;
	};

	const clear = (id?: string) => {
		if (id) {
			cache.delete(id);
			quizCache.delete(id);
			quizSummaryCache.delete(id);
			scoreCache.delete(id);
		} else {
			cache.clear();
			quizCache.clear();
			quizSummaryCache.clear();
			scoreCache.clear();
		}
	};

	return {
		cache,
		quizCache,
		quizSummaryCache,
		scoreCache,
		get,
		has,
		getRandomCached,
		setRandomCached,
		getQuiz,
		getQuizSummary,
		getScore,
		fetchArticle,
		setArticles,
		fetchQuiz,
		fetchQuizScore,
		changeQuiz,
		deleteQuiz,
		setQuizScore,
		createArticle,
		updateArticle,
		deleteArticle,
		clear
	};
});
