import { type Article } from '~/shared/types/article';
import type { SortingOption } from '~/shared/types/global';
import type { User } from '~/shared/types/user';
import * as util from '~/shared/util';
import { useCurrentSessionToken } from './useLogin';

export async function getArticles(page: number = 1, limit: number = 25, search: string = '') {
	return await util.makeClientAPIRequest<{ items: Article[]; total: number }>(
		`/v2/articles?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`,
		useCurrentSessionToken()
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

	return await util.makeServerRequest<Article[]>(
		`user-${user.id}-article_recommendations`,
		`/api/article/recommendArticles`,
		useCurrentSessionToken(),
		{
			method: 'POST',
			body: { user, count, pool }
		}
	);
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

	return await util.makeServerRequest<Article[]>(
		`article-${article.id}-similar_articles`,
		`/api/article/similarArticles`,
		useCurrentSessionToken(),
		{
			method: 'POST',
			body: { article, count, pool }
		}
	);
}

export async function getRandomArticles(count: number = 3) {
	return await util.makeClientAPIRequest<Article[]>(
		`/v2/articles/random?count=${count}`,
		useCurrentSessionToken()
	);
}

export function useArticle(id: string) {
	const article = useState<Article | null>(`article-${id}`, () => null);

	const fetch = async () => {
		const res = await util.makeClientAPIRequest<Article>(`/v2/articles/${id}`);
		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			article.value = res.data;
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
	return await util.makeClientAPIRequest<Article>('/v2/articles', useCurrentSessionToken(), {
		method: 'POST',
		body: article
	});
}

export async function editArticle(article: Partial<Article> & { id: string }) {
	return await util.makeClientAPIRequest<Article>(
		`/v2/articles/${article.id}`,
		useCurrentSessionToken(),
		{
			method: 'PATCH',
			body: article
		}
	);
}

export async function deleteArticle(id: string) {
	return await util.makeClientAPIRequest<void>(`/v2/articles/${id}`, useCurrentSessionToken(), {
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
		const res = await util.makeClientAPIRequest<{
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
