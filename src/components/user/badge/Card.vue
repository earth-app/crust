<template>
	<div
		class="flex justify-center w-70 aspect-video gap-4 p-4 rounded-lg border-4 border-gray-700 bg-gray-600 light:bg-gray-200 hover:opacity-90 transition-opacity duration-300 cursor-pointer"
		:class="[
			'user_id' in badge && badge.granted ? 'border-yellow-500' : '',
			badge.mastered ? 'ring-2 ring-purple-400/70' : ''
		]"
		@click="showDetails = true"
	>
		<UIcon
			:name="badge.icon"
			class="self-center min-h-8 min-w-8 sm:size-10 md:size-12 lg:size-16"
			:class="'user_id' in badge && badge.granted ? 'text-yellow-400' : ''"
		/>

		<div class="flex flex-col items-center gap-2">
			<UBadge
				:color="rarityColor"
				:trailing-icon="'user_id' in badge && badge.granted ? 'mdi:check' : ''"
				>{{ capitalizeFully(badge.rarity) }}</UBadge
			>
			<h3 class="font-semibold text-md md:text-lg">{{ badge.name }}</h3>
			<span class="text-sm opacity-90 text-center">{{ badge.description }}</span>
		</div>
	</div>
	<UModal
		v-model:open="showDetails"
		:dismissible="!masteryLoading"
		title="Badge Details"
		:description="badge.description"
	>
		<template #body>
			<div class="flex flex-col items-center gap-4">
				<UIcon
					:name="badge.icon"
					class="self-center min-h-12 min-w-12 sm:size-16 md:size-20 lg:size-24"
					:class="'user_id' in badge && badge.granted ? 'text-yellow-400' : ''"
				/>
				<div class="flex space-x-2 items-center">
					<h2 class="font-bold text-xl md:text-2xl">{{ badge.name }}</h2>
					<UBadge
						:color="rarityColor"
						:trailing-icon="'user_id' in badge && badge.granted ? 'mdi:check-bold' : ''"
						class="text-lg"
						>{{ capitalizeFully(badge.rarity) }}</UBadge
					>
					<UTooltip
						v-if="badge.mastered"
						:text="
							masteredAtNormal
								? `Mastered on ${masteredAtNormal}`
								: 'You have completed the Badge Mastery quest for this badge.'
						"
					>
						<UBadge
							color="warning"
							variant="soft"
							icon="mdi:medal-outline"
							size="lg"
							>Mastered</UBadge
						>
					</UTooltip>
				</div>
				<p class="text-center text-md md:text-lg">{{ badge.description }}</p>
				<span
					v-if="'granted' in badge && badge.granted"
					class="text-sm opacity-90 mt-2"
				>
					{{ grantedTo }} earned this badge on {{ grantedAt }}.
				</span>
				<div
					v-else-if="'progress' in badge"
					class="w-full px-8"
				>
					<UProgress
						:model-value="badge.progress * 100 || 0"
						class="w-full mt-1"
						:color="rarityColor"
						status
					/>
				</div>

				<div
					v-if="canShowMastery"
					id="badge-mastery-cta"
					class="flex flex-col items-center gap-2 w-full mt-2"
				>
					<div class="flex items-center gap-2">
						<UButton
							:color="masteryButtonColor"
							:variant="masteryButtonVariant"
							:icon="masteryButtonIcon"
							:loading="masteryLoading"
							:disabled="masteryDisabled"
							@click="handleMasteryClick"
						>
							{{ masteryButtonLabel }}
						</UButton>
						<UTooltip text="Learn about Badge Mastery">
							<UButton
								id="badge-mastery-help"
								color="secondary"
								variant="subtle"
								icon="mdi:progress-question"
								square
								@click="startTour('badge-mastery')"
							/>
						</UTooltip>
					</div>
					<span
						v-if="masteryStatusLoading"
						class="text-xs opacity-70 flex items-center gap-1"
					>
						<UIcon
							name="i-lucide-loader-circle"
							class="size-3 animate-spin"
						/>
						Checking mastery status…
					</span>
					<span
						v-else-if="masteryLocked"
						class="text-xs opacity-70 text-error text-center max-w-72"
					>
						This badge mastery has been permanently locked and cannot be regenerated.
					</span>
					<span
						v-else-if="masteryQuestReady && masteryExpiresInDays !== null"
						class="text-xs opacity-70 text-center max-w-72"
					>
						Pick up where you left off — expires in
						{{ masteryExpiresInDays }} day{{ masteryExpiresInDays === 1 ? '' : 's' }}. Resetting
						will permanently lock this mastery.
					</span>
					<span
						v-else-if="masteryQuestReady"
						class="text-xs opacity-70 text-center max-w-72"
					>
						Pick up where you left off. Resetting will permanently lock this mastery.
					</span>
					<span
						v-else-if="masteryCapReached"
						class="text-xs opacity-70 text-error text-center max-w-72"
					>
						You have {{ masteryList?.active }} / {{ masteryList?.cap }} active mastery quests.
						Complete or let one expire before generating another.
					</span>
					<span
						v-else-if="!masteryStatusFetched"
						class="text-xs opacity-60 text-center max-w-72"
					>
						Generate a personalised AI quest to deepen your mastery of this badge.
					</span>
					<span
						v-if="masteryList && !masteryCapReached && !masteryQuestReady && !masteryLocked"
						class="text-xs opacity-60 text-center"
					>
						{{ masteryList.active }} / {{ masteryList.cap }} active mastery slots used
					</span>
				</div>

				<div class="flex items-center">
					<span class="text-gray-700">id:{{ badge.id }}</span>
					<span
						v-if="badge.tracker_id"
						class="text-gray-700"
					>
						&nbsp;| tracker:{{ badge.tracker_id }}</span
					>
				</div>
			</div>
		</template>
	</UModal>

	<UModal
		v-model:open="confirmOpen"
		:dismissible="!masteryLoading"
		title="Start Badge Mastery Quest?"
	>
		<template #body>
			<div class="flex flex-col gap-3">
				<UAlert
					color="warning"
					variant="subtle"
					icon="mdi:alert-octagon-outline"
					title="This is a one-shot quest"
					description="Starting a Badge Mastery quest commits you. If you reset it or start a different quest before completing it, this mastery is gone forever and cannot be regenerated."
				/>
				<p class="text-sm opacity-80">
					We'll generate a personalised quest just for this badge using your profile context. Steps
					may include drawings, photos, audio, reading, and more.
				</p>
				<div
					v-if="masteryLoading"
					class="flex flex-col items-center gap-1 text-sm opacity-90"
				>
					<div class="flex items-center gap-2">
						<UIcon
							name="i-lucide-loader-circle"
							class="size-4 animate-spin"
						/>
						<span>{{ generatingMessage }}</span>
					</div>
					<span class="text-xs opacity-70">this may take up to a minute</span>
				</div>
				<div class="flex justify-end gap-2">
					<UButton
						color="neutral"
						variant="outline"
						:disabled="masteryLoading"
						@click="confirmOpen = false"
						>Cancel</UButton
					>
					<UButton
						color="primary"
						icon="mdi:medal-outline"
						:loading="masteryLoading"
						:disabled="masteryLoading"
						@click="confirmGenerate"
						>Generate &amp; Start</UButton
					>
				</div>
			</div>
		</template>
	</UModal>

	<LazyUserQuestModal
		v-if="loadedQuest"
		v-model:open="questOpen"
		:quest="loadedQuest"
		:progress="masteryProgress"
		:completed-at="masteryCompletedAt"
	/>

	<ClientOnly v-if="canShowMastery">
		<SiteTour
			:steps="masteryTour"
			name="Badge Mastery Tour"
			tour-id="badge-mastery"
		/>
	</ClientOnly>
