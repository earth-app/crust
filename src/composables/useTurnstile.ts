import { makeServerRequest } from '~/shared/util';

export function useTurnstile(token: string) {
	const config = useRuntimeConfig();
	if (!config.public.turnstile.siteKey) {
		throw new Error('Turnstile site key is not configured');
	}

	async function validate() {
		try {
			const result = await makeServerRequest<{
				success: boolean;
				'error-codes': string[];
				messages: string[];
			}>(null, '/api/turnstile', null, {
				method: 'POST',
				body: { token }
			});

			return result.data || { success: result.success, 'error-codes': [], messages: [] };
		} catch (error) {
			console.error('Turnstile validation failed:', error);
			return { success: false, 'error-codes': [], messages: [] };
		}
	}

	return {
		validate
	};
}
