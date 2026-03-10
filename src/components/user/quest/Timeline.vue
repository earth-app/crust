<template>
	<div class="flex flex-col w-full h-full">
		<div class="flex justify-center my-2">
			<UButton
				v-if="isCurrentQuest"
				color="error"
				variant="soft"
				:loading="loading"
				:disabled="loading"
				class="self-center"
				@click="handleEnd"
				>End Quest</UButton
			>

			<UTooltip
				v-else-if="hasOtherActiveQuest && !completed"
				text="You already have an active quest. Starting this one will replace it."
			>
				<UButton
					color="warning"
					variant="soft"
					:loading="loading"
					:disabled="loading"
					class="self-center"
					@click="handleStart(true)"
					>Replace &amp; Start Quest</UButton
				>
			</UTooltip>

			<UButton
				v-else-if="!isCurrentQuest && !completed"
				color="primary"
				:loading="loading"
				:disabled="loading || questLoading"
				class="self-center"
				@click="handleStart(false)"
				>Start Quest</UButton
			>
		</div>
		<div
			v-for="(item, index) in items"
			:key="index"
			class="flex flex-col items-center w-full min-h-36"
		>
			<div
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
						<LazyUBadge
							:key="altIndex"
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
							@click="
								altStep.delayedUntil <= now &&
								emit('select-step', {
									...altStep,
									isCurrentQuest,
									isCurrentStep: isCurrentStep(index)
								})
							"
							hydrate-on-visible
						/>
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
								<p class="text-sm opacity-90">{{ altStep.description }}</p>
								<p
									v-if="altStep.reward"
									class="text-xs opacity-70"
								>
									+{{ altStep.reward }} Bonus Points
								</p>
								<p
									v-if="altStep.delay"
									class="text-xs opacity-70"
								>
									Can be completed after {{ formatTime(altStep.delay) }} after completing previous
									step
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
						<LazyUBadge
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
							@click="
								item.delayedUntil <= now &&
								emit('select-step', {
									...item,
									isCurrentQuest,
									isCurrentStep: isCurrentStep(index)
								})
							"
							hydrate-on-visible
						/>

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
								<p class="text-sm opacity-90">{{ item.description }}</p>
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
				icon="mdi:medal-outline"
				color="warning"
				variant="solid"
				size="xl"
				class="self-center"
				hydrate-on-visible
			/>
			<span class="text-xs opacity-70">+{{ props.quest.reward }}</span>
		</div>
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
const { quest, questHistory, fetchQuest, startQuest, endQuest } = useUser(user.value?.id || '');
const toast = useToast();

const loading = ref(false);
const now = ref(Date.now());
let _nowTimer: ReturnType<typeof setInterval>;

onMounted(() => {
	fetchQuest();
	_nowTimer = setInterval(() => {
		now.value = Date.now();
	}, 10_000);
});

onUnmounted(() => {
	clearInterval(_nowTimer);
});

const completed = computed(() => {
	return questHistory.value?.get(props.quest.id)?.completedAt !== undefined;
});

// true while the initial quest fetch hasn't resolved yet (quest is still undefined)
const questLoading = computed(() => quest.value === undefined);
const isCurrentQuest = computed(() => !!quest.value && quest.value.questId === props.quest.id);

function isCurrentStep(index: number) {
	if (!quest.value) return false;
	return currentIndex.value === index;
}

function formatTime(seconds: number) {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;

	if (secs === 0) return `${mins}m`;
	return `${mins}m ${secs}s`;
}

const i18n = useI18n();

function formatRelative(millis: number) {
	return DateTime.fromMillis(millis).toRelative({ locale: i18n.locale.value });
}

const hasOtherActiveQuest = computed(
	() => !!quest.value?.questId && quest.value.questId !== props.quest.id
);

async function handleStart(override: boolean = false) {
	loading.value = true;
	try {
		const res = await startQuest(props.quest.id, override);
		await fetchQuest(true);
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
		await fetchQuest(true);
		toast.add({ title: 'Quest ended', description: res.message, color: 'neutral', duration: 3000 });
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
					icon: getIcon(altStep.type),
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
				icon: getIcon(step.type),
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

function getIcon(type: string) {
	switch (type) {
		case 'take_photo_location':
			return 'mdi:camera-marker';
		case 'take_photo_classification':
			return 'mdi:camera-enhance';
		case 'take_photo_caption':
			return 'mdi:camera-image';
		case 'take_photo_objects':
			return 'mdi:camera-gopro';
		case 'draw_picture':
			return 'mdi:pen';
		case 'attend_event':
			return 'mdi:calendar-star';
		case 'transcribe_audio':
			return 'mdi:microphone';
		case 'article_quiz':
			return 'mdi:book-open-variant';
		case 'match_terms':
			return 'mdi:shape';
		case 'order_items':
			return 'mdi:format-list-bulleted';
		default:
			return 'mdi:account';
	}
}
</script>