</template>
<script setup lang="ts">
import { DateTime } from 'luxon';
import { BadgeMasteryGenerationError } from 'types/user';
import { capitalizeFully } from 'utils';

const props = defineProps<{
	badge: Badge | UserBadge;
}>();

const userStore = useUserStore();
const { user: authUser } = useAuth();
const toast = useToast();
const { startTour } = useSiteTour();

const showDetails = ref(false);
const confirmOpen = ref(false);
const questOpen = ref(false);

const masteryLoading = ref(false);
const masteryStatusLoading = ref(false);
const masteryStatusFetched = ref(false);
const masteryLocked = ref(false);
const masteryQuestReady = ref(false);
const loadedQuest = ref<Quest | null>(null);

// rotated while masteryLoading to signal the request is alive (gemma-4 inference can run 20-60s)
const generatingMessages = [
	'Loading...',
	'Generating your quest...',
	'Picking the perfect steps...',
	'Consulting the badge archives...',
	'Tuning difficulty to your profile...',
	'Polishing the timeline...',
	'Almost there...'
];
const generatingMessage = ref(generatingMessages[0]);
let generatingInterval: ReturnType<typeof setInterval> | null = null;

// beforeunload guard while generation is in-flight — abandoning the request loses the slot
// without a stored quest, so warn before letting the tab close/navigate
const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
	if (!masteryLoading.value) return;
	event.preventDefault();
	// the returnValue assignment is required for the browser to actually show the prompt;
	// the string content is ignored on modern browsers (generic "leave site?" is rendered)
	event.returnValue = 'A badge mastery quest is generating. Are you sure you want to leave?';
	return event.returnValue;
};

