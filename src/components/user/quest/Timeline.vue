<template>
	<div class="flex flex-col w-full h-full">
		<div class="flex justify-center my-2">
			<UButton
				v-if="isCurrentQuest"
				id="quest-button"
				color="error"
				variant="soft"
				:loading="loading"
				:disabled="loading"
				class="self-center"
				@click="handleEndClick"
				>End Quest</UButton
			>

			<UTooltip
				v-else-if="mobileOnly && !completed"
				text="This quest is only available in The Earth App mobile app. Tap to install or open."
			>
				<UButton
					id="quest-button"
					color="info"
					variant="soft"
					icon="mdi:cellphone-arrow-down"
					:to="appConfig.mobile.getTheAppUrl"
					target="_blank"
					rel="noopener"
					class="self-center"
					>Open in The Earth App</UButton
				>
			</UTooltip>

			<UTooltip
				v-else-if="hasOtherActiveQuest && !completed"
				:text="activeQuestReplaceTooltip"
			>
				<UButton
					id="quest-button"
					color="warning"
					variant="soft"
					:loading="loading"
					:disabled="loading"
					class="self-center"
					@click="handleReplaceClick"
					>Replace &amp; Start Quest</UButton
				>
			</UTooltip>

			<UButton
				v-else-if="!isCurrentQuest && !completed"
				id="quest-button"
				color="primary"
				:loading="loading"
				:disabled="loading || questLoading"
				class="self-center"
				@click="handleStart(false)"
				>Start Quest</UButton
			>

			<UButton
				v-else
				id="quest-button"
				color="neutral"
				disabled
				class="self-center"
				>Quest Completed</UButton
			>

			<UButton
				color="secondary"
				icon="mdi:progress-question"
				variant="subtle"
				class="ml-2"
				@click="startTour(`quest-timeline-${props.quest.id}`)"
			/>
		</div>
		<div
			v-for="(item, index) in items"
			:key="index"
			class="flex flex-col items-center w-full min-h-36"
		>
			<div
				:id="`tile-${index}`"
				class="flex gap-2 items-start my-2"
				:class="
					isCurrentQuest && currentIndex === index
						? 'ring-2 ring-neutral ring-offset-2 p-2 rounded-lg'
						: ''
				"
			>
				<UPopover
					v-if="Array.isArray(item)"
					v-for="(altStep, altIndex) in item"
					mode="hover"
				>
					<div class="flex flex-col items-center gap-1">
						<UChip
							:show="isStepMobileOnly(altStep)"
							color="info"
							position="top-right"
							:ui="{ base: 'size-4 p-0' }"
						>
							<template #content>
								<UIcon
									name="mdi:cellphone"
									class="size-2.5 text-inverted"
								/>
							</template>
							<LazyUBadge
								:key="altIndex"
								:id="`tile-${index}:${altIndex}`"
								:icon="altStep.icon"
								:color="
									isCurrentQuest
										? isCurrentStep(index)
											? 'primary'
											: altStep.completed
												? 'warning'
												: 'secondary'
										: 'neutral'
								"
								:variant="altStep.completed ? 'solid' : 'subtle'"
								size="xl"
								:class="
									altStep.delayedUntil > now || isFutureStep(index)
										? 'opacity-40 hover:cursor-not-allowed'
										: 'hover:cursor-pointer'
								"
								@click="selectStep(altStep, index)"
								hydrate-on-visible
							/>
						</UChip>
						<span
							v-if="altStep.reward"
							class="text-xs opacity-70"
							>+{{ altStep.reward }}</span
						>
					</div>

					<template #content>
						<div class="flex items-center justify-center p-4 max-w-72 gap-1">
							<UIcon
								:name="altStep.icon"
								class="min-h-8 min-w-8 size-8 text-primary"
							/>
							<div class="flex flex-col ml-2">
								<p class="text-sm opacity-90">{{ trimString(altStep.description, 150) }}</p>
								<p
									v-if="isStepMobileOnly(altStep)"
									class="flex items-center gap-1 text-xs font-semibold text-info mt-1"
								>
									<UIcon
										name="mdi:cellphone-lock"
										class="size-3.5"
									/>
									Mobile Only
								</p>
								<p
									v-if="altStep.reward"
									class="text-xs opacity-70 mt-1"
								>
									+{{ altStep.reward }} Bonus Points
								</p>
								<p
									v-if="altStep.delay"
									class="text-xs opacity-70 mt-1"
								>
									<template v-if="altStep.effectiveDelay === 0">
										Available immediately
										<UBadge
											color="warning"
											variant="subtle"
											size="xs"
											icon="mdi:lightning-bolt"
											class="ml-1"
											>{{ delayReductionLabel }}</UBadge
										>
									</template>
									<template v-else>
										Can be completed {{ formatTime(altStep.effectiveDelay) }} after completing
										previous step
										<UBadge
											v-if="delayReductionLabel"
											color="warning"
											variant="subtle"
											size="xs"
											icon="mdi:lightning-bolt"
											class="ml-1"
											>{{ delayReductionLabel }}</UBadge
										>
									</template>
								</p>
								<p
									v-if="altStep.completed"
									class="text-xs opacity-80 font-semibold mt-1 text-primary"
								>
									Completed {{ formatRelative(altStep.completedAt) }}
								</p>
							</div>
						</div>
					</template>
				</UPopover>
				<UPopover
					v-else
					mode="hover"
				>
					<div class="flex flex-col items-center gap-1">
						<UChip
							:show="isStepMobileOnly(item)"
							color="info"
							position="top-right"
							:ui="{ base: 'size-4 p-0' }"
						>
							<template #content>
								<UIcon
									name="mdi:cellphone"
									class="size-2.5 text-inverted"
								/>
							</template>
							<LazyUBadge
								:id="`tile-${index}:0`"
								:icon="item.icon"
								:color="
									isCurrentQuest
										? isCurrentStep(index)
											? 'primary'
											: item.completed
												? 'warning'
												: 'secondary'
										: 'neutral'
								"
								:variant="item.completed ? 'solid' : 'subtle'"
								size="xl"
								:class="
									item.delayedUntil > now || isFutureStep(index)
										? 'opacity-40 hover:cursor-not-allowed'
										: 'hover:cursor-pointer'
								"
								@click="selectStep(item, index)"
								hydrate-on-visible
							/>
						</UChip>

						<span
							v-if="item.reward"
							class="text-xs opacity-70"
							>+{{ item.reward }}</span
						>
					</div>
					<template #content>
						<div class="flex items-center justify-center p-4 max-w-72 gap-1">
							<UIcon
								:name="item.icon"
								class="min-h-8 min-w-8 size-8 text-primary"
							/>
							<div class="flex flex-col ml-2">
								<p class="text-sm opacity-90">{{ trimString(item.description, 150) }}</p>
								<p
									v-if="isStepMobileOnly(item)"
									class="flex items-center gap-1 text-xs font-semibold text-info mt-1"
								>
									<UIcon
										name="mdi:cellphone-lock"
										class="size-3.5"
									/>
									Mobile Only
								</p>
								<p
									v-if="item.reward"
									class="text-xs opacity-70 mt-1"
								>
									+{{ item.reward }} Bonus Points
								</p>
								<p
									v-if="item.delay"
									class="text-xs opacity-70 mt-1"
								>
									<template v-if="item.effectiveDelay === 0">
										Available immediately
										<UBadge
											color="warning"
											variant="subtle"
											size="xs"
											icon="mdi:lightning-bolt"
											class="ml-1"
											>{{ delayReductionLabel }}</UBadge
										>
									</template>
									<template v-else>
										Can be completed {{ formatTime(item.effectiveDelay) }} after completing previous
										step
										<UBadge
											v-if="delayReductionLabel"
											color="warning"
											variant="subtle"
											size="xs"
											icon="mdi:lightning-bolt"
											class="ml-1"
											>{{ delayReductionLabel }}</UBadge
										>
									</template>
								</p>
								<p
									v-if="item.completed"
									class="text-xs opacity-80 font-semibold mt-1 text-primary"
								>
									Completed
									{{ formatRelative(item.completedAt) }}
								</p>
							</div>
						</div>
					</template>
				</UPopover>
			</div>
			<LazyUProgress
				:model-value="Number(Array.isArray(item) ? item.some((s) => s.completed) : item.completed)"
				:max="1"
				orientation="vertical"
				class="min-h-16"
				hydrate-on-visible
			/>
		</div>
		<div class="flex flex-col items-center my-4 min-h-36 gap-1">
			<LazyUBadge
				id="tile-end"
				icon="mdi:medal-outline"
				color="warning"
				variant="solid"
				size="xl"
				class="self-center"
				hydrate-on-visible
			/>
			<span class="text-xs opacity-70">+{{ props.quest.reward }}</span>
		</div>

		<ClientOnly>
			<SiteTour
				:steps="timelineTour"
				:name="`Quest Timeline Tour (${props.quest.title})`"
				:tour-id="`quest-timeline-${props.quest.id}`"
			/>
		</ClientOnly>

		<UModal
			v-model:open="masteryConfirmOpen"
			:dismissible="!loading"
			:title="masteryConfirmTitle"
		>
			<template #body>
				<div class="flex flex-col gap-3">
					<UAlert
						color="warning"
						variant="subtle"
						icon="mdi:alert-octagon-outline"
						:title="masteryConfirmTitle"
						:description="masteryConfirmDescription"
					/>
					<div class="flex justify-end gap-2 mt-2">
						<UButton
							color="neutral"
							variant="outline"
							:disabled="loading"
							@click="masteryConfirmOpen = false"
							>Keep mastery</UButton
						>
						<UButton
							color="error"
							:loading="loading"
							:disabled="loading"
							@click="confirmMasteryAction"
							>{{ masteryConfirmCta }}</UButton
						>
					</div>
				</div>
			</template>
		</UModal>
	</div>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';

