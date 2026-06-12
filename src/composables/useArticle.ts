import { useArticleStore } from 'stores/article';
import { useAuthStore } from 'stores/auth';
import {
	type Article,
	type ArticleQuizAnswer,
	type ArticleQuizQuestion,
	type ArticleQuizQuestionSubmission,
	type ArticleQuizScoreResult
} from 'types/article';
import type { SortingOption } from 'types/global';
import {
	makeAPIRequest,
	makeClientAPIRequest,
	makeServerRequest,
	paginatedAPIRequest
} from 'utils';

export function useArticle(
	id: string,
	serverRequest: typeof makeServerRequest = makeServerRequest
) {
	const articleStore = useArticleStore();
	const authStore = useAuthStore();

	// Three-state: undefined = loading, null = confirmed not found, Article = loaded.
	const article = computed(() => articleStore.get(id));

	const fetch = async (force: boolean = false) => {
		await articleStore.fetchArticle(id, force);
	};

	const quiz = computed(() => articleStore.getQuiz(id));
	const quizSummary = computed(() => articleStore.getQuizSummary(id));

	const fetchQuiz = async () => {
		if (quiz.value !== undefined) return;
		await articleStore.fetchQuiz(id);
	};

	const scoreCache = reactive(new Map<string, ArticleQuizScoreResult>());
	const score = computed(() => scoreCache.get(id));

	const submitQuiz = async (answers: ArticleQuizAnswer[]) => {
		if (!article.value) {
			await fetch(true);
		}

		if (!article.value) {
			throw new Error('Article must be loaded before submitting quiz answers');
		}

		if (!quiz.value || quiz.value.length === 0) {
			throw new Error('Quiz must be loaded before submitting answers');
		}

		const quiz0 = quiz.value;

		if (answers.length !== quiz0.length) {
			throw new Error(
				`Number of answers (${answers.length}) does not match number of questions (${quiz0.length})`
			);
		}

		// stamp each answer with the matching question text so the server can pair them safely even
		// when the client renders in a different order
		const answers0: ArticleQuizAnswer[] = answers.map((a, i) => ({
			...a,
			question: quiz0[i]!.question
		}));

		const articleTypes = article.value.tags.map((t) => t.toUpperCase().replace(/\s+/g, '_'));

		try {
			const res = await serverRequest<ArticleQuizScoreResult>(
				`article-${id}-quiz-submit`,
				`/api/article/quiz`,
				authStore.sessionToken,
				{
					method: 'POST',
					body: { answers: answers0, articleId: id, articleTypes }
				}
			);

			if (valid(res)) {
				scoreCache.set(id, res.data);
			}

			return res;
		} catch (error) {
			console.error('Error submitting quiz:', error);
			throw error;
		}
	};

	const fetchQuizScore = async () => {
		if (score.value !== undefined) return;

		try {
			const authStore = useAuthStore();
			const res = await serverRequest<ArticleQuizScoreResult>(
				`article-${id}-quiz-score`,
				`/api/article/quiz?articleId=${id}`,
				authStore.sessionToken
			);

			if (valid(res)) {
				scoreCache.set(id, res.data);
				return res.data;
			}

			return null;
		} catch (error) {
			console.warn(`Failed to fetch quiz score for article ${id}:`, error);
			return null;
		}
	};

	if (import.meta.client && score.value === undefined) {
		fetchQuizScore();
	}

	const update = async (updatedArticle: Partial<Article> & { id: string }) => {
		return await articleStore.updateArticle(updatedArticle);
	};

	const remove = async () => {
		return await articleStore.deleteArticle(id);
	};

	const fetchSimilar = async (count: number = 5) => {
		if (!article.value) {
			await fetch();
		}

		if (!article.value) {
			return { success: false, message: 'Article not found' };
		}

		const { fetchRandom } = useArticles();

		const randomRes = await fetchRandom(Math.min(count * 3, 15));
		if (!valid(randomRes)) {
			return { success: true as const, data: [] as Article[], message: '' };
		}

		const pool = randomRes.data;
		if (!pool || pool.length === 0) {
			return { success: true as const, data: [] as Article[], message: '' };
		}

		// keep pool slice as a guaranteed fallback so we never blank the UI
		const poolFallback = [...pool]
			.filter((a) => a.id !== article.value!.id)
			.sort(() => Math.random() - 0.5)
			.slice(0, count);

		const res = await serverRequest<Article[]>(
			`article-${article.value.id}-similar_articles`,
			`/api/article/similar`,
			authStore.sessionToken,
			{
				method: 'POST',
				body: { article: article.value, count, pool }
			}
		);

		if (valid(res)) {
			const data = res.data && res.data.length > 0 ? res.data : poolFallback;
			articleStore.setArticles(data);
			return { ...res, data };
		}

		// upstream failed — still hand back random pool slice
		articleStore.setArticles(poolFallback);
		return { success: true as const, data: poolFallback, message: '' };
	};

	const changeQuiz = async (quiz: ArticleQuizQuestionSubmission[]) => {
		return await articleStore.changeQuiz(id, quiz);
	};

	const deleteQuiz = async () => {
		return await articleStore.deleteQuiz(id);
	};

	const generateQuiz = async () => {
		if (!article.value) {
			await fetch(true);
		}

		if (!article.value) {
			return { success: false, message: 'Article not found' };
		}

		const res = await serverRequest<ArticleQuizQuestion[]>(
			`article-${id}-create-quiz`,
			`/api/admin/createArticleQuiz`,
			authStore.sessionToken,
			{
				method: 'POST',
				body: { article: article.value }
			}
		);

		if (res.success) {
			if (Array.isArray(res.data) && res.data.length > 0) {
				articleStore.setQuiz(id, res.data);
				void articleStore.reconcileQuiz(id);
			} else {
				// nothing returned — fall back to the GET refetch
				articleStore.quizCache.delete(id);
				articleStore.quizSummaryCache.delete(id);
				await articleStore.fetchQuiz(id);
			}
		}

		return res;
	};

	return {
		article,
		fetch,
		quiz,
		quizSummary,
		fetchQuiz,
		submitQuiz,
		score,
		fetchQuizScore,
		update,
		remove,
		fetchSimilar,
		changeQuiz,
		deleteQuiz,
		generateQuiz
	};
}

