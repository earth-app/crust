import { cloudErrorMessage, ensureAdministrator } from '~/server/utils';

export type ActivityAuditFinding = {
	id: string;
	nature: string;
	title: string;
	short_description: string | null;
	recommendation: 'delete' | 'review';
	reason: string;
};

export type ActivityAudit = {
	checked: number;
	counts: Record<string, number>;
	findings: ActivityAuditFinding[];
	generated_at: string;
};

export default defineEventHandler(async (event) => {
	await ensureAdministrator(event);

	const config = useRuntimeConfig();
	const body = await readBody<{ ids?: string[] }>(event).catch(() => ({}));
	const ids = Array.isArray(body?.ids)
		? body.ids.filter((id) => typeof id === 'string' && id.trim().length > 0)
		: undefined;

	// the caller's session authenticates this hop; the outbound hop uses the server secret
	return await $fetch<ActivityAudit>(`${config.public.cloudBaseUrl}/v1/admin/activities/audit`, {
		method: 'POST',
		// the whole catalogue is ~470 ids, screened 50 per wikipedia request
		timeout: 120_000,
		headers: {
			Authorization: `Bearer ${config.adminApiKey}`,
			Accept: 'application/json'
		},
		body: ids ? { ids } : {},
		onResponseError: (ctx) => {
			const message = cloudErrorMessage(ctx.response._data);
			throw createError({
				data: ctx.response._data,
				statusCode: ctx.response.status,
				statusMessage: message || `Failed to audit activities: ${ctx.response.statusText}`
			});
		}
	});
});
