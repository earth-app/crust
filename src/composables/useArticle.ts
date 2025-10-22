import { type Article } from '~/shared/types/article';
import type { User } from '~/shared/types/user';
import * as util from '~/shared/util';
import { useCurrentSessionToken } from './useLogin';

export async function getAllArticles(limit: number = 25, search: string = '') {
	return await util.paginatedAPIRequest<Article>(
		null,
		'/v2/articles',
		useCurrentSessionToken(),
		{},
		limit,
		search
	);
}

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

	if (typeof pool === 'string') {
		throw new Error(`Failed to fetch random articles: ${pool}`);
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

	if (typeof pool === 'string') {
		throw new Error(`Failed to fetch random articles: ${pool}`);
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

export async function getArticle(id: string) {
	return await util.makeAPIRequest<Article>(
		`article-${id}`,
		`/v2/articles/${id}`,
		useCurrentSessionToken()
	);
}

export async function newArticle(
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
