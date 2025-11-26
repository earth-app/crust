import { type Article } from '~/shared/types/article';
import type { SortingOption } from '~/shared/types/global';
import type { User } from '~/shared/types/user';
import { makeClientAPIRequest, makeServerRequest, paginatedAPIRequest } from '~/shared/util';
import { useCurrentSessionToken } from './useLogin';

export async function getArticles(
	limit: number = 25,
	search: string = '',
	sort: SortingOption = 'desc'
) {
	return await paginatedAPIRequest<Article>(
		`articles-${search}-${limit}`,
		`/v2/articles`,
		useCurrentSessionToken(),
		{},
		limit,
		search,
		sort
	);
}

export async function getRecommendedArticles(user: User, count: number = 3) {
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
		`user-${user.id}-article_recommendations`,
		`/api/article/recommend`,
		useCurrentSessionToken(),
		{
			method: 'POST',
			body: { user, count, pool }
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

export function useArticle(id: string) {
	const article = useState<Article | null | undefined>(`article-${id}`, () => undefined);

	const fetch = async () => {
		if (article.value !== undefined) return;
		const res = await makeClientAPIRequest<Article>(`/v2/articles/${id}`);
		if (res.success && res.data) {
			if ('message' in res.data) {
				article.value = null;
				return res;
			}

			article.value = res.data;
		} else {
			article.value = null;
		}

		return res;
	};

	if (!article.value) {
		fetch();
	}

	return {
		article,
		fetch
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

	const fetch = async (newPage: number = page, newLimit: number = limit) => {
		const res = await makeClientAPIRequest<{
			items: Article[];
			total: number;
		}>(`/v2/users/${identifier}/articles?page=${newPage}&limit=${newLimit}&sort=${sort}`);
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