const props = defineProps<{
	quest: Quest;
	progress?: (QuestProgressEntry | QuestProgressEntry[])[];
}>();

const emit = defineEmits<{
	'select-step': [
		step: QuestStep & {
			icon: string;
			completed: boolean;
			index: number;
			altIndex?: number;
			isCurrentQuest: boolean;
			isUnlocked: boolean;
			data?: string;
		}
	];
}>();

const { user } = useAuth();
const userId = computed(() => user.value?.id);
const { quest, questHistory, fetchUserQuest, startQuest, endQuest } = useUser(userId);
const appConfig = useAppConfig();

const accountType = computed(() => user.value?.account.account_type);
const delayReduction = computed(() => getQuestDelayReduction(accountType.value));
const delayReductionLabel = computed(() => {
	const r = delayReduction.value;
	if (r <= 0) return null;
	if (r >= 1) return 'Bypass';
	return `${Math.round(r * 100)}% Faster`;
});
function effectiveDelay(rawDelay?: number) {
	return getEffectiveQuestStepDelay(rawDelay ?? 0, accountType.value);
}
const { getStepIcon } = useQuests();
const toast = useToast();

const loading = ref(false);
const now = ref(Date.now());
useIntervalFn(() => {
	now.value = Date.now();
}, 10_000);

