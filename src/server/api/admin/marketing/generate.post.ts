import { ensureAdministrator } from '~/server/utils';
import type { MarketingKind } from '~/shared/types/marketing';

// kinds the cloud dry-run generator can synthesize (user/quest/notification/motd are owned elsewhere)
const GENERATABLE: MarketingKind[] = ['activity', 'event', 'prompt', 'article'];

export default defineEventHandler(async (event) => {
	await ensureAdministrator(event);

	const config = useRuntimeConfig();
	const body = await readBody<{ kind?: MarketingKind; hint?: string }>(event);
	const kind = body?.kind;

	if (!kind || !GENERATABLE.includes(kind)) {
		throw createError({
			statusCode: 400,
			statusMessage: `A generatable kind is required (${GENERATABLE.join(', ')})`
		});
	}

	const hint = typeof body?.hint === 'string' ? body.hint.slice(0, 200) : undefined;

	try {
		// preview-only: cloud RETURNS the object, it is never posted to mantle2
		return await $fetch(`${config.public.cloudBaseUrl}/v1/admin/marketing/generate`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${config.adminApiKey}`,
				Accept: 'application/json',
				'Content-Type': 'application/json'
			},
			body: { kind, hint }
		});
	} catch (error) {
		throw createError({
			statusCode: 502,
			statusMessage: `Failed to generate ${kind}: ${error instanceof Error ? error.message : 'Unknown error'}`
		});
	}
});
