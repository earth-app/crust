import { type Activity, type WikipediaSummary, type YouTubeVideo } from '~/shared/types/activity';
import * as util from '~/shared/util';
import { useCurrentSessionToken } from './useLogin';

// mantle - /v2/activities
// cloud - /v1/activity

export async function getAllActivities(limit: number = 25, search: string = '') {
	return await util.paginatedAPIRequest<Activity>(
		null,
		'/v2/activities',
		useCurrentSessionToken(),
		{},
		limit,
		search
	);
}

export async function getActivities(page: number = 1, limit: number = 25, search: string = '') {
	const res = await util.makeClientAPIRequest<{ items: Activity[]; total: number }>(
		`/v2/activities?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`,
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
	return await util.makeClientAPIRequest<{ items: string[]; total: number }>(
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
	const res = await util.makeClientAPIRequest<Activity[]>(
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
	return await util.makeAPIRequest<Activity>(
		`activity-${id}`,
		`/v2/activities/${id}?include_aliases=true`,
		useCurrentSessionToken()
	);
}

export async function draftActivity(id: string) {
	return await util.makeServerRequest<Activity>(
		`draft-activity-${id}`,
		`/api/admin/draftActivity?id=${id}`,
		useCurrentSessionToken()
	);
}

export async function newActivity(activity: Activity) {
	return await util.makeClientAPIRequest<Activity>('/v2/activities', useCurrentSessionToken(), {
		method: 'POST',
		body: activity
	});
}

export async function editActivity(activity: Activity) {
	return await util.makeClientAPIRequest<Activity>(
		`/v2/activities/${activity.id}`,
		useCurrentSessionToken(),
		{
			method: 'PATCH',
			body: activity
		}
	);
}

export async function deleteActivity(id: string) {
	return await util.makeClientAPIRequest<void>(`/v2/activities/${id}`, useCurrentSessionToken(), {
		method: 'DELETE'
	});
}

// Activity Information Extensions

export async function getActivityWikipediaSummary(title: string) {
	return await util.makeServerRequest<WikipediaSummary>(
		`wikipedia-summary-${title}`,
		`/api/activity/wikipedia?title=${encodeURIComponent(title)}`,
		useCurrentSessionToken()
	);
}

export async function getActivityYouTubeSearch(query: string) {
	return await util.makeServerRequest<YouTubeVideo[]>(
		`youtube-search-${query}`,
		`/api/activity/youtubeSearch?query=${encodeURIComponent(query)}`,
		useCurrentSessionToken()
	);
}

export async function getActivityWikipediaSearches(queries: string[]) {
	const results: Record<string, WikipediaSummary> = {};
	const responses = await Promise.all(
		queries.map(async (query) => {
			return await util
				.makeServerRequest<{
					query: { search: { title: string; snippet: string }[] };
				}>(
					`wikipedia-search-${query}`,
					`/api/activity/wikipediaSearch?search=${encodeURIComponent(query)}`,
					useCurrentSessionToken()
				)
				.then((res) => {
					if (res.success) {
						return res.data?.query.search || [];
					}

					return [];
				});
		})
	)
		.then((res) => res.flat())
		.then((responses) => responses.filter((r) => r.title?.trim() !== ''));

	for (const r of responses) {
		if (r.title && !results[r.title]) {
			try {
				const res = await getActivityWikipediaSummary(r.title);
				if (res.success && res.data) {
					if (res.data.type === 'disambiguation') continue; // Skip disambiguation pages

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
				}
			} catch (error) {
				// Ignore errors for individual summaries
			}
		}
	}

	return results;
}

export async function getActivityIconSearches(queries: string[]) {
	const results: Record<string, string[]> = {};
	await Promise.all(
		queries.map(async (query) => {
			if (results[query]) return; // Already fetched

			try {
				const res = await util.makeServerRequest<{ icons: string[]; total: number }>(
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