watch(
	userId,
	(currentUserId) => {
		if (currentUserId) {
			fetchUserQuest();
		}
	},
	{ immediate: true }
);

const completed = computed(() => {
	if (quest.value?.questId === props.quest.id) return false;
	return questHistory.value?.get(props.quest.id)?.completedAt !== undefined;
});

// true while the initial quest fetch hasn't resolved yet (quest is still undefined)
const questLoading = computed(() => quest.value === undefined);
const isCurrentQuest = computed(() => !!quest.value && quest.value.questId === props.quest.id);

const mobileOnly = computed(() => props.quest.mobile_only === true);

type TimelineStep = QuestStep & {
	icon: string;
	index: number;
	altIndex?: number;
	completed: boolean;
	completedAt: number;
	effectiveDelay: number;
	delayedUntil: number;
};

// A step is unavailable here when it (or its parent quest) is mobile-only.
// Alternatives are normally provided so desktop users can still progress.
function isStepMobileOnly(step: { mobile_only?: boolean }) {
	return step.mobile_only === true || mobileOnly.value;
}

function selectStep(step: TimelineStep, index: number) {
	if (step.delayedUntil > now.value) {
		const secondsRemaining = Math.ceil((step.delayedUntil - now.value) / 1000);
		toast.add({
			title: 'Step locked',
			description: `This step unlocks in ${formatTime(secondsRemaining)}.`,
			icon: 'mdi:lock-clock',
			color: 'info',
			duration: 4000
		});
		return;
	}
	if (isFutureStep(index)) return;

	if (isStepMobileOnly(step)) {
		toast.add({
			title: 'Mobile Only',
			description:
				'This step can only be completed in The Earth App mobile app. Complete an alternative step if one is available.',
			icon: 'mdi:cellphone-lock',
			color: 'info',
			duration: 4000,
			actions: [
				{
					label: 'Open in The Earth App',
					icon: 'mdi:cellphone-arrow-down',
					color: 'info',
					variant: 'solid',
					to: appConfig.mobile.getTheAppUrl,
					target: '_blank',
					rel: 'noopener'
				}
			]
		});
		return;
	}

	emit('select-step', {
		...step,
		isCurrentQuest: isCurrentQuest.value,
		isUnlocked: isUnlocked(index)
	});
}

