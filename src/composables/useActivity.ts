import { DateTime } from 'luxon';
import { useActivityStore } from 'stores/activity';
import { useAuthStore } from 'stores/auth';
import {
	type Activity,
	type InternetArchiveItem,
	type PixabayImage,
	type PixabayVideo,
	type UnsplashImage,
	type WikipediaSummary,
	type YouTubeVideo
} from 'types/activity';
import type { SortingOption } from 'types/global';
import {
	capitalizeFully,
	makeAPIRequest,
	makeClientAPIRequest,
	makeServerRequest,
	paginatedAPIRequest
} from 'utils';

function sanitizeArchiveDescription(value: string): string {
	return value
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/\s+/g, ' ')
		.trim();
}

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

	const fetchRandom = async (count: number = 3) => {
		const authStore = useAuthStore();

		// Return cached result if still fresh
		const cached = activityStore.getRandomCached(count);
		if (cached) {
			return { success: true as const, data: cached, message: '' };
		}

		const res = await makeClientAPIRequest<Activity[]>(
			`/v2/activities/random?count=${count}`,
			authStore.sessionToken
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			// load individual activities into store and cache random result
			activityStore.setActivities(res.data);
			activityStore.setRandomCached(count, res.data);
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
		fetchRandom,
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
		page: number = 1,
		onImageLoaded?: (query: string, images: PixabayImage[]) => void
	) => {
		const results: Record<string, PixabayImage[]> = {};
		let hasMore = false;
		await Promise.all(
			queries.map(async (query) => {
				if (results[query]) return;

				try {
					const res = await makeServerRequest<{
						hits: PixabayImage[];
						total: number;
						totalHits: number;
						page: number;
						hasMore: boolean;
					}>(
						`pixabay-images-${query}-${page}`,
						`/api/activity/pixabayImages?query=${encodeURIComponent(query)}&page=${page}`,
						authStore.sessionToken
					);

					if (res.success && res.data) {
						results[query] = res.data.hits;
						hasMore = hasMore || res.data.hasMore;

						// call callback immediately when images load (for incremental display)
						if (onImageLoaded) {
							onImageLoaded(query, res.data.hits);
						}
					} else {
						results[query] = [];
					}
				} catch (error) {
					results[query] = [];
				}
			})
		);

		return { results, hasMore };
	};

	const fetchPixabayVideos = async (
		queries: string[],
		page: number = 1,
		onVideoLoaded?: (query: string, videos: PixabayVideo[]) => void
	) => {
		const results: Record<string, PixabayVideo[]> = {};
		let hasMore = false;
		await Promise.all(
			queries.map(async (query) => {
				if (results[query]) return; // Already fetched
				try {
					const res = await makeServerRequest<{
						hits: PixabayVideo[];
						total: number;
						totalHits: number;
						page: number;
						hasMore: boolean;
					}>(
						`pixabay-videos-${query}-${page}`,
						`/api/activity/pixabayVideos?query=${encodeURIComponent(query)}&page=${page}`,
						authStore.sessionToken
					);

					if (res.success && res.data) {
						results[query] = res.data.hits;
						hasMore = hasMore || res.data.hasMore;

						// call callback immediately when videos load (for incremental display)
						if (onVideoLoaded) {
							onVideoLoaded(query, res.data.hits);
						}
					} else {
						results[query] = [];
					}
				} catch (error) {
					results[query] = [];
				}
			})
		);

		return { results, hasMore };
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

	const fetchInternetArchiveItems = async (query: string, page: number = 1) => {
		try {
			const res = await makeServerRequest<{
				items: InternetArchiveItem[];
				page: number;
				hasMore: boolean;
				total: number;
			}>(
				`internet-archive-search-${query}-${page}`,
				`/api/activity/internetArchive?query=${encodeURIComponent(query)}&page=${page}`,
				authStore.sessionToken
			);

			if (res.success && res.data) {
				return res.data;
			}
		} catch (error) {
			// ignore errors
		}

		return {
			items: [],
			page,
			hasMore: false,
			total: 0
		};
	};

	const fetchUnsplashImages = async (query: string, excluded: string[] = []) => {
		try {
			const res = await makeServerRequest<UnsplashImage[]>(
				`unsplash-search-${query}`,
				`/api/activity/unsplash?query=${encodeURIComponent(query)}`,
				authStore.sessionToken,
				{
					method: 'POST',
					body: JSON.stringify({ excluded })
				}
			);

			if (res.success && res.data) {
				return res.data;
			}
		} catch (error) {
			// ignore errors
		}
		return [];
	};

	return {
		fetchWikipediaSummary,
		fetchYouTubeSearch,
		fetchWikipediaSearches,
		fetchPixabayImages,
		fetchPixabayVideos,
		fetchIconSearches,
		fetchInternetArchiveItems,
		fetchUnsplashImages
	};
}

// Activity Profile

export function useActivityIslands() {
	const islands = ref<{ name: string; icon: string; x: number; y: number }[]>([]);
	const info = useActivityInfo();

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

		info.fetchIconSearches([activity.name, ...(activity.aliases || [])]).then((icons) => {
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
	type CardEntry = {
		key?: string;
		title: string;
		icon: string;
		description?: string;
		descriptionLink?: string;
		content?: string;
		link?: string;
		image?: string;
		imageLink?: string;
		object?: string;
		objectType?: string;
		video?: string;
		youtubeId?: string;
		footer?: string;
		secondaryFooter?: string;
		color?: number;
	};

	type SourceKey = 'pixabayImages' | 'pixabayVideos' | 'archive' | 'unsplash';

	const cards = ref<CardEntry[]>([]);
	const loadRequestId = ref(0);
	const isLoadingMore = ref(false);
	const info = useActivityInfo();
	const currentActivity = ref<Activity | null>(null);
	const seen = ref(new Set<string>());
	const sourceTerms = ref<string[]>([]);
	const sourceQueue = ref<SourceKey[]>([]);
	const lastActivityLoadKey = ref<string | null>(null);
	const i18n = useI18n();

	const sourcePage = reactive<Record<SourceKey, number>>({
		pixabayImages: 1,
		pixabayVideos: 1,
		archive: 1,
		unsplash: 1
	});

	const sourceHasMore = reactive<Record<SourceKey, boolean>>({
		pixabayImages: true,
		pixabayVideos: true,
		archive: true,
		unsplash: true
	});

	const hasMore = computed(() => {
		return (
			sourceHasMore.pixabayImages ||
			sourceHasMore.pixabayVideos ||
			sourceHasMore.archive ||
			sourceHasMore.unsplash
		);
	});

	const safePush = (items: CardEntry | CardEntry[], reqId: number, randomize: boolean = true) => {
		if (loadRequestId.value !== reqId) return;
		const arr = Array.isArray(items) ? items : [items];
		const normalizedItems: CardEntry[] = [];

		for (const item of arr) {
			const key =
				item.key ||
				(item.youtubeId
					? `yt:${item.youtubeId}`
					: item.footer
						? `footer:${item.footer}`
						: item.link
							? `link:${item.link}`
							: item.video
								? `video:${item.video}`
								: item.object
									? `object:${item.object}`
									: `t:${item.title}`);
			if (seen.value.has(key)) continue;
			seen.value.add(key);
			normalizedItems.push({
				...item,
				key
			});
		}

		if (normalizedItems.length === 0) return;

		if (!randomize) {
			// Batch append to avoid N reactive updates while infinite scrolling.
			cards.value = [...cards.value, ...normalizedItems];
			return;
		}

		const nextCards = [...cards.value];
		for (const normalizedItem of normalizedItems) {
			const lower = Math.min(4, nextCards.length);
			const upper = nextCards.length;
			const randomPlace = lower + Math.floor(Math.random() * (upper - lower + 1));
			nextCards.splice(randomPlace, 0, normalizedItem);
		}

		cards.value = nextCards;
	};

	const pickSource = (availableSources: SourceKey[]): SourceKey => {
		// Keep equal distribution by exhausting a shuffled queue before repeating.
		sourceQueue.value = sourceQueue.value.filter((source) => availableSources.includes(source));

		if (sourceQueue.value.length === 0) {
			sourceQueue.value = [...availableSources];
			for (let i = sourceQueue.value.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[sourceQueue.value[i], sourceQueue.value[j]] = [
					sourceQueue.value[j]!,
					sourceQueue.value[i]!
				];
			}
		}

		const next = sourceQueue.value.shift();
		return next || availableSources[0]!;
	};

	const extensionFromUrl = (url: string, fallback: string) => {
		const ext = url.split('.').pop()?.split('?')[0]?.toLowerCase();
		return ext || fallback;
	};

	const mapArchiveItems = (items: InternetArchiveItem[]): CardEntry[] => {
		const mapped: CardEntry[] = [];
		for (const item of items) {
			let icon: string;
			let targetType: string | undefined;
			let targetFile: string | undefined;
			let targetVideo: string | undefined;

			switch (item.type) {
				case 'audio': {
					icon = 'mdi:music';
					const audioFile =
						item.files.find((f) => f.format === 'mp3') ||
						item.files.find((f) => f.format === 'ogg') ||
						item.files.find((f) => f.format === 'wav') ||
						item.files.find((f) => f.format === 'm4a') ||
						item.files.find((f) => f.format === 'audio');
					if (audioFile?.url) {
						targetFile = audioFile.url;
						targetType = `audio/${extensionFromUrl(audioFile.url, 'mpeg')}`;
					}
					break;
				}
				case 'image': {
					icon = 'mdi:image-outline';
					const imageFile =
						item.files.find((f) => f.format === 'jpg') ||
						item.files.find((f) => f.format === 'png') ||
						item.files.find((f) => f.format === 'gif') ||
						item.files.find((f) => f.format === 'webp') ||
						item.files.find((f) => f.format === 'tiff') ||
						item.files.find((f) => f.format === 'bmp') ||
						item.files.find((f) => f.format === 'image');
					if (imageFile?.url) {
						targetFile = imageFile.url;
						targetType = `image/${extensionFromUrl(imageFile.url, 'jpeg')}`;
					}
					break;
				}
				case 'texts': {
					icon = 'mdi:book-open-page-variant';
					const textFile =
						item.files.find((f) => f.format === 'pdf') ||
						item.files.find((f) => f.format === 'epub') ||
						item.files.find((f) => f.format === 'txt');
					if (textFile?.url) {
						targetFile = textFile.url;
						targetType = `application/${extensionFromUrl(textFile.url, 'pdf')}`;
					}
					break;
				}
				case 'movies': {
					icon = 'mdi:movie-open-outline';
					const videoFile =
						item.files.find((f) => f.format === 'mp4') ||
						item.files.find((f) => f.format === 'webm') ||
						item.files.find((f) => f.format === 'video');
					if (videoFile?.url) {
						targetVideo = videoFile.url;
						targetType = `video/${extensionFromUrl(videoFile.url, 'mp4')}`;
					}
					break;
				}
				default:
					continue;
			}

			const description0 = sanitizeArchiveDescription(item.description);

			let date0 = '';
			if (item.date.includes('T') && item.date.endsWith('Z')) {
				date0 = DateTime.fromISO(item.date, { zone: 'utc' }).toLocaleString(DateTime.DATE_HUGE, {
					locale: i18n.locale.value
				});
			} else if (item.date.toLowerCase() === 'unknown' || item.date.trim() === '') {
				date0 = 'Unknown Date';
			} else {
				// fallback to whatever was provided if not in ISO format
				date0 = item.date;
			}

			mapped.push({
				title: item.title,
				icon,
				description: `Item on Internet Archive by ${item.creator}`,
				content: trimString(description0, 400),
				object: targetFile,
				objectType: targetType,
				video: targetVideo,
				link: `https://archive.org/details/${item.identifier}`,
				footer: item.identifier,
				secondaryFooter: date0,
				color: 0x111111
			} satisfies CardEntry);
		}

		return mapped;
	};

	const mapUnsplashImages = (items: UnsplashImage[]): CardEntry[] => {
		return items.map((item) => {
			const color0 = parseInt(item.color.replace('#', ''), 16);

			return {
				title: trimString(toTitleCase(item.description || item.alt_description || 'Untitled'), 60),
				icon: 'cib:unsplash',
				description: `Photo by ${item.user.name} on Unsplash`,
				descriptionLink: item.user.links.html,
				content: item.description && item.alt_description ? item.alt_description : undefined,
				link: item.links.html,
				image: item.urls.regular,
				imageLink: item.links.download,
				secondaryFooter: item.id,
				color: isNaN(color0) ? undefined : color0
			};
		});
	};

	const loadMore = async () => {
		const activity = currentActivity.value;
		if (!activity || isLoadingMore.value || !hasMore.value) return;

		const reqId = loadRequestId.value;
		isLoadingMore.value = true;

		try {
			const terms =
				sourceTerms.value.length > 0
					? sourceTerms.value
					: [activity.name, ...(activity.aliases || [])];

			const availableSources: SourceKey[] = [];
			if (sourceHasMore.pixabayImages) availableSources.push('pixabayImages');
			if (sourceHasMore.pixabayVideos) availableSources.push('pixabayVideos');
			if (sourceHasMore.archive) availableSources.push('archive');
			if (sourceHasMore.unsplash) availableSources.push('unsplash');

			if (availableSources.length === 0) return;

			const chosenSource = pickSource(availableSources);

			if (chosenSource === 'pixabayImages') {
				const imageRes = await info.fetchPixabayImages(
					terms,
					sourcePage.pixabayImages,
					(_, images) => {
						safePush(
							images.map((image) => ({
								title: capitalizeFully(activity.name),
								icon: 'mdi:image',
								description: `Photo by ${image.user} on Pixabay`,
								link: image.pageURL,
								image: image.webformatURL
							})),
							reqId,
							false
						);
					}
				);

				if (loadRequestId.value !== reqId) return;
				sourceHasMore.pixabayImages = imageRes.hasMore;
				sourcePage.pixabayImages += 1;
			}

			if (chosenSource === 'pixabayVideos') {
				const videoRes = await info.fetchPixabayVideos(
					terms,
					sourcePage.pixabayVideos,
					(_, videos) => {
						const mappedVideos: CardEntry[] = [];
						for (const video of videos) {
							const mediumUrl = video.videos?.medium?.url;
							if (!mediumUrl) continue;
							mappedVideos.push({
								title: capitalizeFully(activity.name),
								icon: 'mdi:video',
								description: `Video by ${video.user} on Pixabay`,
								video: mediumUrl
							});
						}

						safePush(mappedVideos, reqId, false);
					}
				);

				if (loadRequestId.value !== reqId) return;
				sourceHasMore.pixabayVideos = videoRes.hasMore;
				sourcePage.pixabayVideos += 1;
			}

			if (chosenSource === 'archive') {
				const archiveQuery = terms.join(',');
				const archiveRes = await info.fetchInternetArchiveItems(archiveQuery, sourcePage.archive);
				if (loadRequestId.value !== reqId) return;

				safePush(mapArchiveItems(archiveRes.items), reqId, false);
				sourceHasMore.archive = archiveRes.hasMore;
				sourcePage.archive += 1;
			}

			if (chosenSource === 'unsplash') {
				const unsplashQuery = terms.join(',');
				const existingUnsplashIds = cards.value
					.filter((c) => c.icon === 'cib:unsplash' && c.secondaryFooter)
					.map((c) => c.secondaryFooter)
					.filter(Boolean) as string[];
				const unsplashRes = await info.fetchUnsplashImages(unsplashQuery, existingUnsplashIds);
				if (loadRequestId.value !== reqId) return;

				safePush(mapUnsplashImages(unsplashRes || []), reqId, false);
				sourceHasMore.unsplash = unsplashRes !== undefined && unsplashRes.length > 0;
				sourcePage.unsplash += 1;
			}
		} finally {
			if (loadRequestId.value === reqId) {
				isLoadingMore.value = false;
			}
		}
	};

	const loadCardsForActivity = async (activity: Activity) => {
		if (!activity) return;

		const activityLoadKey = `${activity.id}:${activity.name}:${(activity.aliases || []).join(',')}`;
		if (lastActivityLoadKey.value === activityLoadKey && cards.value.length > 0) {
			return;
		}
		lastActivityLoadKey.value = activityLoadKey;

		const reqId = ++loadRequestId.value;
		currentActivity.value = activity;
		cards.value = [];
		seen.value = new Set<string>();
		sourceQueue.value = [];
		sourceTerms.value = [activity.name, ...(activity.aliases || [])]
			.map((term) => term.trim())
			.filter((term, index, arr) => term.length > 0 && arr.indexOf(term) === index);

		sourcePage.pixabayImages = 1;
		sourcePage.pixabayVideos = 1;
		sourcePage.archive = 1;
		sourcePage.unsplash = 1;
		sourceHasMore.pixabayImages = true;
		sourceHasMore.pixabayVideos = true;
		sourceHasMore.archive = true;
		sourceHasMore.unsplash = true;
		isLoadingMore.value = false;

		const ytQueries = [`what is ${activity.name}`, `how to ${activity.name}`];
		await Promise.allSettled(
			ytQueries.map(async (q) => {
				const res = await info.fetchYouTubeSearch(q);
				if (res.success && res.data) {
					safePush(
						res.data.map((video) => ({
							title: video.title,
							icon: 'cib:youtube',
							description: video.uploaded_at,
							link: `https://www.youtube.com/watch?v=${video.id}`,
							youtubeId: video.id,
							color: 0xee0000
						})),
						reqId,
						true
					);
				}
			})
		);

		try {
			const terms = [activity.name, ...(activity.aliases || [])];
			await info.fetchWikipediaSearches(terms, (_, entry) => {
				safePush(
					{
						title: entry.title,
						icon: 'mdi:wikipedia',
						description: entry.description,
						content: entry.extract,
						link: `https://en.wikipedia.org/wiki/${entry.titles.canonical}`,
						image: entry.originalimage?.source,
						footer: entry.summarySnippet
					},
					reqId,
					true
				);
			});
		} catch (e) {
			// ignore
		}

		if (loadRequestId.value !== reqId) return;

		try {
			const archiveQuery = sourceTerms.value.join(',');
			const archiveRes = await info.fetchInternetArchiveItems(archiveQuery, sourcePage.archive);
			if (loadRequestId.value !== reqId) return;

			safePush(mapArchiveItems(archiveRes.items), reqId, true);
			sourceHasMore.archive = archiveRes.hasMore;
			sourcePage.archive += 1;
		} catch (e) {
			// ignore
		}

		if (loadRequestId.value !== reqId) return;

		try {
			const unsplashQuery = sourceTerms.value.join(',');
			const unsplashRes = await info.fetchUnsplashImages(unsplashQuery, []);
			if (loadRequestId.value !== reqId) return;

			safePush(mapUnsplashImages(unsplashRes || []), reqId, true);
			sourceHasMore.unsplash = unsplashRes !== undefined && unsplashRes.length > 0;
			sourcePage.unsplash += 1;
		} catch (e) {
			// ignore
		}

		if (loadRequestId.value !== reqId) return;
		await loadMore();
	};

	return { cards, loadRequestId, loadCardsForActivity, loadMore, hasMore, isLoadingMore };
}
