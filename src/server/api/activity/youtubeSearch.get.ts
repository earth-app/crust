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

	const results = (await YouTube.search(query, { limit: 20, type: 'video', safeSearch: true }))
		.filter((video) => video.id && !video.live && !video.shorts && !video.unlisted)
		.filter((_, index) => index < 5); // Limit to 5 results;

	if (!results || results.length === 0) {
		throw createError({
			statusCode: 404,
			statusMessage: 'No results found'
		});
	}

	return results.map(
		(video) =>
			({
				id: video.id!,
				title: video.title || 'YouTube Video',
				uploaded_at: video.uploadedAt || 'Sometime in the past'
			}) satisfies YouTubeVideo
	);
});