function isCurrentStep(index: number) {
	if (!quest.value) return false;
	return currentIndex.value === index;
}

function isUnlocked(index: number) {
	if (!quest.value) return false;
	if (currentIndex.value === -1) return true;
	return index <= currentIndex.value;
}

// only the active quest's future tiles are locked; past alt-step groups stay
// clickable so users can fill in alternatives before finishing the quest.
function isFutureStep(index: number) {
	if (!isCurrentQuest.value) return false;
	const ci = currentIndex.value;
	if (ci < 0) return false;
	return index > ci;
}

function formatTime(seconds: number) {
	const hours = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	const secs = seconds % 60;

	if (hours > 0 && mins === 0 && secs === 0) return `${hours}h`;
	if (hours > 0) return `${hours}h ${mins}m`;
	if (mins > 0 && secs === 0) return `${mins}m`;
	if (mins > 0) return `${mins}m ${secs}s`;

	return `${secs}s`;
}

const i18n = useI18n();

function formatRelative(millis: number) {
	return DateTime.fromMillis(millis).toRelative({ locale: i18n.locale.value });
}

const hasOtherActiveQuest = computed(
	() => !!quest.value?.questId && quest.value.questId !== props.quest.id
);

const isMasteryQuest = computed(() => props.quest.id.startsWith('badge_mastery_'));
const activeQuestIsMastery = computed(() =>
	(quest.value?.questId ?? '').startsWith('badge_mastery_')
);

const activeQuestReplaceTooltip = computed(() => {
	if (activeQuestIsMastery.value) {
		return `You're in the middle of a Badge Mastery quest (${quest.value?.quest.title}). Starting this one will permanently lock that mastery.`;
	}
	return `You already have an active quest (${quest.value?.quest.title}). Starting this one will replace it.`;
});

type MasteryConfirmAction = 'end' | 'replace' | null;
const masteryConfirmOpen = ref(false);
const masteryConfirmAction = ref<MasteryConfirmAction>(null);

const masteryConfirmTitle = computed(() => {
	if (masteryConfirmAction.value === 'end') return 'End this mastery quest?';
	if (masteryConfirmAction.value === 'replace') return 'Abandon mastery for this quest?';
	return 'Mastery warning';
});
const masteryConfirmDescription = computed(() => {
	if (masteryConfirmAction.value === 'end') {
		return 'This Badge Mastery quest is one-shot. Ending it now will permanently lock the mastery - you will not be able to regenerate it again.';
	}
	if (masteryConfirmAction.value === 'replace') {
		return `Your active quest "${quest.value?.quest.title}" is a Badge Mastery quest. Starting this one will permanently lock that mastery.`;
	}
	return '';
});
const masteryConfirmCta = computed(() => {
	if (masteryConfirmAction.value === 'end') return 'End & lock mastery';
	if (masteryConfirmAction.value === 'replace') return 'Lock mastery & start';
	return 'Confirm';
});

function handleEndClick() {
	if (isCurrentQuest.value && isMasteryQuest.value) {
		masteryConfirmAction.value = 'end';
		masteryConfirmOpen.value = true;
		return;
	}
	handleEnd();
}

function handleReplaceClick() {
	if (activeQuestIsMastery.value) {
		masteryConfirmAction.value = 'replace';
		masteryConfirmOpen.value = true;
		return;
	}
	handleStart(true);
}

async function confirmMasteryAction() {
	if (masteryConfirmAction.value === 'end') {
		await handleEnd();
	} else if (masteryConfirmAction.value === 'replace') {
		await handleStart(true);
	}
	masteryConfirmOpen.value = false;
	masteryConfirmAction.value = null;
}

const PERMISSION_LABELS: Record<NonNullable<Quest['permissions']>[number], string> = {
	camera: 'camera',
	record: 'microphone',
	location: 'location'
};

