import { makeAPIRequest, makeServerRequest, paginatedAPIRequest } from '~/shared/util';
import { type Activity } from '~/shared/types/activity';
import { useCurrentSessionToken } from './useLogin';

// mantle - /v1/activities
// cloud - /v1/activity

export async function getActivities(limit: number = 25, search: string = '') {
	return await paginatedAPIRequest<Activity>(
		`activities-${search}-${limit}`,
		'/v1/activities',
		useCurrentSessionToken(),
		{},
		limit,
		search
	);
}

export async function getActivity(id: string) {
	return await makeAPIRequest<Activity>(
		`activity-${id}`,
		`/v1/activities/${id}`,
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
	return await makeAPIRequest<Activity>(null, '/v1/activities/create', useCurrentSessionToken(), {
		method: 'POST',
		body: activity
	});
}

export async function editActivity(activity: Activity) {
	return await makeAPIRequest<Activity>(
		null,
		`/v1/activities/${activity.id}`,
		useCurrentSessionToken(),
		{
			method: 'PATCH',
			body: activity
		}
	);
}

// Activity Icons

export const activityIcons = {
	coding: 'material-symbols:code',
	track: 'healthicons:running',
	cross_country: 'material-symbols:3k-plus',
	writing: 'material-symbols:ink-pen-rounded'
};
