import {
	type Activity,
	type PixabayImage,
	type PixabayVideo,
	type WikipediaSummary,
	type YouTubeVideo
} from '~/shared/types/activity';
import type { SortingOption } from '~/shared/types/global';
import {
	capitalizeFully,
	makeAPIRequest,
	makeClientAPIRequest,
	makeServerRequest,
	paginatedAPIRequest
} from '~/shared/util';
import { useCurrentSessionToken } from './useLogin';

// mantle - /v2/activities
// cloud - /v1/activity

export async function getAllActivities(
	limit: number = 25,
	search: string = '',
	sort: SortingOption = 'desc'
) {
	return await paginatedAPIRequest<Activity>(
		'/v2/activities',
		useCurrentSessionToken(),
		{},
		limit,
		search,
		sort
	);
}

export async function getActivities(
	page: number = 1,
	limit: number = 25,
	search: string = '',
	sort: SortingOption = 'desc'
) {
	const res = await makeAPIRequest<{ items: Activity[]; total: number }>(
		`activities-${search}-${page}-${limit}-${sort}`,
		`/v2/activities?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&sort=${sort}`,
		useCurrentSessionToken()
	);

	if (res.success && res.data) {
		if ('message' in res.data) {
			return res;
		}

		// load individual activities into state
		for (const activity of res.data.items) {
			useState<Activity | null>(`activity-${activity.id}`, () => activity);
		}
	}

	return res;
}

export async function getActivitiesList(
	page: number = 1,
	limit: number = 100,
	search: string = ''
) {
	return await makeClientAPIRequest<{ items: string[]; total: number }>(
		`/v2/activities/list?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`,
		useCurrentSessionToken()
	);
}

export function useActivitiesCount() {
	const count = useState<number | undefined>('activities-count', () => undefined);

	const fetchCount = async () => {
		const res = await getActivitiesList(1, 1);
		if (res.success && res.data) {
			if ('message' in res.data) {
				count.value = undefined;
			} else {
				count.value = res.data.total;
			}
		} else {
			count.value = undefined;
		}
	};

	if (count.value === undefined) {
		fetchCount();
	}

	return { count, refresh: fetchCount };
}

export async function getRandomActivities(count: number = 3) {
	const res = await makeClientAPIRequest<Activity[]>(
		`/v2/activities/random?count=${count}`,
		useCurrentSessionToken()
	);

	if (res.success && res.data) {
		if ('message' in res.data) {
			return res;
		}

		// load individual activities into state
		for (const activity of res.data) {
			useState<Activity | null>(`activity-${activity.id}`, () => activity);
		}
	}

	return res;
}

export async function getActivity(id: string) {
	return await makeAPIRequest<Activity>(
		`activity-${id}`,
		`/v2/activities/${id}?include_aliases=true`,
		useCurrentSessionToken()
	);
}

export async function draftActivity(id: string) {
	return await makeServerRequest<Activity>(
		`draft-activity-${id}`,
		`/api/admin/draftActivity?id=${id}`,
		useCurrentSessionToken()
	);
}

export async function newActivity(activity: Activity) {
	return await makeClientAPIRequest<Activity>('/v2/activities', useCurrentSessionToken(), {
		method: 'POST',
		body: activity
	});
}

export async function editActivity(activity: Activity) {
	return await makeClientAPIRequest<Activity>(
		`/v2/activities/${activity.id}`,
		useCurrentSessionToken(),
		{
			method: 'PATCH',
			body: activity
		}
	);
}

export async function deleteActivity(id: string) {
	return await makeClientAPIRequest<void>(`/v2/activities/${id}`, useCurrentSessionToken(), {
		method: 'DELETE'
	});
}

// Activity Information Extensions

export async function getActivityWikipediaSummary(title: string) {
	return await makeServerRequest<WikipediaSummary>(
		`wikipedia-summary-${title}`,
		`/api/activity/wikipedia?title=${encodeURIComponent(title)}`,
		useCurrentSessionToken()
	);
}

export async function getActivityYouTubeSearch(query: string) {
	return await makeServerRequest<YouTubeVideo[]>(
		`youtube-search-${query}`,
		`/api/activity/youtubeSearch?query=${encodeURIComponent(query)}`,
		useCurrentSessionToken()
	);
}

