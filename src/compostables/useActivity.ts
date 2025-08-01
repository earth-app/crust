import * as util from '~/shared/util';
import { type Activity, type WikipediaSummary, type YouTubeVideo } from '~/shared/types/activity';
import { useCurrentSessionToken } from './useLogin';

// mantle - /v1/activities
// cloud - /v1/activity

export async function getActivities(limit: number = 25, search: string = '') {
	return await util.paginatedAPIRequest<Activity>(
		null,
		'/v1/activities',
		useCurrentSessionToken(),
		{},
		limit,
		search
	);
}

export async function getActivity(id: string) {
	return await util.makeAPIRequest<Activity>(
		`activity-${id}`,
		`/v1/activities/${id}?includeAliases=true`,
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
	return await util.makeClientAPIRequest<Activity>(
		'/v1/activities/create',
		useCurrentSessionToken(),
		{
			method: 'POST',
			body: activity
		}
	);
}

export async function editActivity(activity: Activity) {
	return await util.makeClientAPIRequest<Activity>(
		`/v1/activities/${activity.id}`,
		useCurrentSessionToken(),
		{
			method: 'PATCH',
			body: activity
		}
	);
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

// Activity Icons

export const activityIcons = {
	coding: 'material-symbols:code',
	track: 'healthicons:running',
	cross_country: 'material-symbols:3k-plus',
	writing: 'material-symbols:ink-pen-rounded'
};