async function requestQuestPermissions(
	perms: NonNullable<Quest['permissions']>
): Promise<{ ok: true } | { ok: false; failed: NonNullable<Quest['permissions']>[number] }> {
	for (const perm of perms) {
		try {
			if (perm === 'camera') {
				const s = await navigator.mediaDevices.getUserMedia({ video: true });
				s.getTracks().forEach((t) => t.stop());
			} else if (perm === 'record') {
				const s = await navigator.mediaDevices.getUserMedia({ audio: true });
				s.getTracks().forEach((t) => t.stop());
			} else if (perm === 'location') {
				await new Promise<void>((resolve, reject) => {
					if (!navigator.geolocation) {
						reject(new Error('Geolocation is not supported by this browser.'));
						return;
					}
					navigator.geolocation.getCurrentPosition(
						() => resolve(),
						(err) => reject(err)
					);
				});
			}
		} catch {
			return { ok: false, failed: perm };
		}
	}
	return { ok: true };
}

async function handleStart(override: boolean = false) {
	if (mobileOnly.value) {
		toast.add({
			title: 'Mobile app only',
			description: 'This quest can only be started from The Earth App mobile app.',
			icon: 'mdi:cellphone-lock',
			color: 'info',
			duration: 4000
		});
		return;
	}

	loading.value = true;
	try {
		const perms = props.quest.permissions ?? [];
		if (perms.length > 0) {
			const result = await requestQuestPermissions(perms);
			if (!result.ok) {
				toast.add({
					title: 'Permission required',
					description: `This quest needs ${PERMISSION_LABELS[result.failed]} access. Please grant it in your browser and try again.`,
					icon: 'mdi:lock-alert-outline',
					color: 'error',
					duration: 5000
				});
				return;
			}
		}

		const res = await startQuest(props.quest.id, override);
		toast.add({
			title: 'Quest started!',
			description: res.message,
			icon: 'mdi:sword-cross',
			color: 'success',
			duration: 3000
		});
	} catch (e: any) {
		toast.add({
			title: 'Failed to start quest',
			description: e?.message,
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 4000
		});
	} finally {
		loading.value = false;
	}
}

async function handleEnd() {
	loading.value = true;
	try {
		const res = await endQuest();
		toast.add({
			title: 'Quest ended',
			icon: 'mdi:flag-checkered',
			description: res.message,
			color: 'neutral',
			duration: 3000
		});
	} catch (e: any) {
		toast.add({
			title: 'Failed to end quest',
			description: e?.message,
			color: 'error',
			duration: 4000
		});
	} finally {
		loading.value = false;
	}
}

function getPrevCompletedAt(index: number): number {
	if (index === 0) return 0;
	const prev = props.progress?.[index - 1];
	if (!prev) return 0;
	if (Array.isArray(prev)) {
		return prev.find((p) => p.submittedAt)?.submittedAt || 0;
	}
	return prev.submittedAt || 0;
}

const items = computed(() => {
	if (!props.quest) return [];

	return props.quest.steps.map((step, index) => {
		const prevCompletedAt = getPrevCompletedAt(index);

		if (Array.isArray(step)) {
			return step.map((altStep, altIndex) => {
				// progress[index] is QuestProgressEntry[] for alt-step groups
				const progSlot = props.progress?.[index];
				const entry = Array.isArray(progSlot)
					? progSlot.find((p) => p.altIndex === altIndex)
					: undefined;

				const effSeconds = effectiveDelay(altStep.delay);
				return {
					...altStep,
					icon: getStepIcon(altStep.type),
					index,
					altIndex,
					completed: !!entry,
					completedAt: entry?.submittedAt || 0,
					effectiveDelay: effSeconds,
					delayedUntil: effSeconds && prevCompletedAt ? prevCompletedAt + effSeconds * 1000 : 0
				};
			});
		} else {
			// progress[index] is QuestProgressEntry for regular steps
			const progSlot = props.progress?.[index];
			const entry = !Array.isArray(progSlot) ? progSlot : undefined;

			const effSeconds = effectiveDelay(step.delay);
			return {
				...step,
				icon: getStepIcon(step.type),
				index,
				completed: !!entry,
				completedAt: entry?.submittedAt || 0,
				effectiveDelay: effSeconds,
				delayedUntil: effSeconds && prevCompletedAt ? prevCompletedAt + effSeconds * 1000 : 0
			};
		}
	});
});

const currentIndex = computed(() => {
	if (!props.quest) return 0;

	return items.value.findIndex((item) => {
		if (Array.isArray(item)) {
			return !item.some((s) => s.completed);
		} else {
			return !item.completed;
		}
	});
});

