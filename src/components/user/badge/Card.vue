<template>
	<UserBadgeDisplay
		v-bind="$attrs"
		:badge="badge"
		:is-granted="isGranted"
		:is-mastered="isMastered"
		@clicked="noModal || (showDetails = true)"
	/>
	<UModal
		v-if="!noModal"
		v-model:open="showDetails"
		:dismissible="!masteryLoading"
		title="Badge Details"
		:description="badge.description"
	>
		<template #body>
			<div class="flex flex-col items-center gap-4">
				<UserBadgeDetailsHeader v-bind="badgeHeaderProps">
					<template #actions>
						<UTooltip
							v-if="badge.mastered"
							:text="
								masteredAtFormatted
									? `Mastered on ${masteredAtFormatted}`
									: 'You have completed the Badge Mastery quest for this badge.'
							"
						>
							<UBadge
								color="tertiary"
								variant="soft"
								icon="mdi:medal-outline"
								size="lg"
								>Mastered</UBadge
							>
						</UTooltip>
					</template>
				</UserBadgeDetailsHeader>
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
							:color="masteryButton.color"
							:variant="masteryButton.outlined ? 'outline' : 'soft'"
							:icon="masteryButton.icon"
							:loading="masteryButton.loading"
							:disabled="masteryButton.disabled"
							class="max-w-full whitespace-normal text-center"
							@click="handleMasteryClick"
						>
							{{ masteryButton.label }}
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
					<UserBadgeMasteryStatusText v-bind="masteryStatusProps" />
				</div>

				<UserBadgeIdFooter :badge="badge" />
			</div>
		</template>
	</UModal>

	<UModal
		v-if="!noModal"
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
					<span class="text-xs opacity-70">this may take up to two minutes</span>
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

	<SiteTour
		v-if="showDetails && canShowMastery"
		:steps="masteryTour"
		name="Badge Mastery Tour"
		tour-id="badge-mastery"
	/>
</template>
<script setup lang="ts">
import { BadgeMasteryGenerationError } from 'types/user';

defineOptions({
	inheritAttrs: false
});

const props = withDefaults(
	defineProps<{
		badge: Badge | UserBadge;
		noModal?: boolean;
	}>(),
	{
		noModal: false
	}
);

const userStore = useUserStore();
const { user: authUser } = useAuth();
const toast = useToast();
const { startTour } = useSiteTour();

const showDetails = ref(false);
const confirmOpen = ref(false);
const questOpen = ref(false);

const {
	masteryLoading,
	masteryStatusFetched,
	masteryLocked,
	masteryQuestReady,
	loadedQuest,
	generatingMessage,
	isGranted,
	isMastered,
	isCompletedMastery,
	canShowMastery,
	masteredAtFormatted,
	rarityColor,
	grantedAt,
	masteryDisabled,
	masteryQuestId,
	masteryProgress,
	masteryCompletedAt,
	masteryButton,
	badgeHeaderProps,
	masteryStatusProps,
	loadMasteryStatus,
	ensureMasteryListFetched
} = useBadgeMastery(() => props.badge);

const grantedTo = computed(() => {
	if (!isUserBadge(props.badge)) return null;
	const { user, fetchUser } = useUser(props.badge.user_id);
	if (!user.value) {
		fetchUser();
	}

	const { handle } = useDisplayName(user);
	return handle.value;
});

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
	if (!import.meta.client) return;
	if (loading) window.addEventListener('beforeunload', beforeUnloadHandler);
	else window.removeEventListener('beforeunload', beforeUnloadHandler);
});

onBeforeUnmount(() => {
	if (import.meta.client) window.removeEventListener('beforeunload', beforeUnloadHandler);
});

watch(showDetails, async (open) => {
	if (!open) return;
	if (!canShowMastery.value) return;

	ensureMasteryListFetched();

	// mastered badges short-circuit the status fetch — terminal state is known from badge.mastered,
	// so the button can render "View Completed Mastery" immediately without flashing a loading state
	if (isCompletedMastery.value) {
		masteryStatusFetched.value = true;
		return;
	}

	if (masteryStatusFetched.value) return;
	await loadMasteryStatus();
});

async function handleMasteryClick() {
	if (masteryDisabled.value) return;
	if (isCompletedMastery.value || masteryQuestReady.value) {
		await openExistingMasteryQuest();
		return;
	}
	confirmOpen.value = true;
}

async function openExistingMasteryQuest() {
	masteryLoading.value = true;
	try {
		// completed masteries need progress for the timeline to render step completion; the
		// list endpoint returns lean entries (no progress, no R2-inlined media), so lazy-fetch
		// the full entry here. fetches quest + progress in parallel.
		const tasks: Promise<unknown>[] = [];
		if (!loadedQuest.value || loadedQuest.value.id !== masteryQuestId.value) {
			tasks.push(
				userStore.getMasteryQuest(props.badge.id).then((q) => {
					if (q) loadedQuest.value = q;
				})
			);
		}
		const uid = authUser.value?.id;
		if (uid && isCompletedMastery.value) {
			tasks.push(userStore.fetchQuestHistoryEntry(uid, masteryQuestId.value));
		}
		await Promise.all(tasks);

		if (!loadedQuest.value || loadedQuest.value.id !== masteryQuestId.value) {
			toast.add({
				title: 'Mastery quest not found',
				description: isCompletedMastery.value
					? 'The quest timeline is no longer available (expired from history).'
					: 'Try generating it again.',
				icon: 'mdi:alert-circle',
				color: 'warning',
				duration: 4000
			});
			masteryQuestReady.value = false;
			return;
		}
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
				// Refetch status - it may have changed underneath us
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

const masteryTour = buildBadgeMasteryTour({
	masteryQuestReady,
	isInteractive: () => !masteryLocked.value && !masteryDisabled.value,
	onMasteryCtaClick: () => handleMasteryClick()
});

onMounted(() => {
	if (isUserBadge(props.badge)) {
		userStore.fetchUser(props.badge.user_id);
	}
});
</script>
