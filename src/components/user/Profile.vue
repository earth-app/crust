<template>
	<div class="flex flex-col items-center w-full mt-6">
		<div class="flex flex-col items-center mb-2">
			<UAvatar
				:src="avatar"
				id="avatar"
				class="size-20 sm:size-24 md:size-28 lg:size-32 rounded-full shadow-lg shadow-black/50 mb-4 hover:scale-110 transition-transform duration-300"
				width="128"
				height="128"
			/>
			<div class="flex flex-col md:flex-row">
				<h1 class="text-3xl font-semibold">
					{{ handle }}
				</h1>
				<UserTypeBadge
					:user="props.user"
					:editor="user?.is_admin"
					class="ml-3 mt-1 mb-2"
				/>
			</div>
			<h2
				v-if="hasFullName"
				class="text-xl ml-2 text-gray-400"
			>
				@{{ props.user.username }}
			</h2>
			<span
				v-if="props.user.account.bio"
				class="mt-1 text-center max-w-md"
			>
				{{ props.user.account.bio }}
			</span>
		</div>
		<div class="flex gap-2 mb-10">
			<UModal
				title="Points History"
				v-if="points !== undefined"
			>
				<UButton
					color="neutral"
					variant="outline"
					icon="mdi:star-circle-outline"
					>{{ comma(points) }}</UButton
				>

				<template #body>
					<UTable
						:data="pointsHistory || []"
						:loading="pointsHistory === undefined"
						:columns="[
							{
								accessorKey: 'timestamp',
								header: 'Date',
								cell: ({ row }) =>
									row.original.timestamp
										? DateTime.fromMillis(row.original.timestamp).toRelative({
												locale: i18n.locale.value
											})
										: 'sometime'
							},
							{
								accessorKey: 'difference',
								header: 'Change',
								cell: ({ row }) => {
									const diff = row.original.difference;
									const sign = diff > 0 ? '+' : '';
									return h(
										UBadge,
										{ color: diff > 0 ? 'success' : 'error' },
										() => `${sign}${diff}`
									);
								}
							},
							{
								accessorKey: 'reason',
								header: 'Reason'
							}
						]"
					/>
				</template>
			</UModal>
			<NuxtLink
				v-if="badges"
				:to="`/profile/@${props.user.username}/badges`"
			>
				<UButton
					color="neutral"
					variant="outline"
					icon="mdi:badge-account-horizontal-outline"
					>{{ badges.length }}</UButton
				>
			</NuxtLink>
		</div>
		<div class="flex mb-4">
			<UBadge
				v-if="props.user.account.email && props.user.account.email_verified"
				:label="props.user.account.email"
				variant="subtle"
				icon="mdi:mail-ru"
				class="mr-2 hover:cursor-pointer"
				@click="openEmail"
			/>
			<UBadge
				v-if="props.user.account.address"
				:label="props.user.account.address"
				variant="subtle"
				icon="mdi:map-marker"
				color="warning"
				class="mr-2"
			/>
			<UBadge
				v-if="props.user.account.country"
				:label="props.user.account.country"
				variant="subtle"
				icon="mdi:flag"
				color="info"
				class="mr-2"
			/>
		</div>
		<div class="flex items-center justify-center flex-wrap max-w-200">
			<UBadge
				v-for="(activity, i) in props.user.activities"
				:label="activity.name"
				:color="i <= 2 ? 'primary' : 'secondary'"
				:icon="activity.fields['icon']"
				:variant="badgeVariants[i] || 'outline'"
				@mouseenter="badgeVariants[i] = 'solid'"
				@mouseleave="badgeVariants[i] = 'outline'"
				@click="$router.push(`/activities/${activity.id}`)"
				:ui="{
					base: 'text-xs sm:text-sm md:text-md lg:text-base px-1 sm:px-1.5 md:px-2.5 py-1 gap-1 md:gap-1.5 rounded-sm sm:rounded-md',
					leadingIcon: 'size-4 sm:size-5 md:size-6'
				}"
				class="hover:cursor-pointer transition-all duration-500 ml-2 mb-2 sm:mb-3"
			/>
		</div>
		<div
			class="min-w-130 max-w-4xl mt-4"
			id="user-friends"
		>
			<UserFriends :user="props.user" />
		</div>
		<div
			class="min-w-80 max-w-3xl mt-4"
			id="user-journeys"
		>
			<UserJourneyList :user="props.user" />
		</div>
		<div
			class="flex flex-col items-center mt-12 w-full"
			id="user-friends"
		>
			<h1 class="text-2xl font-bold">{{ props.user?.username }}'s Friends</h1>
			<InfoCardGroup
				v-if="props.user.friends"
				:title="`Friends of ${displayName}`"
				:description="`${props.user.friends.length} Friends connected to ${props.user.username} (${Math.min(props.user.friends.length, 100)} shown here)`"
				icon="mdi:account-multiple-outline"
				:icon-button="true"
				@icon-click="openFriends"
				class="w-11/12 my-4"
			>
				<UserCard
					v-for="friend in friends"
					:key="friend.id"
					:user="friend"
				/>
			</InfoCardGroup>
			<h2 v-else>
				{{ props.user.username }} hasn't added any friends yet. Be the first to connect!
			</h2>
		</div>
		<div
			class="flex flex-col items-center mt-12 w-full sm:px-8 md:px-12 lg:px-20"
			id="user-signedup-events"
		>
			<h1 class="text-2xl font-bold">{{ props.user?.username }}'s Calendar</h1>
			<UCard class="mt-4 w-full">
				<div class="flex flex-col items-center mt-4 w-full">
					<UCalendar
						v-model="selectedDate"
						id="calendar"
						@update:modelValue="(date: any) => showEvents(date)"
						class="w-80 max-w-120"
					>
						<template #day="{ day }">
							<div
								class="relative flex items-center justify-center w-full h-full rounded-full"
								:class="{
									'bg-info-100 dark:bg-info-900/20 font-semibold':
										hasEventsOnDate(day) && !isSelectedDate(day),
									'ring-2 ring-info-500 ring-inset': hasEventsOnDate(day)
								}"
							>
								<span>{{ day.day }}</span>
								<span
									v-if="hasEventsOnDate(day)"
									class="absolute bottom-0.5 left-1/2 -translate-x-1/2 size-1 bg-primary-500 rounded-full"
								></span>
							</div>
						</template>
					</UCalendar>
					<InfoCardGroup
						:title="`Events ${props.user.username} is Attending on ${formattedCurrentDay}`"
						:description="`${attendingEventsDay.length} Events that ${props.user.username} is attending on ${formattedCurrentDay} (${Math.min(attendingEventsDay.length, 25)} shown here)`"
						icon="mdi:calendar-check-outline"
						:icon-button="true"
						@icon-click="openCurrentDayEvents"
						class="w-full sm:w-11/12 my-4"
						show-progress
					>
						<EventCard
							v-for="event in attendingEventsDay.slice(0, 25)"
							:key="event.id"
							:event="event"
						/>
					</InfoCardGroup>
				</div>
			</UCard>
		</div>
		<div
			class="flex flex-col items-center mt-12 mb-2 w-full"
			id="user-content"
		>
			<h1 class="text-2xl font-bold">{{ props.user?.username }}'s Content</h1>
			<InfoCardGroup
				v-if="prompts.length > 0"
				:title="`Prompts by ${displayName}`"
				:description="`${totalPrompts} Prompts created by ${props.user.username} (${Math.min(totalPrompts, 25)} shown here)`"
				icon="mdi:pencil-circle-outline"
				:icon-button="true"
				@icon-click="openPrompts"
				class="w-11/12 my-4"
				show-progress
			>
				<PromptCard
					v-for="prompt in prompts"
					:key="prompt.id"
					:prompt="prompt"
				/>
			</InfoCardGroup>
			<InfoCardGroup
				v-if="articles.length > 0"
				:title="`Articles by ${displayName}`"
				:description="`${totalArticles} Articles written by ${props.user.username} (${Math.min(totalArticles, 25)} shown here)`"
				icon="mdi:newspaper-variant-multiple-outline"
				:icon-button="true"
				@icon-click="openArticles"
				class="w-11/12 my-4"
				show-progress
			>
				<ArticleCard
					v-for="article in articles"
					:key="article.id"
					:article="article"
				/>
			</InfoCardGroup>
			<InfoCardGroup
				v-if="events.length > 0"
				:title="`Events hosted by ${displayName}`"
				:description="`${totalEvents} Events hosted by ${props.user.username} (${Math.min(totalEvents, 25)} shown here)`"
				icon="mdi:calendar-star-outline"
				:icon-button="true"
				@icon-click="openEvents"
				class="w-11/12 my-4"
				show-progress
			>
				<EventCard
					v-for="event in events.slice(0, 25)"
					:key="event.id"
					:event="event"
				/>
			</InfoCardGroup>
			<h2 v-if="prompts.length === 0 && articles.length === 0">
				{{ props.user.username }} has not created any content.
			</h2>
		</div>
	</div>
	<ContentDrawer
		ref="drawerRef"
		:title="drawerTitle"
		:is-loading="isLoading"
		@load-more="handleLoadMore"
	>
		<UserCard
			v-if="mode === 'friends'"
			v-for="friend in filteredFriends"
			:key="friend.id"
			:user="friend"
		/>
		<PromptCard
			v-else-if="mode === 'prompts'"
			v-for="prompt in filteredPrompts"
			:key="prompt.id"
			:prompt="prompt"
		/>
		<ArticleCard
			v-else-if="mode === 'articles'"
			v-for="article in filteredArticles"
			:key="article.id"
			:article="article"
		/>
		<EventCard
			v-else-if="mode === 'hosting-events'"
			v-for="event in filteredEvents"
			:key="`${event.hostId}-${event.id}`"
			:event="event"
		/>
		<EventCard
			v-else-if="mode === 'attending-events'"
			v-for="event in filteredAttendingEvents"
			:key="event.id"
			:event="event"
		/>
	</ContentDrawer>
