import { createPinia, setActivePinia } from 'pinia';
import { useArticleStore } from 'stores/article';
import type { Article, ArticleQuizScoreResult } from 'types/article';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// the random cache stores items opaquely (no validation on this path), so a thin
// stub keyed by id is enough to assert which bucket a lookup resolves to
function stubArticles(...ids: string[]): Article[] {
	return ids.map((id) => ({ id }) as unknown as Article);
}

const ids = (items: Article[] | null) => (items ?? []).map((a) => a.id);

// minimal well-formed article: id + author with an id is all isValidArticle checks
function makeArticle(id: string, extra: Partial<Article> = {}): Article {
	return { id, author: { id: `author-${id}` }, ...extra } as unknown as Article;
}

describe('article store setArticles', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it('caches a well-formed article and rejects a partial (author: []) one', () => {
		const store = useArticleStore();
		store.setArticles([makeArticle('a1'), { id: 'bad', author: [] } as unknown as Article]);
		expect(store.has('a1')).toBe(true);
		expect(store.has('bad')).toBe(false);
	});

	it('does not let setArticles overwrite an already-cached article', () => {
		const store = useArticleStore();
		store.cache.set('a1', makeArticle('a1', { content: 'full' } as Partial<Article>));
		store.setArticles([makeArticle('a1', { content: '' } as Partial<Article>)]);
		expect((store.get('a1') as any).content).toBe('full');
	});

	it('still seeds articles not yet cached via setArticles', () => {
		const store = useArticleStore();
		store.cache.set('a1', makeArticle('a1'));
		store.setArticles([makeArticle('a1'), makeArticle('a2')]);
		expect(store.has('a2')).toBe(true);
	});
});

describe('article store random cache', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it('keeps separate buckets per variant at the same count', () => {
		const store = useArticleStore();

		store.setRandomCached(15, stubArticles('plain-1', 'plain-2'), '');
		store.setRandomCached(15, stubArticles('cloud-1', 'cloud-2'), '1:');
		store.setRandomCached(15, stubArticles('hiking-1', 'hiking-2'), ':hiking');

		expect(ids(store.getRandomCached(15, ''))).toEqual(['plain-1', 'plain-2']);
		expect(ids(store.getRandomCached(15, '1:'))).toEqual(['cloud-1', 'cloud-2']);
		expect(ids(store.getRandomCached(15, ':hiking'))).toEqual(['hiking-1', 'hiking-2']);
	});

	// the regression: before the fix every count-15 pull shared one bucket, so a tag
	// lookup returned whatever the plain random pull had cached
	it('does not leak one variant into another at the same count', () => {
		const store = useArticleStore();

		store.setRandomCached(15, stubArticles('plain-1'), '');

		expect(store.getRandomCached(15, ':hiking')).toBeNull();
		expect(store.getRandomCached(15, '1:')).toBeNull();
	});

	it('distinguishes two different tags', () => {
		const store = useArticleStore();

		store.setRandomCached(15, stubArticles('h-1'), ':hiking');
		store.setRandomCached(15, stubArticles('c-1'), ':cycling');

		expect(ids(store.getRandomCached(15, ':hiking'))).toEqual(['h-1']);
		expect(ids(store.getRandomCached(15, ':cycling'))).toEqual(['c-1']);
	});

	it('still keys on count within a variant', () => {
		const store = useArticleStore();

		store.setRandomCached(10, stubArticles('ten'), ':hiking');
		store.setRandomCached(15, stubArticles('fifteen'), ':hiking');

		expect(ids(store.getRandomCached(10, ':hiking'))).toEqual(['ten']);
		expect(ids(store.getRandomCached(15, ':hiking'))).toEqual(['fifteen']);
	});

	it('defaults the variant to the empty bucket', () => {
		const store = useArticleStore();

		// no variant passed should map to the same bucket as an explicit empty string
		store.setRandomCached(15, stubArticles('default'));
		expect(ids(store.getRandomCached(15))).toEqual(['default']);
		expect(ids(store.getRandomCached(15, ''))).toEqual(['default']);
	});

	describe('ttl', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});
		afterEach(() => {
			vi.useRealTimers();
		});

		it('returns null once the entry is older than the TTL', () => {
			const store = useArticleStore();
			store.setRandomCached(15, stubArticles('fresh'), ':hiking');

			// just inside the 5-minute window
			vi.advanceTimersByTime(4 * 60 * 1000);
			expect(ids(store.getRandomCached(15, ':hiking'))).toEqual(['fresh']);

			// past it
			vi.advanceTimersByTime(2 * 60 * 1000);
			expect(store.getRandomCached(15, ':hiking')).toBeNull();
		});
	});
});

// quiz scores live in the store so the Take Quiz button and the quiz modal (two separate
// useArticle(id) instances) share one source of truth
describe('article store quiz score cache', () => {
	const result = (n: number) => ({ score: n }) as unknown as ArticleQuizScoreResult;

	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it('round-trips a score', () => {
		const store = useArticleStore();
		expect(store.getQuizScore('a1')).toBeUndefined();
		store.setQuizScore('a1', result(1));
		expect(store.getQuizScore('a1')).toEqual(result(1));
	});

	it('clear(id) drops only that score', () => {
		const store = useArticleStore();
		store.setQuizScore('a1', result(1));
		store.setQuizScore('a2', result(2));

		store.clear('a1');
		expect(store.getQuizScore('a1')).toBeUndefined();
		expect(store.getQuizScore('a2')).toEqual(result(2));
	});

	it('clear() drops every score', () => {
		const store = useArticleStore();
		store.setQuizScore('a1', result(1));
		store.setQuizScore('a2', result(2));

		store.clear();
		expect(store.getQuizScore('a1')).toBeUndefined();
		expect(store.getQuizScore('a2')).toBeUndefined();
	});
});
