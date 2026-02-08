import { ensureLoggedIn } from '../../utils';

export default defineEventHandler(async (event) => {
	const user = await ensureLoggedIn(event);
	const config = useRuntimeConfig();

	const { action, field } = await readBody<{ action: 'start' | 'stop'; field: string }>(event);

	const res = await $fetch(`${config.public.cloudBaseUrl}/v1/users/timer`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${config.adminApiKey}`,
			Accept: 'application/json'
		},
		body: { action, userId: user.id, field }
	});

	return res;
});
