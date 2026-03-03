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
			.filter((_, index) => index < 5); // Limit to 5 results

		// Create plain objects to avoid serialization issues with youtube-sr class instances
		return results
			.map((video) => {
				try {
					return {
						id: String(video.id),
						title: String(video.title || 'YouTube Video'),
						uploaded_at: String(video.uploadedAt || 'Sometime in the past')
					} satisfies YouTubeVideo;
				} catch {
					return null;
				}
			})
			.filter((v): v is YouTubeVideo => v !== null);
	} catch {
		// youtube-sr can fail on malformed results (e.g. missing channel browseId);
		// return empty array so the caller degrades gracefully
		return [] as YouTubeVideo[];
	}
});
