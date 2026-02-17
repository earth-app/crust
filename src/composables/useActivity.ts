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
import { useActivityStore } from '~/stores/activity';
import { useAuthStore } from '~/stores/auth';

// mantle - /v2/activities
// cloud - /v1/activity

export function useActivitiesCount() {
	const activityStore = useActivityStore();
	const count = computed(() => activityStore.count);

	const fetchCount = async () => {
		await activityStore.fetchCount();
	};

	if (count.value === undefined) {
		fetchCount();
	}

	return { count, refresh: fetchCount };
}

export function useActivities(
	page: number = 1,
	limit: number = 25,
	search: string = '',
	sort: SortingOption = 'desc'
) {
	const activityStore = useActivityStore();
	const activities = useState<Activity[]>(
		`activities-${search}-${page}-${limit}-${sort}`,
		() => []
	);
	const total = useState<number>(`activities-total-${search}-${page}-${limit}-${sort}`, () => 0);

	const fetch = async (
		newPage: number = page,
		newLimit: number = limit,
		newSearch: string = search,
		newSort: SortingOption = sort
	) => {
		const authStore = useAuthStore();

		const res = await makeAPIRequest<{ items: Activity[]; total: number }>(
			`activities-${newSearch}-${newPage}-${newLimit}-${newSort}`,
			`/v2/activities?page=${newPage}&limit=${newLimit}&search=${encodeURIComponent(newSearch)}&sort=${newSort}`,
			authStore.sessionToken
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			// load individual activities into store
			if (Array.isArray(res.data.items)) {
				activityStore.setActivities(res.data.items);
				activities.value = res.data.items;
				total.value = res.data.total;
			}
		}
		return res;
	};

	const fetchAll = async (
		limit: number = 25,
		search: string = '',
		sort: SortingOption = 'desc'
	) => {
		const authStore = useAuthStore();
		return await paginatedAPIRequest<Activity>(
			'/v2/activities',
			authStore.sessionToken,
			{},
			limit,
			search,
			sort
		);
	};

	const fetchList = async (page: number = 1, limit: number = 100, search: string = '') => {
		const authStore = useAuthStore();
		return await makeClientAPIRequest<{ items: string[]; total: number }>(
			`/v2/activities/list?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`,
			authStore.sessionToken
		);
	};

	const getRandom = async (count: number = 3) => {
		const authStore = useAuthStore();

		const res = await makeClientAPIRequest<Activity[]>(
			`/v2/activities/random?count=${count}`,
			authStore.sessionToken
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			// load individual activities into store
			activityStore.setActivities(res.data);
		}

		return res;
	};

	const create = async (activity: Activity) => {
		return await activityStore.createActivity(activity);
	};

	const update = async (activity: Activity) => {
		return await activityStore.updateActivity(activity);
	};

	const remove = async (id: string) => {
		return await activityStore.deleteActivity(id);
	};

	if (import.meta.client) {
		onMounted(() => {
			if (activities.value.length === 0) {
				fetch();
			}
		});
	}

	return {
		activities,
		total,
		fetch,
		fetchAll,
		fetchList,
		getRandom,
		create,
		update,
		remove
	};
}

export function useActivity(id: string) {
	const activityStore = useActivityStore();
	const activity = computed(() => activityStore.get(id) || null);

	const fetch = async () => {
		await activityStore.fetchActivity(id);
	};

	const update = async (updated: Activity) => {
		return await activityStore.updateActivity(updated);
	};

	const remove = async () => {
		return await activityStore.deleteActivity(id);
	};

	const draft = async () => {
		const authStore = useAuthStore();
		return await makeServerRequest<Activity>(
			`draft-activity-${id}`,
			`/api/admin/draftActivity?id=${id}`,
			authStore.sessionToken
		);
	};

	return {
		activity,
		fetch,
		update,
		remove,
		draft
	};
}

// Activity Information Extensions

export function useActivityInfo() {
	const authStore = useAuthStore();

	const fetchWikipediaSummary = async (title: string) => {
		return await makeServerRequest<WikipediaSummary>(
			`wikipedia-summary-${title}`,
			`/api/activity/wikipedia?title=${encodeURIComponent(title)}`,
			authStore.sessionToken
		);
	};

	const fetchYouTubeSearch = async (query: string) => {
		return await makeServerRequest<YouTubeVideo[]>(
			`youtube-search-${query}`,
			`/api/activity/youtubeSearch?query=${encodeURIComponent(query)}`,
			authStore.sessionToken
		);
	};

	const fetchWikipediaSearches = async (
		queries: string[],
		onArticleLoaded?: (title: string, summary: WikipediaSummary) => void
	) => {
		const results: Record<string, WikipediaSummary> = {};
		const responses = await Promise.all(
			queries.map(async (query) => {
				return await makeServerRequest<{
					query: { search: { title: string; snippet: string }[] };
				}>(
					`wikipedia-search-${query}`,
					`/api/activity/wikipediaSearch?search=${encodeURIComponent(query)}`,
					authStore.sessionToken
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
					const res = await fetchWikipediaSummary(r.title);
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
	};

	const fetchPixabayImages = async (
		queries: string[],
		onImageLoaded?: (query: string, images: PixabayImage[]) => void
	) => {
		const results: Record<string, PixabayImage[]> = {};
		await Promise.all(
			queries.map(async (query) => {
				if (results[query]) return;

				try {
					const res = await makeServerRequest<PixabayImage[]>(
						`pixabay-images-${query}`,
						`/api/activity/pixabayImages?query=${encodeURIComponent(query)}`,
						authStore.sessionToken
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
	};

	const fetchPixabayVideos = async (
		queries: string[],
		onVideoLoaded?: (query: string, videos: PixabayVideo[]) => void
	) => {
		const results: Record<string, PixabayVideo[]> = {};
		await Promise.all(
			queries.map(async (query) => {
				if (results[query]) return; // Already fetched
				try {
					const res = await makeServerRequest<PixabayVideo[]>(
						`pixabay-videos-${query}`,
						`/api/activity/pixabayVideos?query=${encodeURIComponent(query)}`,
						authStore.sessionToken
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
	};

	const fetchIconSearches = async (queries: string[]) => {
		const results: Record<string, string[]> = {};
		await Promise.all(
			queries.map(async (query) => {
				if (results[query]) return; // Already fetched

				try {
					const res = await makeServerRequest<{ icons: string[]; total: number }>(
						`icon-search-${query}`,
						`/api/activity/iconSearch?search=${encodeURIComponent(query)}`,
						authStore.sessionToken
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
	};

	return {
		fetchWikipediaSummary,
		fetchYouTubeSearch,
		fetchWikipediaSearches,
		fetchPixabayImages,
		fetchPixabayVideos,
		fetchIconSearches
	};
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

		const { fetchIconSearches } = useActivityInfo();
		fetchIconSearches([activity.name, ...(activity.aliases || [])]).then((icons) => {
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

		const { fetchYouTubeSearch, fetchWikipediaSearches, fetchPixabayImages, fetchPixabayVideos } =
			useActivityInfo();

		const ytQueries = [`what is ${activity.name}`, `how to ${activity.name}`];
		const ytPromises = ytQueries.map((q) =>
			fetchYouTubeSearch(q)
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
			await fetchWikipediaSearches(terms, (_, entry) => {
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
			await fetchPixabayImages(terms, (_, images) => {
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
			await fetchPixabayVideos(terms, (_, videos) => {
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
