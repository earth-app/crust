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
				text="This quest is only available on The Earth App mobile app."
			>
				<UButton
					id="quest-button"
					color="info"
					variant="soft"
					icon="mdi:cellphone-lock"
					disabled
					class="self-center"
					>Mobile Only</UButton
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
									altStep.delayedUntil > now
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
									class="text-xs opacity-70"
								>
									+{{ altStep.reward }} Bonus Points
								</p>
								<p
									v-if="altStep.delay"
									class="text-xs opacity-70 mt-1"
								>
									Can be completed {{ formatTime(altStep.delay) }} after completing previous step
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
									item.delayedUntil > now
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
									class="text-xs opacity-70"
								>
									+{{ item.reward }} Impact Points
								</p>
								<p
									v-if="item.delay"
									class="text-xs opacity-70"
								>
									Can be completed after {{ formatTime(item.delay) }} after completing previous step
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
			isCurrentStep: boolean;
			data?: string;
		}
	];
}>();

const { user } = useAuth();
const userId = computed(() => user.value?.id);
const { quest, questHistory, fetchUserQuest, startQuest, endQuest } = useUser(userId);
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
// Crust is the web frontend — mobile_only quests must be started from the
// mobile app, even when a user is browsing here from a mobile browser.
const mobileOnly = computed(() => props.quest.mobile_only === true);

type TimelineStep = QuestStep & {
	icon: string;
	index: number;
	altIndex?: number;
	completed: boolean;
	completedAt: number;
	delayedUntil: number;
};

// A step is unavailable here when it (or its parent quest) is mobile-only.
// Alternatives are normally provided so desktop users can still progress.
function isStepMobileOnly(step: { mobile_only?: boolean }) {
	return step.mobile_only === true || mobileOnly.value;
}

function selectStep(step: TimelineStep, index: number) {
	if (step.delayedUntil > now.value) return;

	if (isStepMobileOnly(step)) {
		toast.add({
			title: 'Mobile Only',
			description:
				'This step can only be completed in The Earth App mobile app. Complete an alternative step if one is available.',
			icon: 'mdi:cellphone-lock',
			color: 'info',
			duration: 4000
		});
		return;
	}

	emit('select-step', {
		...step,
		isCurrentQuest: isCurrentQuest.value,
		isCurrentStep: isCurrentStep(index)
	});
}

function isCurrentStep(index: number) {
	if (!quest.value) return false;
	return currentIndex.value === index;
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
		return 'This Badge Mastery quest is one-shot. Ending it now will permanently lock the mastery — you will not be able to regenerate it again.';
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

				return {
					...altStep,
					icon: getStepIcon(altStep.type),
					index,
					altIndex,
					completed: !!entry,
					completedAt: entry?.submittedAt || 0,
					delayedUntil:
						altStep.delay && prevCompletedAt ? prevCompletedAt + altStep.delay * 1000 : 0
				};
			});
		} else {
			// progress[index] is QuestProgressEntry for regular steps
			const progSlot = props.progress?.[index];
			const entry = !Array.isArray(progSlot) ? progSlot : undefined;

			return {
				...step,
				icon: getStepIcon(step.type),
				index,
				completed: !!entry,
				completedAt: entry?.submittedAt || 0,
				delayedUntil: step.delay && prevCompletedAt ? prevCompletedAt + step.delay * 1000 : 0
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

// quest timeline tour

const { startTour } = useSiteTour();

const timelineTour: SiteTourStep[] = [
	{
		id: 'quest-button',
		title: 'Quest Actions',
		description:
			'Welcome to the quest timeline! Here you can start or end quests and track your progress through each step.',
		footer:
			'Click "Next" to learn how to interact with the quest steps and view details about each one.'
	},
	{
		id: 'tile-0',
		title: 'Quest Steps',
		description:
			'Each icon represents a step in the quest. You can click on them to view more details, and they will show your progress as you complete them.',
		footer: 'Hover over steps with multiple options to see all possible actions!'
	},
	{
		id: 'tile-1:0',
		title: 'Step Details',
		description:
			'When you click on a step, you can see more details about what you need to do to complete it, any rewards you will earn, and when it will unlock if it is locked behind a delay.',
		footer: 'Complete steps to earn points and progress through the quest.'
	},
	{
		id: 'tile-end',
		title: 'Quest Completion',
		description:
			'Once you complete all the steps, you will earn the quest reward and can show off your achievement on your profile!',
		footer: 'Great job on making it to the end of the quest timeline tour!'
	}
];
</script>
