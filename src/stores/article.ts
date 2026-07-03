import { defineStore } from 'pinia';
import type {
	Article,
	ArticleQuizQuestion,
	ArticleQuizQuestionSubmission,
	ArticleQuizScoreResult
} from 'types/article';
import type { User } from 'types/user';
import { invalidateAPICache, makeAPIRequest, makeClientAPIRequest } from 'utils';
import { reactive } from 'vue';
import { useAuthStore } from './auth';

const RANDOM_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const isValidArticle = (a: unknown): a is Article => {
	if (!a || typeof a !== 'object' || Array.isArray(a)) return false;
	const ar = a as Partial<Article>;

	if (typeof ar.id !== 'string' || !ar.id) return false;
	if (!ar.author || typeof ar.author !== 'object' || Array.isArray(ar.author)) return false;
	if (typeof (ar.author as Partial<User>).id !== 'string') return false;

	return true;
};

export const useArticleStore = defineStore('article', () => {
	const MAX_CACHE_SIZE = 100; // Limit cache to prevent memory leaks
	// null marks "fetched and confirmed not found / failed".
	const cache = reactive(new Map<string, Article | null>());
	const loading = reactive(new Set<string>());
	const fetchQueue = new Map<string, Promise<void>>();

	const quizCache = reactive(new Map<string, ArticleQuizQuestion[]>());
	const quizSummaryCache = reactive(
		new Map<
			string,
			{
				total: number;
				multiple_choice_count: number;
				multi_select_count: number;
				true_false_count: number;
				order_count: number;
			}
		>()
	);
	// quiz scores live in the store (not per-composable) so the Take Quiz button and the quiz
	// modal share one source of truth — a submit in the modal flips the button without a refresh
	const quizScoreCache = reactive(new Map<string, ArticleQuizScoreResult>());
	const randomCache = reactive(new Map<string, { items: Article[]; timestamp: number }>());

	// LRU cache eviction
	const evictOldestIfNeeded = () => {
		if (cache.size >= MAX_CACHE_SIZE) {
			const firstKey = cache.keys().next().value;
			if (firstKey) {
				cache.delete(firstKey);
				quizCache.delete(firstKey);
				quizSummaryCache.delete(firstKey);
				quizScoreCache.delete(firstKey);
			}
		}
	};

	const get = (id: string): Article | null | undefined => {
		if (!id) return undefined;
		if (loading.has(id) && !cache.get(id)) return undefined;
		return cache.get(id);
	};

	const has = (id: string): boolean => {
		return cache.has(id);
	};

	const isLoading = (id: string | null | undefined): boolean => {
		if (!id) return false;
		return loading.has(id);
	};

	// variant discriminates author/tag-filtered pulls so they don't collide on count alone
	const getRandomCached = (count: number, variant: string = ''): Article[] | null => {
		const entry = randomCache.get(`random-${count}-${variant}`);
		if (entry && Date.now() - entry.timestamp < RANDOM_CACHE_TTL) {
			return entry.items;
		}
		return null;
	};

	const setRandomCached = (count: number, items: Article[], variant: string = '') => {
		randomCache.set(`random-${count}-${variant}`, { items, timestamp: Date.now() });
	};

	const getQuiz = (id: string): ArticleQuizQuestion[] | undefined => {
		return quizCache.get(id);
	};

	const summarizeQuiz = (qs: ArticleQuizQuestion[]) => ({
		total: qs.length,
		multiple_choice_count: qs.filter((q) => q.type === 'multiple_choice').length,
		multi_select_count: qs.filter((q) => q.type === 'multi_select').length,
		true_false_count: qs.filter((q) => q.type === 'true_false').length,
		order_count: qs.filter((q) => q.type === 'order').length
	});

	const setQuiz = (id: string, questions: ArticleQuizQuestion[]) => {
		quizCache.set(id, questions);
		quizSummaryCache.set(id, summarizeQuiz(questions));
	};

	const reconcileQuiz = async (id: string): Promise<void> => {
		try {
			const authStore = useAuthStore();
			const res = await makeAPIRequest<{
				questions: ArticleQuizQuestion[];
				summary: ReturnType<typeof summarizeQuiz>;
			}>(null, `/v2/articles/${id}/quiz`, authStore.sessionToken);

			if (valid(res) && Array.isArray(res.data.questions) && res.data.questions.length > 0) {
				quizCache.set(id, res.data.questions);
				quizSummaryCache.set(id, res.data.summary);
			}
		} catch {
			// keep the response-populated quiz as the backup
		}
	};

	const getQuizSummary = (
		id: string
	): { total: number; multiple_choice_count: number; true_false_count: number } | undefined => {
		return quizSummaryCache.get(id);
	};

	const getQuizScore = (id: string): ArticleQuizScoreResult | undefined => {
		return quizScoreCache.get(id);
	};

	const setQuizScore = (id: string, result: ArticleQuizScoreResult) => {
		quizScoreCache.set(id, result);
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

		// force must also blow away the shared util-level apiCache; in the browser
		// isApiCacheDisabled() is false (no process.env) so a stale cached body persists
		if (force) invalidateAPICache(`article-${id}`);

		loading.add(id);

		const fetchPromise = (async () => {
			try {
				const authStore = useAuthStore();

				const res = await makeAPIRequest<Article>(
					`article-${id}`,
					`/v2/articles/${id}`,
					authStore.sessionToken
				);

				if (valid(res) && isValidArticle(res.data)) {
					evictOldestIfNeeded();
					cache.set(id, res.data);
				} else {
					cache.set(id, null);
					if (valid(res)) {
						console.warn(`Malformed article payload for ${id} — treating as not found`);
					} else if (res.message) {
						console.warn(`Failed to fetch article ${id}:`, res.message);
					}
				}
			} catch (error) {
				cache.set(id, null);
				console.warn(`Failed to fetch article ${id}:`, error);
			} finally {
				loading.delete(id);
				fetchQueue.delete(id);
			}
		})();

		fetchQueue.set(id, fetchPromise);
		await fetchPromise;

		return cache.get(id) || null;
	};

	const setArticles = (articles: Article[]) => {
		for (const article of articles) {
			if (!isValidArticle(article)) continue;
			if (cache.get(article.id)) continue;
			cache.set(article.id, article);
		}
	};

	const fetchQuiz = async (id: string): Promise<ArticleQuizQuestion[] | null> => {
		try {
			const authStore = useAuthStore();
			const res = await makeAPIRequest<{
				questions: ArticleQuizQuestion[];
				summary: {
					total: number;
					multiple_choice_count: number;
					multi_select_count: number;
					true_false_count: number;
					order_count: number;
				};
			}>(`article-${id}-quiz`, `/v2/articles/${id}/quiz`, authStore.sessionToken);

			if (valid(res)) {
				quizCache.set(id, res.data.questions);
				quizSummaryCache.set(id, res.data.summary);
				return res.data.questions;
			} else {
				console.warn(`Failed to fetch quiz for article ${id}:`, res.message);
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
				const stem = question.question || '';

				if (question.type === 'true_false') {
					return {
						type: 'true_false' as const,
						question: stem,
						options: ['True', 'False'] as const,
						correct_answer: question.correct_answer === 'True' ? 'True' : 'False'
					};
				}

				if (question.type === 'multi_select') {
					const opts = (question.options ?? []).map((o) => o || '').slice(0, 6);
					while (opts.length < 3) opts.push('');
					const correct = question.correct_answers.filter((a) => opts.includes(a));
					return {
						type: 'multi_select' as const,
						question: stem,
						options: opts,
						correct_answers: correct
					};
				}

				if (question.type === 'order') {
					const items = (question.items ?? []).map((s) => s || '').slice(0, 6);
					while (items.length < 3) items.push('');
					return {
						type: 'order' as const,
						question: stem,
						items
					};
				}

				const options = (question.options ?? []).map((option) => option || '').slice(0, 6);
				while (options.length < 2) options.push('');

				const correctAnswer = options.includes(question.correct_answer)
					? question.correct_answer
					: '';

				return {
					type: 'multiple_choice' as const,
					question: stem,
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

			if (valid(res)) {
				quizCache.set(id, res.data.questions);
				quizSummaryCache.set(id, summarizeQuiz(res.data.questions));
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
			} else {
				console.warn(`Failed to delete quiz for article ${id}:`, res.message);
			}
		} catch (error) {
			console.warn(`Failed to delete quiz for article ${id}:`, error);
		}
	};

	const createArticle = async (
		article: Partial<Article> & { title: string; description: string; content: string }
	) => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<Article>('/v2/articles', authStore.sessionToken, {
			method: 'POST',
			body: article
		});

		if (valid(res)) {
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

		if (valid(res)) {
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
		}

		return res;
	};

	const clear = (id?: string) => {
		if (id) {
			cache.delete(id);
			quizCache.delete(id);
			quizSummaryCache.delete(id);
			quizScoreCache.delete(id);
		} else {
			cache.clear();
			quizCache.clear();
			quizSummaryCache.clear();
			quizScoreCache.clear();
		}
	};

	return {
		cache,
		quizCache,
		quizSummaryCache,
		quizScoreCache,
		get,
		has,
		isLoading,
		getRandomCached,
		setRandomCached,
		getQuiz,
		getQuizSummary,
		getQuizScore,
		setQuizScore,
		setQuiz,
		reconcileQuiz,
		fetchArticle,
		setArticles,
		fetchQuiz,
		changeQuiz,
		deleteQuiz,
		createArticle,
		updateArticle,
		deleteArticle,
		clear
	};
});