// surface a "step complete" toast each time a step is freshly finished, so web
// users get the same feedback the mobile app gives. keyed per entry
// (index:altIndex) so completing a bonus alternative in an already-finished group
// notifies too. the final step that completes the whole quest is skipped here -
// the global completion overlay owns that celebration.
function collectCompletedRewards(): Map<string, number> {
	const map = new Map<string, number>();
	for (const item of items.value) {
		if (Array.isArray(item)) {
			for (const alt of item) {
				if (alt.completed) map.set(`${alt.index}:${alt.altIndex}`, alt.reward ?? 0);
			}
		} else if (item.completed) {
			map.set(`${item.index}`, item.reward ?? 0);
		}
	}
	return map;
}

let knownCompleted = new Set<string>();
let completionArmed = false;

watch(
	items,
	() => {
		const current = collectCompletedRewards();
		const currentKeys = new Set(current.keys());

		// arm only once real progress has loaded, capturing already-completed steps
		// as the baseline so opening a partially/fully finished quest never toasts.
		if (!completionArmed) {
			if (props.progress === undefined) return;
			knownCompleted = currentKeys;
			completionArmed = true;
			return;
		}

		let freshReward = 0;
		let hasFresh = false;
		for (const [key, reward] of current) {
			if (!knownCompleted.has(key)) {
				hasFresh = true;
				freshReward += reward;
			}
		}
		knownCompleted = currentKeys;

		if (!hasFresh || completed.value) return;

		toast.add({
			title: 'Step complete!',
			description:
				freshReward > 0
					? `+${freshReward} bonus points earned`
					: 'Nice work — on to the next step.',
			icon: 'mdi:check-circle',
			color: 'success',
			duration: 3000
		});
	},
	{ immediate: true }
);

// quest timeline tour

const { startTour } = useSiteTour();

const hasAltStepGroup = computed(() => (props.quest?.steps ?? []).some((s) => Array.isArray(s)));

const timelineTour = computed<SiteTourStep[]>(() => [
	{
		id: 'quest-button',
		title: 'Start This Quest',
		description:
			'Press the button above to begin. Only one quest can be active at a time - starting a new one replaces your current active quest.',
		footer:
			'Heads up: Badge Mastery quests are one-shot. The button color tells you which state you’re in.',
		icon: 'mdi:sword-cross',
		placement: 'bottom',
		highlightPadding: 6,
		condition: () => !mobileOnly.value && !isCurrentQuest.value && !completed.value,
		cta: {
			label: hasOtherActiveQuest.value ? 'Replace & Start' : 'Start Quest',
			icon: 'mdi:sword-cross',
			color: hasOtherActiveQuest.value ? 'warning' : 'success',
			advance: true,
			handler: () => (hasOtherActiveQuest.value ? handleReplaceClick() : handleStart(false))
		}
	},
	{
		id: 'quest-button',
		title: 'Quest in Progress',
		description:
			'This quest is currently active. Open any step below to submit progress, or press End Quest above to step away.',
		footer:
			'Ending a Badge Mastery quest is permanent - for regular quests you can pick another up later.',
		icon: 'mdi:shield-sword',
		placement: 'bottom',
		highlightPadding: 6,
		condition: () => isCurrentQuest.value && !completed.value
	},
	{
		id: 'tile-0',
		title: 'Quest Steps',
		description:
			'Each badge below is a step. Tap one to see what it asks of you and submit your progress. The active step has a ring around it.',
		footer:
			'A step with multiple badges side-by-side is an "either/or" - finish any one to advance.',
		icon: 'mdi:map-marker-path',
		highlightPadding: 8,
		waitFor: 'tile-0'
	},
	{
		id: 'tile-1:0',
		title: 'Either/Or Steps',
		description:
			'This quest includes step groups - rows with multiple badges. Complete just one to advance; the rest become optional bonuses you can come back for.',
		footer: 'Bonus alt-steps stay clickable even after the row finishes.',
		icon: 'mdi:vector-difference',
		condition: () => hasAltStepGroup.value
	},
	{
		id: 'tile-end',
		title: 'Reward & Completion',
		description:
			'The gold medal is the finish line. Complete every step to unlock the quest reward - points, a badge, or a feature unlock - and earn a permanent spot in your quest history.',
		footer: "You're all set. Press Finish and start your quest!",
		icon: 'mdi:trophy-outline',
		waitFor: 'tile-end'
	}
]);
</script>
