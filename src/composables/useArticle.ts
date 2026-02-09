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
import { useCurrentSessionToken } from './useLogin';

export async function getArticles(
	limit: number = 25,
	search: string = '',
	sort: SortingOption = 'desc'
) {
	return await paginatedAPIRequest<Article>(
		`/v2/articles`,
		useCurrentSessionToken(),
		{},
		limit,
		search,
		sort
	);
}

export async function getRecommendedArticles(count: number = 3) {
	const { user, fetchUser } = useAuth();
	await fetchUser();

	const pool = await getRandomArticles(Math.min(count * 3, 15)).then((res) =>
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
		useCurrentSessionToken(),
		{
			method: 'POST',
			body: { count, pool }
		}
	);

	if (res.success && res.data) {
		if ('message' in res.data) {
			return res;
		}

		// load recommended articles into state
		for (const article of res.data) {
			useState<Article | null>(`article-${article.id}`, () => article);
		}
	}

	return res;
}

export async function getSimilarArticles(article: Article, count: number = 5) {
	const pool = await getRandomArticles(Math.min(count * 3, 15)).then((res) =>
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
		`article-${article.id}-similar_articles`,
		`/api/article/similar`,
		useCurrentSessionToken(),
		{
			method: 'POST',
			body: { article, count, pool }
		}
	);

	if (res.success && res.data) {
		if ('message' in res.data) {
			return res;
		}

		// load similar articles into state
		for (const similarArticle of res.data) {
			useState<Article | null>(`article-${similarArticle.id}`, () => similarArticle);
		}
	}

	return res;
}

export async function getRandomArticles(count: number = 3) {
	const res = await makeClientAPIRequest<Article[]>(
		`/v2/articles/random?count=${count}`,
		useCurrentSessionToken()
	);

	if (res.success && res.data) {
		if ('message' in res.data) {
			return res;
		}

		// load individual articles into state
		for (const article of res.data) {
			useState<Article | null>(`article-${article.id}`, () => article);
		}
	}

	return res;
}

export async function getRecentArticles(count: number = 5) {
	const res = await makeClientAPIRequest<{ items: Article[] }>(
		`/v2/articles?sort=desc&limit=${count}`,
		useCurrentSessionToken()
	);

	if (res.success && res.data) {
		if ('message' in res.data) {
			return res;
		}

		// load individual articles into state
		for (const article of res.data.items) {
			useState<Article | null>(`article-${article.id}`, () => article);
		}
	}

	return res;
}

export function useArticle(id: string) {
	const article = useState<Article | null | undefined>(`article-${id}`, () => undefined);

	const fetch = async () => {
		if (article.value !== undefined) return;
		try {
			const res = await makeAPIRequest<Article>(
				`article-${id}`,
				`/v2/articles/${id}`,
				useCurrentSessionToken()
			);
			if (res.success && res.data) {
				// Check if it's an error response or missing required fields
				if ('message' in res.data || 'error' in (res.data as any) || !('id' in res.data)) {
					article.value = null;
					return res;
				}

				article.value = res.data;
			} else {
				article.value = null;
			}

			return res;
		} catch (error) {
			console.error('Error fetching article:', error);
			article.value = null;
		}
	};

	if (!article.value) {
		fetch();
	}

	const quiz = useState<ArticleQuizQuestion[] | null | undefined>(
		`article-${id}-quiz`,
		() => undefined
	);
	const quizSummary = useState<{
		total: number;
		multiple_choice_count: number;
		true_false_count: number;
	} | null>(`article-${id}-quiz_summary`, () => null);

	const fetchQuiz = async () => {
		if (quiz.value !== undefined) return;

		try {
			const res = await makeAPIRequest<{
				questions: ArticleQuizQuestion[];
				summary: { total: number; multiple_choice_count: number; true_false_count: number };
			}>(`article-${id}-quiz`, `/v2/articles/${id}/quiz`, useCurrentSessionToken());
			if (res.success && res.data) {
				if ('message' in res.data) {
					// Quiz doesn't exist for this article
					quiz.value = null;
					quizSummary.value = null;
					return res;
				}

				quiz.value = res.data.questions;
				quizSummary.value = res.data.summary;
			} else {
				// Error fetching quiz
				quiz.value = null;
				quizSummary.value = null;
			}

			return res;
		} catch (error) {
			console.error('Error fetching quiz:', error);
			quiz.value = null;
			quizSummary.value = null;
		}
	};

	if (quiz.value === undefined) {
		fetchQuiz();
	}

	const score = useState<ArticleQuizScoreResult | null | undefined>(
		`article-${id}-quiz-score`,
		() => undefined
	);

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
				useCurrentSessionToken(),
				{
					method: 'POST',
					body: { answers: answers0, articleId: id }
				}
			);

			if (res.success && res.data) {
				if ('message' in res.data) {
					return res;
				}

				score.value = res.data;
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
			const res = await makeServerRequest<ArticleQuizScoreResult>(
				`article-${id}-quiz-score`,
				`/api/article/quiz?articleId=${id}`,
				useCurrentSessionToken()
			);

			if (res.success && res.data) {
				if ('message' in res.data) {
					// No score exists yet
					score.value = null;
					return res;
				}

				score.value = res.data;
			} else {
				// Error or no score
				score.value = null;
			}

			return res;
		} catch (error) {
			console.error('Error fetching quiz score:', error);
			score.value = null;
		}
	};

	if (score.value === undefined) {
		fetchQuizScore();
	}

	return {
		article,
		fetch,
		quiz,
		quizSummary,
		fetchQuiz,
		submitQuiz,
		score,
		fetchQuizScore
	};
}

export async function createArticle(
	article: Partial<Article> & { title: string; description: string; content: string }
) {
	return await makeClientAPIRequest<Article>('/v2/articles', useCurrentSessionToken(), {
		method: 'POST',
		body: article
	});
}

export async function editArticle(article: Partial<Article> & { id: string }) {
	return await makeClientAPIRequest<Article>(
		`/v2/articles/${article.id}`,
		useCurrentSessionToken(),
		{
			method: 'PATCH',
			body: article
		}
	);
}

export async function deleteArticle(id: string) {
	return await makeClientAPIRequest<void>(`/v2/articles/${id}`, useCurrentSessionToken(), {
		method: 'DELETE'
	});
}

export function useUserArticles(
	identifier: string,
	page: number = 1,
	limit: number = 25,
	sort: SortingOption = 'desc'
) {
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

			// load individual articles into state
			for (const a of res.data.items) {
				useState<Article | null>(`article-${a.id}`, () => a);
			}
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

export async function createArticleQuiz(article: Article) {
	const res = await makeServerRequest<ArticleQuizQuestion[]>(
		`article-${article.id}-create_quiz`,
		`/api/admin/createArticleQuiz`,
		useCurrentSessionToken(),
		{
			method: 'POST',
			body: { article }
		}
	);

	return res;
}
