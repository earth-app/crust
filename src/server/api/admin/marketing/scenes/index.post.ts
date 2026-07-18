import { ensureAdministrator } from '~/server/utils';
import {
	MARKETING_KINDS,
	type MarketingScene,
	type MarketingSceneInput
} from '~/shared/types/marketing';

export default defineEventHandler(async (event) => {
	const admin = await ensureAdministrator(event);
	const body = await readBody<MarketingSceneInput>(event);

	const allowedKinds: string[] = [...MARKETING_KINDS, 'garden'];
	if (!body?.name || typeof body.name !== 'string' || !allowedKinds.includes(body.kind as string)) {
		throw createError({
			statusCode: 400,
			statusMessage: 'A scene name and a valid kind are required'
		});
	}

	const now = new Date().toISOString();
	const scene: MarketingScene = {
		id: crypto.randomUUID(),
		name: body.name.slice(0, 120),
		description: typeof body.description === 'string' ? body.description.slice(0, 500) : undefined,
		kind: body.kind,
		source: body.source ?? 'manual',
		payload: body.payload ?? null,
		created_by: String(admin.id),
		created_at: now,
		updated_at: now
	};

	await useStorage('cache').setItem(`marketing:scene:${scene.id}`, scene);
	return scene;
});
