<template>
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
		v-else-if="isCompletedMastery"
		class="text-xs opacity-70 text-center max-w-72"
	>
		<template v-if="masteredAtFormatted">Mastered on {{ masteredAtFormatted }}.</template>
		Open the timeline to revisit your completed steps.
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
		Pick up where you left off - expires in
		{{ masteryExpiresInDays }} day{{ masteryExpiresInDays === 1 ? '' : 's' }}. Resetting will
		permanently lock this mastery.
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
		You have {{ masteryList?.active }} / {{ masteryList?.cap }} active mastery quests. Complete or
		let one expire before generating another.
	</span>
	<span
		v-else-if="!masteryStatusFetched"
		class="text-xs opacity-60 text-center max-w-72"
	>
		Generate a personalised AI quest to deepen your mastery of this badge.
	</span>
	<span
		v-if="
			masteryList &&
			!masteryCapReached &&
			!masteryQuestReady &&
			!masteryLocked &&
			!isCompletedMastery
		"
		class="text-xs opacity-60 text-center"
	>
		{{ masteryList.active }} / {{ masteryList.cap }} active mastery slots used
	</span>
</template>

<script setup lang="ts">
defineProps<{
	masteryStatusLoading: boolean;
	masteryStatusFetched: boolean;
	isCompletedMastery: boolean;
	masteryLocked: boolean;
	masteryQuestReady: boolean;
	masteryCapReached: boolean;
	masteryExpiresInDays: number | null;
	masteredAtFormatted: string | null;
	masteryList: MasteryList | null;
}>();
</script>