</template>

<script setup lang="ts">
import { UBadge } from '#components';
import {
	getLocalTimeZone,
	today,
	type CalendarDate,
	type DateValue
} from '@internationalized/date';
import { DateTime } from 'luxon';
import ContentDrawer from '~/components/ContentDrawer.vue';
import type { Event } from '~/shared/types/event';

const props = defineProps<{
	user: User;
	title?: string;
}>();

const { user } = useAuth();
const i18n = useI18n();
const { name: displayName, handle, hasFullName } = useDisplayName(() => props.user);

const {
	avatar,
	currentEvents: events,
	currentEventsCount: totalEvents,
	fetchCurrentEvents,
	attendingEvents,
	fetchAttendingEvents,
	points,
	pointsHistory,
	fetchPoints,
	badges,
	fetchBadges
} = useUser(`@${props.user.username}`);
const {
	prompts,
	total: totalPrompts,
	fetch: fetchPrompts
} = useUserPrompts(props.user.id, 1, 25, 'rand');
const {
	articles,
	total: totalArticles,
	fetch: fetchArticles
} = useUserArticles(props.user.id, 1, 25, 'rand');
const { friends, fetchFriends, fetchFriendsPage } = useFriends(props.user.id);
const badgeVariants = ref<('outline' | 'solid')[]>([]);

