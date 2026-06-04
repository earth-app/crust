<template>
	<ClientOnly>
		<div class="w-full flex">
			<component
				:is="resolved"
				v-if="resolved"
				v-bind="extraProps"
				:topic="effectiveTopic"
				class="w-full max-w-none!"
			/>
		</div>
	</ClientOnly>
</template>

<script setup lang="ts">
// renders a widget by kind. when `activity` is supplied, the slot tunes a handful of
// widgets to that activity's context (mood question, poll question, reflection prompt,
// rapid-flash term pool). leaves the others generic since their content doesn't naturally
// scope to a single hobby.

type ActivityContext = { id: string; name: string };

const props = withDefaults(
	defineProps<{
		kind: FeedWidgetKind;
		topic?: string;
		activity?: ActivityContext | null;
	}>(),
	{
		topic: 'today',
		activity: null
	}
);

const COMPONENTS: Record<FeedWidgetKind, ReturnType<typeof defineAsyncComponent>> = {
	MoodSpark: defineAsyncComponent(() => import('~/components/activity/widgets/MoodSpark.vue')),
	MicroPoll: defineAsyncComponent(() => import('~/components/activity/widgets/MicroPoll.vue')),
	MicroQuiz: defineAsyncComponent(() => import('~/components/activity/widgets/MicroQuiz.vue')),
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

// activity-scoped mood/reflection buckets so different activities don't bleed into one another
const effectiveTopic = computed(() => {
	if (props.activity) return `activity-${props.activity.id}`;
	return props.topic;
});

const LEADERBOARD_TYPES = ['article', 'prompt', 'event'] as const;

// pre-baked poll prompts that adapt to the activity name. kept terse so they don't
// dominate the card; one fixed default avoids per-load shuffle thrash
function activityPollProps(name: string) {
	return {
		question: `Where do you do ${name.toLowerCase()} most often?`,
		options: ['Alone', 'With Friends', 'With Family']
	};
}

function activityReflectionProps(name: string) {
	return {
		prompt: `Share one moment from your recent ${name.toLowerCase()} session.`
	};
}

function activityMoodProps(name: string) {
	return {
		question: `How are you feeling about ${name} right now?`
	};
}

const extraProps = computed<Record<string, unknown>>(() => {
	const out: Record<string, unknown> = {};

	if (props.kind === 'MiniLeaderboard') {
		const day = Math.floor(Date.now() / 86_400_000);
		out.type = LEADERBOARD_TYPES[day % LEADERBOARD_TYPES.length];
	}

	if (props.activity) {
		if (props.kind === 'MoodSpark') Object.assign(out, activityMoodProps(props.activity.name));
		if (props.kind === 'MicroPoll') Object.assign(out, activityPollProps(props.activity.name));
		if (props.kind === 'MicroReflection') {
			Object.assign(out, activityReflectionProps(props.activity.name));
		}
	}

	return out;
});
</script>
