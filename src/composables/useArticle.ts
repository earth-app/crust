import {
	type Article,
	type ArticleQuizQuestion,
	type ArticleQuizScoreResult
} from '~/shared/types/article';
import type { SortingOption } from '~/shared/types/global';
import {
	makeAPIRequest,
	makeClientAPIRequest,
	makeServerRequest,
	paginatedAPIRequest
} from '~/shared/util';
import { useArticleStore } from '~/stores/article';
import { useAuthStore } from '~/stores/auth';

export function useArticle(id: string) {
	const articleStore = useArticleStore();
	const authStore = useAuthStore();

	const article = computed(() => articleStore.get(id) || null);

	const fetch = async () => {
		await articleStore.fetchArticle(id);
	};

	const quiz = computed(() => articleStore.getQuiz(id));
	const quizSummary = computed(() => articleStore.getQuizSummary(id));

	const fetchQuiz = async () => {
		if (quiz.value !== undefined) return;
		await articleStore.fetchQuiz(id);
	};

	const score = computed(() => articleStore.getScore(id));

	const submitQuiz = async (answers: number[]) => {
		if (!quiz.value || quiz.value.length === 0) {
			throw new Error('Quiz must be loaded before submitting answers');
		}

		const quiz0 = quiz.value;

		if (answers.length !== quiz0.length) {
			throw new Error(
				`Number of answers (${answers.length}) does not match number of questions (${quiz0.length})`
			);
		}

		const answers0 = answers.map((a, i) => ({
			question: quiz0[i]!.question,
			text: quiz0[i]!.options[a]!,
			index: a
		}));

		try {
			const res = await makeServerRequest<ArticleQuizScoreResult>(
				`article-${id}-quiz-submit`,
				`/api/article/quiz`,
				authStore.sessionToken,
				{
					method: 'POST',
					body: { answers: answers0, articleId: id }
				}
			);

			if (res.success && res.data) {
				if ('message' in res.data) {
					return res;
				}

				articleStore.setQuizScore(id, res.data);
			}

			return res;
		} catch (error) {
			console.error('Error submitting quiz:', error);
			throw error;
		}
	};

	const fetchQuizScore = async () => {
		if (score.value !== undefined) return;
		await articleStore.fetchQuizScore(id);
	};

	if (score.value === undefined) {
		fetchQuizScore();
	}

	const update = async (updatedArticle: Partial<Article> & { id: string }) => {
		return await articleStore.updateArticle(updatedArticle);
	};

	const remove = async () => {
		return await articleStore.deleteArticle(id);
	};

	const getSimilar = async (count: number = 5) => {
		if (!article.value) {
			await fetch();
		}

		if (!article.value) {
			return { success: false, message: 'Article not found' };
		}

		const { getRandom } = useArticles();

		const pool = await getRandom(Math.min(count * 3, 15)).then((res) =>
			res.success ? res.data : res.message
		);

		if (!pool || typeof pool === 'string') {
			throw new Error(`Failed to fetch random articles: ${pool}`);
		}

		if ('message' in pool) {
			throw new Error(`Failed to fetch random articles: ${pool.code} ${pool.message}`);
		}

		if (!pool || pool.length === 0) {
			return { success: true, data: [] };
		}

		const res = await makeServerRequest<Article[]>(
			`article-${article.value.id}-similar_articles`,
			`/api/article/similar`,
			authStore.sessionToken,
			{
				method: 'POST',
				body: { article: article.value, count, pool }
			}
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			// load similar articles into store
			articleStore.setArticles(res.data);
		}

		return res;
	};

	const createQuiz = async () => {
		if (!article.value) {
			await fetch();
		}

		if (!article.value) {
			return { success: false, message: 'Article not found' };
		}

		const res = await makeServerRequest<ArticleQuizQuestion[]>(
			`article-${id}-create-quiz`,
			`/api/admin/createArticleQuiz`,
			authStore.sessionToken,
			{
				method: 'POST',
				body: { article: article.value }
			}
		);

		if (res.success) {
			await fetchQuiz();
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
		getSimilar,
		createQuiz
	};
}

export function useArticles(
	page: number = 1,
	limit: number = 25,
	search: string = '',
	sort: SortingOption = 'desc'
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
		if (res.success && res.data && !('message' in res.data) && Array.isArray(res.data.items)) {
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

	const getRandom = async (count: number = 3) => {
		const res = await makeClientAPIRequest<Article[]>(
			`/v2/articles/random?count=${count}`,
			authStore.sessionToken
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			// load individual articles into store
			articleStore.setArticles(res.data);
		}

		return res;
	};

	const getRecent = async (count: number = 5) => {
		const res = await makeAPIRequest<{ items: Article[] }>(
			`recent-articles-${count}`,
			`/v2/articles?sort=desc&limit=${count}`,
			authStore.sessionToken
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			// load individual articles into store
			articleStore.setArticles(res.data.items);
		}

		return res;
	};

	const getRecommended = async (count: number = 3) => {
		const { user, fetchUser } = useAuth();
		await fetchUser();

		const pool = await getRandom(Math.min(count * 3, 15)).then((res) =>
			res.success ? res.data : res.message
		);

		if (!pool || typeof pool === 'string') {
			throw new Error(`Failed to fetch random articles: ${pool}`);
		}

		if ('message' in pool) {
			throw new Error(`Failed to fetch random articles: ${pool.code} ${pool.message}`);
		}

		if (!pool || pool.length === 0) {
			return { success: true, data: [] };
		}

		const res = await makeServerRequest<Article[]>(
			`user-${user.value!.id}-article_recommendations`,
			`/api/article/recommend`,
			authStore.sessionToken,
			{
				method: 'POST',
				body: { count, pool }
			}
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			// load recommended articles into store
			articleStore.setArticles(res.data);
		}

		return res;
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
		getRandom,
		getRecent,
		getRecommended,
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
		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

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