// Fetch user profile data on mount
onMounted(() => {
	fetchFriends();
	fetchPrompts();
	fetchArticles();
	fetchCurrentEvents();
	fetchAttendingEvents();
	fetchPoints();
	fetchBadges();
});

function openEmail() {
	if (!props.user.account.email && !props.user.account.email_verified) return;
	window.location.href = `mailto:${props.user.account.email}`;
}

const drawerRef = ref<InstanceType<typeof ContentDrawer>>();
const mode = ref<'friends' | 'prompts' | 'articles' | 'hosting-events' | 'attending-events' | null>(
	null
);
const allFriends = ref<User[]>([]);
const allPrompts = ref<Prompt[]>([]);
const allArticles = ref<Article[]>([]);

const drawerTitle = computed(() => {
	if (mode.value === 'friends') return `${displayName.value}'s Friends`;
	if (mode.value === 'prompts') return `Prompts by ${displayName.value}`;
	if (mode.value === 'articles') return `Articles by ${displayName.value}`;
	if (mode.value === 'hosting-events') return `Events hosted by ${displayName.value}`;
	if (mode.value === 'attending-events') return `Events ${displayName.value} is Attending`;
	return '';
});

const search = computed(() => drawerRef.value?.search || '');

// Client-side filtering for already loaded content
const filteredFriends = computed(() => {
	if (!search.value.trim()) return allFriends.value;
	const searchLower = search.value.toLowerCase();
	return allFriends.value.filter((friend) => {
		const fullName = friend.full_name?.toLowerCase() || '';
		const username = friend.username.toLowerCase();
		return fullName.includes(searchLower) || username.includes(searchLower);
	});
});