watch(masteryLoading, (loading) => {
	if (loading) {
		let i = 0;
		generatingMessage.value = generatingMessages[0];
		generatingInterval = setInterval(() => {
			i = (i + 1) % generatingMessages.length;
			generatingMessage.value = generatingMessages[i];
		}, 2500);
		if (import.meta.client) window.addEventListener('beforeunload', beforeUnloadHandler);
	} else {
		if (generatingInterval) {
			clearInterval(generatingInterval);
			generatingInterval = null;
		}
		if (import.meta.client) window.removeEventListener('beforeunload', beforeUnloadHandler);
	}
});

onBeforeUnmount(() => {
	if (generatingInterval) clearInterval(generatingInterval);
	if (import.meta.client) window.removeEventListener('beforeunload', beforeUnloadHandler);
});

const rarityColor = computed(() => {
	switch (props.badge.rarity) {
		case 'normal':
			return 'neutral';
		case 'rare':
			return 'info';
		case 'amazing':
			return 'warning';
		case 'green':
			return 'success';
	}
});

const grantedAt = computed(() =>
	DateTime.fromISO(
		'granted_at' in props.badge && props.badge.granted_at ? props.badge.granted_at : ''
	).toLocaleString(DateTime.DATETIME_MED)
);

const masteredAtNormal = computed(() => {
	if (!props.badge.mastered_at) return null;
	const dt = DateTime.fromISO(String(props.badge.mastered_at));
	return dt.isValid ? dt.toLocaleString(DateTime.DATETIME_MED) : null;
});

const grantedTo = computed(() => {
	if (!('user_id' in props.badge)) return null;
	const { user, fetchUser } = useUser(props.badge.user_id);
	if (!user.value) {
		fetchUser();
	}

	const { handle } = useDisplayName(user);
	return handle.value;
});

const isOwnBadge = computed(() => {
	if (!('user_id' in props.badge)) return false;
	return authUser.value?.id === props.badge.user_id;
});

const canShowMastery = computed(() => {
	if (!isOwnBadge.value) return false;
	if (!('granted' in props.badge) || !props.badge.granted) return false;
	if (props.badge.mastered) return false;
	if (props.badge.mastery_exempt) return false;
	return true;
});

// cap state pulled from the per-user mastery list cached in userStore. cap blocks NEW
// generation only — a quest already generated (masteryQuestReady) is always startable
const masteryList = computed(() => {
	const uid = authUser.value?.id;
	if (!uid) return null;
	return userStore.masteryLists.get(uid) ?? null;
});
const masteryCapReached = computed(() => {
	const list = masteryList.value;
	if (!list) return false;
	return list.active >= list.cap;
});

