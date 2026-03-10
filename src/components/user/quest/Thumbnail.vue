<template>
	<template v-if="quest">
		<UCard
			variant="subtle"
			class="gap-4 p-4 hover:cursor-pointer hover:scale-105 transition-all duration-300"
			:class="current ? 'ring-4 ring-primary' : completed ? 'ring-2 ring-warning-300' : ''"
			@click="timelineOpen = true"
		>
			<div class="flex flex-col items-center justify-center">
				<div class="flex justify-between w-full px-2">
					<span
						v-if="completedCount > 0"
						class="text-sm"
					>
						{{ completedCount }} / {{ quest.steps.length }} completed</span
					>
					<span
						v-else
						class="text-sm underline opacity-80"
						>{{ quest.steps.length }} steps</span
					>

					<span class="text-sm underline opacity-80">{{ comma(fullReward) }} points</span>
				</div>

				<UBadge
					:color="rarityColor"
					variant="subtle"
					size="md"
					class="my-2"
					>{{ capitalizeFully(quest.rarity || '') }}</UBadge
				>

				<UBadge
					:icon="quest.icon"
					:variant="completed ? 'solid' : completedCount > 0 ? 'subtle' : 'outline'"
					:color="completed ? 'primary' : 'neutral'"
					size="xl"
				/>
				<div class="flex flex-col gap-2">
					<h1 class="font-semibold text-lg">{{ quest.title }}</h1>
					<span class="font-medium opacity-90 text-base">{{ quest.description }}</span>
					<span
						v-if="completedAt"
						class="text-sm opacity-80"
						>Completed {{ completedAt }}</span
					>
				</div>
			</div>
		</UCard>
		<UModal
			v-model:open="timelineOpen"
			class="min-w-full min-h-full"
			:dismissible="!stepOpen"
			:modal="true"
			fullscreen
		>
			<template #header>
				<div class="flex items-center w-full space-x-2">
					<UIcon
						:name="quest.icon"
						class="size-12 text-primary"
					/>
					<div class="flex flex-col">
						<h1 class="font-semibold text-lg">{{ quest.title }}</h1>
						<span class="font-medium opacity-90 text-base">{{ quest.description }}</span>
						<span
							v-if="completedAt"
							class="text-sm opacity-80"
							>Completed on {{ completedAtNormal }}</span
						>
					</div>

					<UButton
						variant="outline"
						class="ml-auto mr-4"
						color="error"
						icon="mdi:exit-to-app"
						@click="timelineOpen = false"
					/>
				</div>
			</template>
			<template #body>
				<div
					class="h-full w-full overscroll-contain"
					:class="stepOpen ? 'overflow-hidden' : 'overflow-y-auto'"
				>
					<LazyUserQuestTimeline
						:quest="quest"
						:progress="progress"
						@select-step="
							openStep = $event;
							stepOpen = true;
						"
					/>
				</div>
			</template>
		</UModal>
		<UModal
			v-model:open="stepOpen"
			:modal="true"
			@close="openStep = null"
			scrollable
			class="md:min-w-160 lg:min-w-200"
		>
			<template #header="{ close }">
				<div class="flex items-center justify-between w-full px-1">
					<div class="flex items-center gap-2">
						<UIcon
							v-if="openStep?.icon"
							:name="openStep.icon"
							class="size-5 text-primary"
						/>
						<span class="text-sm ml-2 font-medium truncate max-w-160">{{
							openStep?.description ?? ''
						}}</span>
					</div>
					<button
						class="w-8 h-8 rounded-full border border-neutral-700 bg-neutral-900/60 flex items-center justify-center text-neutral-400 hover:text-white hover:border-neutral-500 transition-all active:scale-95 shrink-0"
						aria-label="Close"
						@click="close"
					>
						<UIcon
							name="i-lucide-x"
							class="size-4"
						/>
					</button>
				</div>
			</template>
			<template #body>
				<div class="overflow-y-auto overscroll-contain">
					<LazyUserQuestStepSubmission
						v-if="openStep"
						:quest="quest"
						:progress="progress"
						:step="openStep"
						@submitted="stepOpen = false"
					/>
					<Loading v-else-if="stepOpen" />
				</div>
			</template>
		</UModal>
	</template>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';

const props = defineProps<{
	quest: Quest;
	progress?: (QuestProgressEntry | QuestProgressEntry[])[];
	current?: boolean;
	completedAt?: number;
}>();

const fullReward = computed(() => {
	let base = props.quest.reward || 0;
	for (let step of props.quest.steps.flatMap((s) => (Array.isArray(s) ? s : [s]))) {
		if (step.reward) base += step.reward;
	}

	return base;
});

const completedCount = computed(() => props.progress?.length || 0);
const completed = computed(() => {
	if (!props.quest) return false;
	if (props.completedAt) return true;

	return completedCount.value >= props.quest.steps.length;
});

const i18n = useI18n();
const completedAt = computed(() => {
	if (!props.completedAt) return null;
	return DateTime.fromMillis(props.completedAt).toRelative({ locale: i18n.locale.value });
});

const completedAtNormal = computed(() => {
	if (!props.completedAt) return null;
	return DateTime.fromMillis(props.completedAt).toLocaleString(DateTime.DATETIME_FULL_WITH_SECONDS);
});

const rarityColor = computed(() => {
	if (!props.quest) return 'neutral';
	switch (props.quest.rarity) {
		case 'normal':
			return 'neutral';
		case 'rare':
			return 'info';
		case 'amazing':
			return 'warning';
		case 'green':
			return 'primary';
	}
});

const timelineOpen = ref(false);
const stepOpen = ref(false);
const openStep = ref<
	| (QuestStep & {
			icon: string;
			completed: boolean;
			index: number;
			altIndex?: number;
			isCurrentQuest: boolean;
			isCurrentStep: boolean;
	  })
	| null
>(null);
</script>
