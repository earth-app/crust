<template>
	<ClientOnly>
		<div class="w-full flex justify-center my-2">
			<component
				:is="resolved"
				v-if="resolved"
				:topic="topic"
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
</script>