// 90-day expiry banner; only meaningful when a quest has been generated for THIS badge
const masteryExpiresAt = computed(() => {
	const item = masteryList.value?.items.find((i) => i.badge_id === props.badge.id);
	if (!item) return null;
	return DateTime.fromMillis(item.expires_at);
});
const masteryExpiresInDays = computed(() => {
	const exp = masteryExpiresAt.value;
	if (!exp) return null;
	const diff = exp.diffNow('days').days;
	return diff > 0 ? Math.ceil(diff) : 0;
});

const masteryDisabled = computed(
	() =>
		masteryLoading.value ||
		masteryStatusLoading.value ||
		masteryLocked.value ||
		// only block generation at cap; once the quest is ready, the button means "Continue"
		(masteryCapReached.value && !masteryQuestReady.value)
);

const masteryButtonLabel = computed(() => {
	if (masteryLocked.value) return 'Mastery permanently locked';
	if (masteryQuestReady.value) return 'Continue Mastery Quest';
	if (masteryCapReached.value) return 'Mastery Cap Reached';
	return 'Master This Badge';
});
const masteryButtonIcon = computed(() => {
	if (masteryLocked.value) return 'mdi:lock';
	if (masteryQuestReady.value) return 'mdi:play-circle-outline';
	if (masteryCapReached.value) return 'mdi:alert-octagon-outline';
	return 'mdi:medal-outline';
});
const masteryButtonColor = computed(() => {
	if (masteryLocked.value) return 'neutral';
	if (masteryQuestReady.value) return 'warning';
	if (masteryCapReached.value) return 'neutral';
	return 'primary';
});
const masteryButtonVariant = computed(() =>
	masteryLocked.value || masteryCapReached.value ? 'outline' : 'soft'
);

const masteryQuestId = computed(() => `badge_mastery_${props.badge.id}`);

const masteryProgress = computed(() => {
	const userId = authUser.value?.id;
	if (!userId) return undefined;
	const current = userStore.quest.get(userId);
	if (current?.questId === masteryQuestId.value) return current.progress;
	const history = userStore.questHistory.get(userId);
	const completed = history?.get(masteryQuestId.value);
	return completed?.progress;
});

const masteryCompletedAt = computed(() => {
	const userId = authUser.value?.id;
	if (!userId) return undefined;
	const history = userStore.questHistory.get(userId);
	const completed = history?.get(masteryQuestId.value);
	return completed?.completedAt;
});

watch(showDetails, async (open) => {
	if (!open) return;
	if (!canShowMastery.value) return;
	const uid = authUser.value?.id;
	// best-effort cap snapshot; cached after first open so subsequent modal opens are instant
	if (uid && !userStore.masteryLists.has(uid)) userStore.fetchMasteryList(uid);
	if (masteryStatusFetched.value) return;
	await loadMasteryStatus();
});

async function loadMasteryStatus() {
	const userId = authUser.value?.id;
	if (!userId) return;
	masteryStatusLoading.value = true;
	try {
		if (userStore.lockedMasteries.has(props.badge.id)) {
			masteryLocked.value = true;
		}
		const status = await userStore.getMasteryStatus(userId, props.badge.id);
		masteryStatusFetched.value = true;
		if (!status) {
			masteryLocked.value = userStore.lockedMasteries.has(props.badge.id);
			return;
		}
		masteryLocked.value = status.locked;
		masteryQuestReady.value = status.generated && !status.mastered && !status.locked;
		if (status.quest) {
			loadedQuest.value = status.quest;
		}
	} catch (e) {
		console.warn('Failed to load badge mastery status', e);
	} finally {
		masteryStatusLoading.value = false;
	}
}

async function handleMasteryClick() {
	if (masteryDisabled.value) return;
	if (masteryQuestReady.value) {
		await openExistingMasteryQuest();
		return;
	}
	confirmOpen.value = true;
}

