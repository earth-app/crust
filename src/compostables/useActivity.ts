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
	return await util.makeClientAPIRequest<{ items: Activity[]; total: number }>(
		`/v2/activities?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`,
		useCurrentSessionToken()
	);
}

export async function getRandomActivities(count: number = 3) {
	return await util.makeClientAPIRequest<Activity[]>(
		`/v2/activities/random?count=${count}`,
		useCurrentSessionToken()
	);
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
