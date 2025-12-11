import { type Activity, type WikipediaSummary, type YouTubeVideo } from '../shared/types/activity';
import type { SortingOption } from '../shared/types/global';
import {
	makeAPIRequest,
	makeClientAPIRequest,
	makeServerRequest,
	paginatedAPIRequest
} from '../shared/util';
import { useCurrentSessionToken } from './useLogin';

// mantle - /v2/activities
// cloud - /v1/activity

export async function getAllActivities(
	limit: number = 25,
	search: string = '',
	sort: SortingOption = 'desc'
) {
	return await paginatedAPIRequest<Activity>(
		`activities-${search}-${limit}`,
		'/v2/activities',
		useCurrentSessionToken(),
		{},
		limit,
		search,
		sort
	);
}

export async function getActivities(
	page: number = 1,
	limit: number = 25,
	search: string = '',
	sort: SortingOption = 'desc'
) {
	const res = await makeAPIRequest<{ items: Activity[]; total: number }>(
		`activities-${search}-${page}-${limit}-${sort}`,
		`/v2/activities?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&sort=${sort}`,
		useCurrentSessionToken()
	);

	if (res.success && res.data) {
		if ('message' in res.data) {
			return res;
		}

		// load individual activities into state
		for (const activity of res.data.items) {
			useState<Activity | null>(`activity-${activity.id}`, () => activity);
		}
	}

	return res;
}

export async function getActivitiesList(
	page: number = 1,
	limit: number = 100,
	search: string = ''
) {
	return await makeClientAPIRequest<{ items: string[]; total: number }>(
		`/v2/activities/list?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`,
		useCurrentSessionToken()
	);
}

export function useActivitiesCount() {
	const count = useState<number | undefined>('activities-count', () => undefined);

	const fetchCount = async () => {
		const res = await getActivitiesList(1, 1);
		if (res.success && res.data) {
			if ('message' in res.data) {
				count.value = undefined;
			} else {
				count.value = res.data.total;
			}
		} else {
			count.value = undefined;
		}
	};

	if (count.value === undefined) {
		fetchCount();
	}

	return { count, refresh: fetchCount };
}

export async function getRandomActivities(count: number = 3) {
	const res = await makeClientAPIRequest<Activity[]>(
		`/v2/activities/random?count=${count}`,
		useCurrentSessionToken()
	);

	if (res.success && res.data) {
		if ('message' in res.data) {
			return res;
		}

		// load individual activities into state
		for (const activity of res.data) {
			useState<Activity | null>(`activity-${activity.id}`, () => activity);
		}
	}

	return res;
}

export async function getActivity(id: string) {
	return await makeAPIRequest<Activity>(
		`activity-${id}`,
		`/v2/activities/${id}?include_aliases=true`,
		useCurrentSessionToken()
	);
}

export async function draftActivity(id: string) {
	return await makeServerRequest<Activity>(
		`draft-activity-${id}`,
		`/api/admin/draftActivity?id=${id}`,
		useCurrentSessionToken()
	);
}

export async function newActivity(activity: Activity) {
	return await makeClientAPIRequest<Activity>('/v2/activities', useCurrentSessionToken(), {
		method: 'POST',
		body: activity
	});
}

export async function editActivity(activity: Activity) {
	return await makeClientAPIRequest<Activity>(
		`/v2/activities/${activity.id}`,
		useCurrentSessionToken(),
		{
			method: 'PATCH',
			body: activity
		}
	);
}

export async function deleteActivity(id: string) {
	return await makeClientAPIRequest<void>(`/v2/activities/${id}`, useCurrentSessionToken(), {
		method: 'DELETE'
	});
}

// Activity Information Extensions

export async function getActivityWikipediaSummary(title: string) {
	return await makeServerRequest<WikipediaSummary>(
		`wikipedia-summary-${title}`,
		`/api/activity/wikipedia?title=${encodeURIComponent(title)}`,
		useCurrentSessionToken()
	);
}

export async function getActivityYouTubeSearch(query: string) {
	return await makeServerRequest<YouTubeVideo[]>(
		`youtube-search-${query}`,
		`/api/activity/youtubeSearch?query=${encodeURIComponent(query)}`,
		useCurrentSessionToken()
	);
}

export async function getActivityWikipediaSearches(
	queries: string[],
	onArticleLoaded?: (title: string, summary: WikipediaSummary) => void
) {
	const results: Record<string, WikipediaSummary> = {};
	const responses = await Promise.all(
		queries.map(async (query) => {
			return await makeServerRequest<{
				query: { search: { title: string; snippet: string }[] };
			}>(
				`wikipedia-search-${query}`,
				`/api/activity/wikipediaSearch?search=${encodeURIComponent(query)}`,
				useCurrentSessionToken()
			).then((res) => {
				if (res.success) {
					return res.data?.query.search || [];
				}

				return [];
			});
		})
	)
		.then((res) => res.flat())
		.then((responses) => responses.filter((r) => r.title?.trim() !== ''));

	// fetch all summaries in parallel instead of sequentially
	const seenTitles = new Set<string>();
	await Promise.allSettled(
		responses.map(async (r) => {
			if (!r.title || seenTitles.has(r.title)) return;
			seenTitles.add(r.title);

			try {
				const res = await getActivityWikipediaSummary(r.title);
				if (res.success && res.data) {
					if (res.data.type === 'disambiguation') return;

					res.data.summarySnippet =
						'...' +
						r.snippet
							.replace(/<\/?span[^>]*>/g, '') // Remove any <span> tags from snippet
							.replace(/&quot;/g, '"') // Decode HTML entities
							.replace(/&lt;/g, '<')
							.replace(/&gt;/g, '>')
							.replace(/&#39;/g, "'")
							.replace(/&#039;s/g, "'s")
							.replace(/&#039;/g, "'")
							.replace(/&amp;/g, '&') // Decode &amp; last to prevent double-unescaping
							.trim() +
						'...';

					results[r.title] = res.data;

					// call callback immediately when article loads (for incremental display)
					if (onArticleLoaded) {
						onArticleLoaded(r.title, res.data);
					}
				}
			} catch (error) {
				// Ignore errors for individual summaries
			}
		})
	);

	return results;
}

export async function getActivityIconSearches(queries: string[]) {
	const results: Record<string, string[]> = {};
	await Promise.all(
		queries.map(async (query) => {
			if (results[query]) return; // Already fetched

			try {
				const res = await makeServerRequest<{ icons: string[]; total: number }>(
					`icon-search-${query}`,
					`/api/activity/iconSearch?search=${encodeURIComponent(query)}`,
					useCurrentSessionToken()
				);

				if (res.success && res.data) {
					results[query] = res.data.icons;
				} else {
					results[query] = [];
				}
			} catch (error) {
				results[query] = [];
			}
		})
	);

	return results;
}
