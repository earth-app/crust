import { ensureLoggedIn } from '../../utils';

export default defineEventHandler(async (event) => {
	const user = await ensureLoggedIn(event);
	const config = useRuntimeConfig();

	const { action, field, metadata } = await readBody<{
		action: 'start' | 'stop';
		field: string;
		metadata: Record<string, any>;
	}>(event);

	try {
		const res = await $fetch(`${config.public.cloudBaseUrl}/v1/users/timer`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${config.adminApiKey}`,
				Accept: 'application/json'
			},
			body: { action, userId: user.id, field, metadata }
		});

		return res;
	} catch (error: any) {
		// Suppress 409 Conflict errors (timer already started/stopped)
		if (error?.statusCode === 409) {
			return { success: false, message: 'Timer state conflict' };
		}
		throw error;
	}
});
