import { ensureLoggedIn } from '~/server/utils';

export default defineEventHandler(async (event) => {
	await ensureLoggedIn(event);

	const config = useRuntimeConfig();
	const { id } = getQuery(event);

	if (!id || typeof id !== 'string' || id.trim() === '') {
		throw createError({
			statusCode: 400,
			statusMessage: 'ID parameter is required and must be a non-empty string'
		});
	}

	const photo = await readMultipartFormData(event);
	if (!photo || photo.length === 0) {
		throw createError({
			statusCode: 400,
			statusMessage: 'No photo file uploaded'
		});
	}

	const file = photo[0];

	// images will be converted to webp in the backend
	if (!file.type?.startsWith('image/')) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Uploaded file must be a WebP image'
		});
	}

	const res = await $fetch(`${config.public.cloudBaseUrl}/v1/events/thumbnail/${id}`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${config.adminApiKey}`,
			'Content-Type': file.type
		},
		body: file,
		timeout: 10000,
		onResponseError: (ctx) => {
			throw createError({
				statusCode: ctx.response.status,
				statusMessage: `Failed to upload event thumbnail: ${ctx.response.statusText}`
			});
		}
	});

	return res;
});