const filteredPrompts = computed(() => {
	if (!search.value.trim()) return allPrompts.value;
	const searchLower = search.value.toLowerCase();
	return allPrompts.value.filter((prompt) => {
		return prompt.prompt.toLowerCase().includes(searchLower);
	});
});

const filteredArticles = computed(() => {
	if (!search.value.trim()) return allArticles.value;
	const searchLower = search.value.toLowerCase();
	return allArticles.value.filter((article) => {
		const title = article.title.toLowerCase();
		const description = article.description.toLowerCase();
		return title.includes(searchLower) || description.includes(searchLower);
	});
});

const filteredEvents = computed(() => {
	if (!search.value.trim()) return events.value;
	const searchLower = search.value.toLowerCase();
	return (events.value || []).filter((event) => {
		return event.name.toLowerCase().includes(searchLower);
	});
});

const friendsPage = ref(1);
const friendsHasMore = ref(true);
const promptsPage = ref(1);
const promptsHasMore = ref(true);
const articlesPage = ref(1);
const articlesHasMore = ref(true);
const isLoading = ref(false);

// load functions for each content type
async function loadFriends() {
	if (isLoading.value || !friendsHasMore.value) return;
	isLoading.value = true;

	const res = await fetchFriendsPage(friendsPage.value, 100, search.value);
	if (res.success && res.data) {
		if ('message' in res.data) {
			friendsHasMore.value = false;
		} else {
			allFriends.value.push(...res.data.items);
			friendsHasMore.value = allFriends.value.length < res.data.total;
			friendsPage.value++;
		}
	} else {
		friendsHasMore.value = false;
	}

	isLoading.value = false;
}

async function loadPrompts() {
	if (isLoading.value || !promptsHasMore.value) return;
	isLoading.value = true;

	const res = await fetchPrompts(promptsPage.value, 100, search.value);
	if (res.success && res.data) {
		if ('message' in res.data) {
			promptsHasMore.value = false;
		} else {
			allPrompts.value.push(...res.data.items);
			promptsHasMore.value = allPrompts.value.length < res.data.total;
			promptsPage.value++;
		}
	} else {
		promptsHasMore.value = false;
	}

	isLoading.value = false;
}

async function loadArticles() {
	if (isLoading.value || !articlesHasMore.value) return;
	isLoading.value = true;

	const res = await fetchArticles(articlesPage.value, 100, search.value);
	if (res.success && res.data) {
		if ('message' in res.data) {
			articlesHasMore.value = false;
		} else {
			allArticles.value.push(...res.data.items);
			articlesHasMore.value = allArticles.value.length < res.data.total;
			articlesPage.value++;
		}
	} else {
		articlesHasMore.value = false;
	}

	isLoading.value = false;
}