export function useArticles(
	page: number = 1,
	limit: number = 25,
	search: string = '',
	sort: SortingOption = 'desc',
	serverRequest: typeof makeServerRequest = makeServerRequest
) {
	const articleStore = useArticleStore();
	const authStore = useAuthStore();
	const articles = useState<Article[]>(`articles-${search}-${page}-${limit}-${sort}`, () => []);
	const total = useState<number>(`articles-total-${search}-${page}-${limit}-${sort}`, () => 0);

	const fetch = async (
		newPage: number = page,
		newLimit: number = limit,
		newSearch: string = search
	) => {
		const res = await makeAPIRequest<{ items: Article[]; total: number }>(
			`articles-${newSearch}-${newPage}-${newLimit}-${sort}`,
			`/v2/articles?page=${newPage}&limit=${newLimit}&search=${encodeURIComponent(newSearch)}&sort=${sort}`
		);
		if (valid(res) && Array.isArray(res.data.items)) {
			articles.value = res.data.items;
			total.value = res.data.total;
			articleStore.setArticles(res.data.items);
		}
		return res;
	};

	const fetchAll = async (
		limit: number = 25,
		search: string = '',
		sort: SortingOption = 'desc'
	) => {
		return await paginatedAPIRequest<Article>(
			`/v2/articles`,
			authStore.sessionToken,
			{},
			limit,
			search,
			sort
		);
	};

	const fetchRandom = async (count: number = 3, author?: string, tags?: string | string[]) => {
		// Return cached result if still fresh
		const cached = articleStore.getRandomCached(count);
		if (cached) {
			return { success: true as const, data: cached, message: '' };
		}

		const tags0 = Array.isArray(tags) ? tags.join(',') : tags;
		const res = await makeClientAPIRequest<Article[]>(
			`/v2/articles/random?count=${count}&author=${encodeURIComponent(author || '')}&tags=${encodeURIComponent(tags0 || '')}`,
			authStore.sessionToken
		);

		if (valid(res)) {
			// load individual articles into store and cache random result
			articleStore.setArticles(res.data);
			articleStore.setRandomCached(count, res.data);
		}

		return res;
	};

	const fetchRecent = async (count: number = 5) => {
		const res = await makeAPIRequest<{ items: Article[] }>(
			`recent-articles-${count}`,
			`/v2/articles?sort=desc&limit=${count}`,
			authStore.sessionToken
		);

		if (valid(res)) {
			// load individual articles into store
			articleStore.setArticles(res.data.items);
		}

		return res;
	};

	const fetchOldest = async (count: number = 5) => {
		const res = await makeAPIRequest<{ items: Article[] }>(
			`oldest-articles-${count}`,
			`/v2/articles?sort=asc&limit=${count}`,
			authStore.sessionToken
		);

		if (valid(res)) {
			// load individual articles into store
			articleStore.setArticles(res.data.items);
		}

		return res;
	};

	const fetchRecommended = async (count: number = 3) => {
		const { user, fetchUser } = useAuth();

		if (!authStore.sessionToken) {
			return { success: false, message: 'User not authenticated' };
		}

		if (!user.value) {
			await fetchUser();
		}

		if (!user.value) {
			return { success: false, message: 'User not authenticated' };
		}

		const randomRes = await fetchRandom(Math.min(count * 3, 15));

		if (!valid(randomRes)) {
			return { success: true as const, data: [] as Article[], message: '' };
		}

		const pool = randomRes.data;
		if (!pool || pool.length === 0) {
			return { success: true as const, data: [] as Article[], message: '' };
		}

		const poolFallback = [...pool].sort(() => Math.random() - 0.5).slice(0, count);

		const res = await serverRequest<Article[]>(
			`user-${user.value.id}-article_recommendations`,
			`/api/article/recommend`,
			authStore.sessionToken,
			{
				method: 'POST',
				body: { count, pool }
			}
		);

		if (valid(res)) {
			const data = res.data && res.data.length > 0 ? res.data : poolFallback;
			articleStore.setArticles(data);
			return { ...res, data };
		}

		articleStore.setArticles(poolFallback);
		return { success: true as const, data: poolFallback, message: '' };
	};

	const create = async (
		article: Partial<Article> & { title: string; description: string; content: string }
	) => {
		return await articleStore.createArticle(article);
	};

	if (articles.value.length === 0) {
		fetch();
	}

	return {
		articles,
		total,
		fetch,
		fetchAll,
		fetchRandom,
		fetchRecent,
		fetchOldest,
		fetchRecommended,
		create
	};
}

export function useUserArticles(
	identifier: string,
	page: number = 1,
	limit: number = 25,
	sort: SortingOption = 'desc'
) {
	const articleStore = useArticleStore();
	const total = useState<number>(`user-${identifier}-articles-total`, () => 0);
	const articles = useState<Article[]>(`user-${identifier}-articles-${page}:${limit}`, () => []);

	const fetch = async (newPage: number = page, newLimit: number = limit, search: string = '') => {
		const res = await makeAPIRequest<{
			items: Article[];
			total: number;
		}>(
			`articles-${identifier}-${newPage}-${newLimit}`,
			`/v2/users/${identifier}/articles?page=${newPage}&limit=${newLimit}&sort=${sort}&search=${encodeURIComponent(search)}`
		);

		if (valid(res)) {
			articles.value = res.data.items;
			total.value = res.data.total;

			// load individual articles into store
			articleStore.setArticles(res.data.items);
		}

		return res;
	};

	if (articles.value.length === 0) {
		fetch(page, limit);
	}

	return {
		articles,
		total,
		fetch
	};
}