export async function getActivityWikipediaSearches(
	queries: string[],
	onArticleLoaded?: (title: string, summary: WikipediaSummary) => void
) {
	const results: Record<string, WikipediaSummary> = {};
	const responses = await Promise.all(
		queries.map(async (query) => {
			return await makeServerRequest<{
				query: { search: { title: string; snippet: string }[] };
			}>(
				`wikipedia-search-${query}`,
				`/api/activity/wikipediaSearch?search=${encodeURIComponent(query)}`,
				useCurrentSessionToken()
			).then((res) => {
				if (res.success) {
					return res.data?.query.search || [];
				}

				return [];
			});
		})
	)
		.then((res) => res.flat())
		.then((responses) => responses.filter((r) => r.title?.trim() !== ''));

	// fetch all summaries in parallel instead of sequentially
	const seenTitles = new Set<string>();
	await Promise.allSettled(
		responses.map(async (r) => {
			if (!r.title || seenTitles.has(r.title)) return;
			seenTitles.add(r.title);

			try {
				const res = await getActivityWikipediaSummary(r.title);
				if (res.success && res.data) {
					if (res.data.type === 'disambiguation') return;

					res.data.summarySnippet =
						'...' +
						r.snippet
							.replace(/<\/?span[^>]*>/g, '') // Remove any <span> tags from snippet
							.replace(/&quot;/g, '"') // Decode HTML entities
							.replace(/&lt;/g, '<')
							.replace(/&gt;/g, '>')
							.replace(/&#39;/g, "'")
							.replace(/&#039;s/g, "'s")
							.replace(/&#039;/g, "'")
							.replace(/&amp;/g, '&') // Decode &amp; last to prevent double-unescaping
							.trim() +
						'...';

					results[r.title] = res.data;

					// call callback immediately when article loads (for incremental display)
					if (onArticleLoaded) {
						onArticleLoaded(r.title, res.data);
					}
				}
			} catch (error) {
				// Ignore errors for individual summaries
			}
		})
	);

	return results;
}

export async function getActivityPixabayImages(
	queries: string[],
	onImageLoaded?: (query: string, images: PixabayImage[]) => void
) {
	const results: Record<string, PixabayImage[]> = {};
	await Promise.all(
		queries.map(async (query) => {
			if (results[query]) return; // Already fetched

			try {
				const res = await makeServerRequest<PixabayImage[]>(
					`pixabay-images-${query}`,
					`/api/activity/pixabayImages?query=${encodeURIComponent(query)}`,
					useCurrentSessionToken()
				);

				if (res.success && res.data) {
					results[query] = res.data;

					// call callback immediately when images load (for incremental display)
					if (onImageLoaded) {
						onImageLoaded(query, res.data);
					}
				} else {
					results[query] = [];
				}
			} catch (error) {
				results[query] = [];
			}
		})
	);

	return results;
}

export async function getActivityPixabayVideos(
	queries: string[],
	onVideoLoaded?: (query: string, videos: PixabayVideo[]) => void
) {
	const results: Record<string, PixabayVideo[]> = {};
	await Promise.all(
		queries.map(async (query) => {
			if (results[query]) return; // Already fetched
			try {
				const res = await makeServerRequest<PixabayVideo[]>(
					`pixabay-videos-${query}`,
					`/api/activity/pixabayVideos?query=${encodeURIComponent(query)}`,
					useCurrentSessionToken()
				);

				if (res.success && res.data) {
					results[query] = res.data;

					// call callback immediately when videos load (for incremental display)
					if (onVideoLoaded) {
						onVideoLoaded(query, res.data);
					}
				} else {
					results[query] = [];
				}
			} catch (error) {
				results[query] = [];
			}
		})
	);

	return results;
}

export async function getActivityIconSearches(queries: string[]) {
	const results: Record<string, string[]> = {};
	await Promise.all(
		queries.map(async (query) => {
			if (results[query]) return; // Already fetched

			try {
				const res = await makeServerRequest<{ icons: string[]; total: number }>(
					`icon-search-${query}`,
					`/api/activity/iconSearch?search=${encodeURIComponent(query)}`,
					useCurrentSessionToken()
				);

				if (res.success && res.data) {
					results[query] = res.data.icons;
				} else {
					results[query] = [];
				}
			} catch (error) {
				results[query] = [];
			}
		})
	);

	return results;
}

// Activity Profile

export function useActivityIslands() {
	const islands = ref<{ name: string; icon: string; x: number; y: number }[]>([]);
	const loadIslandsForActivity = async (activity: Activity) => {
		if (activity.fields['island_icons']) {
			const icons = activity.fields['island_icons'].split(',');
			const size = icons.length;
			islands.value.push(
				...Array.from({ length: size }, (_, i) => {
					const id = icons[i] ?? '';
					if (!id) return null;

					return {
						name: capitalizeFully(id),
						icon: id.includes(':') ? id.toLowerCase() : `cib:${id.toLowerCase()}`,
						x: i % 2 == 0 ? Math.random() * 5 + 33 : Math.random() * -5 - 37,
						y: i * 6 + 30
					};
				}).filter((island) => island !== null)
			);
		}

		getActivityIconSearches([activity.name, ...(activity.aliases || [])]).then((icons) => {
			let i = 0;
			for (const icon of Object.values(icons).flat()) {
				islands.value.push({
					name: capitalizeFully(icon),
					icon: icon,
					x: i % 2 == 0 ? Math.random() * 5 + 33 : Math.random() * -5 - 37,
					y: i * 6 + 30
				});
				i++;
			}
		});
	};

	return { islands, loadIslandsForActivity };
}

export function useActivityCards() {
	const cards = ref<
		{
			title: string;
			icon: string;
			description?: string;
			content?: string;
			link?: string;
			image?: string;
			video?: string;
			youtubeId?: string;
			footer?: string;
		}[]
	>([]);
	const loadRequestId = ref(0);

	const loadCardsForActivity = async (activity: Activity) => {
		if (!activity) return;

		// Create a new request token; used to ignore late async responses
		const reqId = ++loadRequestId.value;
		cards.value = [];

		// Track unique items across sources
		const seen = new Set<string>();

		const safePush = (items: (typeof cards.value)[number] | (typeof cards.value)[number][]) => {
			if (loadRequestId.value !== reqId) return; // stale load, ignore
			const arr = Array.isArray(items) ? items : [items];
			for (const item of arr) {
				const key = item.youtubeId
					? `yt:${item.youtubeId}`
					: item.link
						? `link:${item.link}`
						: `t:${item.title}`;
				if (seen.has(key)) continue;
				seen.add(key);

				const lower = Math.min(4, cards.value.length);
				const upper = cards.value.length;
				const randomPlace = lower + Math.floor(Math.random() * (upper - lower + 1));
				cards.value.splice(randomPlace, 0, item);
			}
		};

		const ytQueries = [`what is ${activity.name}`, `how to ${activity.name}`];
		const ytPromises = ytQueries.map((q) =>
			getActivityYouTubeSearch(q)
				.then((res) => {
					if (res.success && res.data) {
						safePush(
							res.data.map((video) => ({
								title: video.title,
								icon: 'cib:youtube',
								description: video.uploaded_at,
								link: `https://www.youtube.com/watch?v=${video.id}`,
								youtubeId: video.id
							}))
						);
					}
				})
				.catch(() => {
					// ignore individual source failures
				})
		);
		await Promise.allSettled(ytPromises);

		// Wikipedia searches (name + aliases)
		try {
			const terms = [activity.name, ...(activity.aliases || [])];
			await getActivityWikipediaSearches(terms, (_, entry) => {
				const key = `wp:${entry.pageid}`;
				if (seen.has(key)) return;
				seen.add(key);
				safePush({
					title: entry.title,
					icon: 'cib:wikipedia',
					description: entry.description,
					content: entry.extract,
					link: `https://en.wikipedia.org/wiki/${entry.titles.canonical}`,
					image: entry.originalimage?.source,
					footer: entry.summarySnippet
				});
			});
		} catch (e) {
			// ignore
		}

		// Pixabay image searches (name + aliases)
		try {
			const terms = [activity.name, ...(activity.aliases || [])];
			await getActivityPixabayImages(terms, (_, images) => {
				safePush(
					images.map((image) => ({
						title: capitalizeFully(activity.name),
						icon: 'mdi:image',
						description: `Photo by ${image.user} on Pixabay`,
						link: image.pageURL,
						image: image.webformatURL
					}))
				);
			});
		} catch (e) {
			// ignore
		}

		// Pixabay video searches (name + aliases)
		try {
			const terms = [activity.name, ...(activity.aliases || [])];
			await getActivityPixabayVideos(terms, (_, videos) => {
				safePush(
					videos.map((video) => ({
						title: capitalizeFully(activity.name),
						icon: 'mdi:video',
						description: `Video by ${video.user} on Pixabay`,
						video: video.videos.medium.url
					}))
				);
			});
		} catch (e) {
			// ignore
		}
	};

	return { cards, loadRequestId, loadCardsForActivity };
}