async function openFriends() {
	if (drawerRef.value) drawerRef.value.search = '';
	mode.value = 'friends';
	allFriends.value = [];
	friendsPage.value = 1;
	friendsHasMore.value = true;
	drawerRef.value?.open();
	await loadFriends();
}

async function openPrompts() {
	if (drawerRef.value) drawerRef.value.search = '';
	mode.value = 'prompts';
	allPrompts.value = [];
	promptsPage.value = 1;
	promptsHasMore.value = true;
	drawerRef.value?.open();
	await loadPrompts();
}

async function openArticles() {
	if (drawerRef.value) drawerRef.value.search = '';
	mode.value = 'articles';
	allArticles.value = [];
	articlesPage.value = 1;
	articlesHasMore.value = true;
	drawerRef.value?.open();
	await loadArticles();
}

async function openEvents() {
	if (drawerRef.value) drawerRef.value.search = '';
	mode.value = 'hosting-events';
	drawerRef.value?.open();
}

async function handleLoadMore() {
	if (mode.value === 'friends') await loadFriends();
	else if (mode.value === 'prompts') await loadPrompts();
	else if (mode.value === 'articles') await loadArticles();
}

const selectedDate: any = ref<DateValue | undefined>(undefined);
const currentEventsDay = ref<Date>(new Date());
const attendingEventsDay = ref<Event[]>([]);

const formattedCurrentDay = computed(() => {
	return currentEventsDay.value.toLocaleDateString('en-US', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
});

function isSelectedDate(day: any): boolean {
	if (!selectedDate.value) return false;
	return (
		selectedDate.value.year === day.year &&
		selectedDate.value.month === day.month &&
		selectedDate.value.day === day.day
	);
}

function eventsCountOn(day: any): number {
	if (!attendingEvents.value) return 0;

	return attendingEvents.value.filter((event) => {
		const eventStart = new Date(event.date);
		const eventEnd = event.end_date ? new Date(event.end_date) : eventStart;
		const checkDate = new Date(day.year, day.month - 1, day.day);

		return (
			checkDate >= new Date(eventStart.setHours(0, 0, 0, 0)) &&
			checkDate <= new Date(eventEnd.setHours(23, 59, 59, 999))
		);
	}).length;
}

function hasEventsOnDate(day: any): boolean {
	return eventsCountOn(day) > 0;
}

async function showEvents(day: CalendarDate | DateValue | undefined) {
	if (!day) {
		attendingEventsDay.value = [];
		return;
	}

	currentEventsDay.value = new Date(day.year, day.month - 1, day.day);
	attendingEventsDay.value = (attendingEvents.value || []).filter((event) => {
		const eventStart = new Date(event.date);
		const eventEnd = event.end_date ? new Date(event.end_date) : eventStart;
		const selectedDateTime = new Date(day.year, day.month - 1, day.day);

		return (
			selectedDateTime >= new Date(eventStart.setHours(0, 0, 0, 0)) &&
			selectedDateTime <= new Date(eventEnd.setHours(23, 59, 59, 999))
		);
	});
}

// Initialize calendar with today's events
onMounted(async () => {
	await Promise.all([fetchAttendingEvents(), fetchCurrentEvents()]);

	selectedDate.value = today(getLocalTimeZone()) as DateValue;
	showEvents(selectedDate.value as any);
});

async function openCurrentDayEvents() {
	if (drawerRef.value) drawerRef.value.search = '';
	mode.value = 'attending-events';
	drawerRef.value?.open();
}

const filteredAttendingEvents = computed(() => {
	if (!search.value.trim()) return attendingEvents.value || [];
	const searchLower = search.value.toLowerCase();
	return (attendingEvents.value || []).filter((event) => {
		return event.name.toLowerCase().includes(searchLower);
	});
});
</script>
