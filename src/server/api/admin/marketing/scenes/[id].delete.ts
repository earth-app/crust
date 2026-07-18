import { ensureAdministrator } from '~/server/utils';

export default defineEventHandler(async (event) => {
	await ensureAdministrator(event);
	const id = getRouterParam(event, 'id');
	if (!id) {
		throw createError({ statusCode: 400, statusMessage: 'A scene id is required' });
	}

	await useStorage('cache').removeItem(`marketing:scene:${id}`);
	return { success: true };
});
