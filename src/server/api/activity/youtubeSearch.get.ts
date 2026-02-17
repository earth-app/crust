import { YouTube } from 'youtube-sr';
import type { YouTubeVideo } from '~/shared/types/activity';

export default defineEventHandler(async (event) => {
	const { query } = getQuery(event);

	if (!query)
		throw createError({
			statusCode: 400,
			statusMessage: 'Query parameter is required'
		});

	if (typeof query !== 'string' || query.trim() === '') {
		throw createError({
			statusCode: 400,
			statusMessage: 'Query must be a non-empty string'
		});
	}

	try {
		const results = (await YouTube.search(query, { limit: 20, type: 'video', safeSearch: true }))
			.filter((video) => video.id && !video.live && !video.shorts && !video.unlisted)
			.filter((_, index) => index < 5); // Limit to 5 results;

		if (!results || results.length === 0) {
			throw createError({
				statusCode: 404,
				statusMessage: 'No results found'
			});
		}

		// Create plain objects to avoid serialization issues with youtube-sr class instances
		return results.map((video) => {
			const id = String(video.id);
			const title = String(video.title || 'YouTube Video');
			const uploaded_at = String(video.uploadedAt || 'Sometime in the past');

			return {
				id,
				title,
				uploaded_at
			} satisfies YouTubeVideo;
		});
	} catch (error) {
		console.error('YouTube search error:', error);
		throw createError({
			cause: error,
			statusCode: 500,
			statusMessage: 'An error occurred while searching YouTube'
		});
	}
});
