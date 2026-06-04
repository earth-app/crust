<template>
	<ClientOnly>
		<div class="w-full flex">
			<component
				:is="resolved"
				v-if="resolved"
				v-bind="extraProps"
				:topic="topic"
				class="w-full max-w-none!"
			/>
		</div>
	</ClientOnly>
</template>

<script setup lang="ts">
// renders a widget by kind. each kind maps to a widget under src/components/activity/widgets/.
// the kind comes from useFeedWidgets().widgetForIndex(...) in the parent feed.

const props = withDefaults(
	defineProps<{
		kind: FeedWidgetKind;
		topic?: string;
	}>(),
	{
		topic: 'today'
	}
);

const COMPONENTS: Record<FeedWidgetKind, ReturnType<typeof defineAsyncComponent>> = {
	MoodSpark: defineAsyncComponent(() => import('~/components/activity/widgets/MoodSpark.vue')),
	MicroPoll: defineAsyncComponent(() => import('~/components/activity/widgets/MicroPoll.vue')),
	MicroQuiz: defineAsyncComponent(() => import('~/components/activity/widgets/MicroQuiz.vue')),
	WordOfTheDay: defineAsyncComponent(
		() => import('~/components/activity/widgets/WordOfTheDay.vue')
	),
	ImpactTracker: defineAsyncComponent(
		() => import('~/components/activity/widgets/ImpactTracker.vue')
	),
	MiniLeaderboard: defineAsyncComponent(
		() => import('~/components/activity/widgets/MiniLeaderboard.vue')
	),
	MicroReflection: defineAsyncComponent(
		() => import('~/components/activity/widgets/MicroReflection.vue')
	),
	RapidFlash: defineAsyncComponent(() => import('~/components/activity/widgets/RapidFlash.vue'))
};

const resolved = computed(() => COMPONENTS[props.kind] ?? null);

// MiniLeaderboard needs a journey type. rotate per UTC day so each slot doesn't always show "article".
const LEADERBOARD_TYPES = ['article', 'prompt', 'event'] as const;
const extraProps = computed<Record<string, unknown>>(() => {
	if (props.kind === 'MiniLeaderboard') {
		const day = Math.floor(Date.now() / 86_400_000);
		return { type: LEADERBOARD_TYPES[day % LEADERBOARD_TYPES.length] };
	}
	return {};
});
</script>