async function openExistingMasteryQuest() {
	masteryLoading.value = true;
	try {
		let quest = loadedQuest.value;
		if (!quest || quest.id !== masteryQuestId.value) {
			quest = await userStore.getMasteryQuest(props.badge.id);
		}
		if (!quest) {
			toast.add({
				title: 'Mastery quest not found',
				description: 'Try generating it again.',
				icon: 'mdi:alert-circle',
				color: 'warning',
				duration: 4000
			});
			masteryQuestReady.value = false;
			return;
		}
		loadedQuest.value = quest;
		showDetails.value = false;
		await nextTick();
		questOpen.value = true;
	} catch (e: any) {
		toast.add({
			title: 'Failed to open mastery quest',
			description: e?.message,
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 4000
		});
	} finally {
		masteryLoading.value = false;
	}
}

async function confirmGenerate() {
	const userId = authUser.value?.id;
	if (!userId) return;
	masteryLoading.value = true;
	try {
		const quest = await userStore.generateMastery(userId, props.badge.id);
		loadedQuest.value = quest;
		masteryQuestReady.value = true;
		toast.add({
			title: 'Mastery quest ready!',
			description: `Your personalised quest for "${props.badge.name}" has been generated.`,
			icon: 'mdi:medal-outline',
			color: 'success',
			duration: 4000
		});
		confirmOpen.value = false;
		showDetails.value = false;
		await nextTick();
		questOpen.value = true;
	} catch (e) {
		if (e instanceof BadgeMasteryGenerationError) {
			if (e.code === 'locked') {
				masteryLocked.value = true;
				confirmOpen.value = false;
				toast.add({
					title: 'Mastery locked',
					description: 'This badge mastery has been permanently locked.',
					icon: 'mdi:lock',
					color: 'error',
					duration: 5000
				});
			} else if (e.code === 'exempt') {
				confirmOpen.value = false;
				toast.add({
					title: 'Mastery not available',
					description: 'This badge does not support mastery quests.',
					icon: 'i-heroicons-information-circle',
					color: 'warning',
					duration: 5000
				});
			} else if (e.code === 'conflict') {
				toast.add({
					title: "Can't generate right now",
					description:
						e.message || 'This badge already has a mastery quest, or you have not earned it yet.',
					icon: 'mdi:alert-circle',
					color: 'warning',
					duration: 5000
				});
				// Refetch status — it may have changed underneath us
				masteryStatusFetched.value = false;
				await loadMasteryStatus();
			} else if (e.code === 'cap_reached') {
				confirmOpen.value = false;
				toast.add({
					title: 'Mastery cap reached',
					description:
						e.message ||
						'Complete one of your active mastery quests (or let one expire) before generating another.',
					icon: 'mdi:alert-octagon-outline',
					color: 'warning',
					duration: 6000
				});
			} else if (e.code === 'ai_failed') {
				toast.add({
					title: 'Generation failed',
					description: 'Try again in a moment.',
					icon: 'mdi:robot-confused',
					color: 'warning',
					duration: 4000
				});
			} else {
				toast.add({
					title: 'Something went wrong',
					description: e.message,
					icon: 'mdi:alert-circle',
					color: 'error',
					duration: 4000
				});
			}
		} else {
			toast.add({
				title: 'Generation failed',
				description: (e as Error)?.message || 'Unexpected error',
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 4000
			});
		}
	} finally {
		masteryLoading.value = false;
	}
}

const masteryTour: SiteTourStep[] = [
	{
		id: 'badge-mastery-cta',
		title: 'Badge Mastery',
		description:
			'After earning a badge, you can deepen it with a personalised AI quest tailored to your profile and activities.',
		footer: 'Click "Next" to learn how starting a mastery quest works.'
	},
	{
		id: 'badge-mastery-cta',
		title: 'One-shot commitment',
		description:
			'Each Badge Mastery is a single attempt. Resetting the quest or starting a different one before finishing will permanently lock the mastery for that badge.',
		footer: "You'll get a clear confirmation prompt before generation starts."
	},
	{
		id: 'badge-mastery-help',
		title: 'Need a refresher?',
		description:
			'Click this help button any time to revisit this tour. The "Mastered" badge will appear here once you finish the quest.',
		footer: 'Good luck!'
	}
];

onMounted(() => {
	if ('user_id' in props.badge) {
		userStore.fetchUser(props.badge.user_id);
	}
});
</script>
