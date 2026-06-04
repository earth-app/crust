<template>
	<ClientOnly>
		<div
			class="w-full h-full min-h-40 lg:min-h-50 flex contain-[layout_paint_style]"
			style="content-visibility: auto; contain-intrinsic-size: 520px"
		>
			<component
				:is="resolved"
				v-if="resolved"
				v-bind="extraProps"
				:topic="effectiveTopic"
				class="w-full h-full max-w-none!"
			/>
		</div>
	</ClientOnly>
</template>

<script setup lang="ts">
// renders a widget by kind. when `activity` is supplied, the slot tunes a handful of
// widgets to that activity's context (mood question, poll question, reflection prompt).
// leaves the others generic since their content doesn't naturally scope to a single hobby.
// outer wrapper matches an InfoCard's dimensions so widgets sit cleanly in the same grid.

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

// activity-scoped mood buckets so different activities don't bleed into one another
const effectiveTopic = computed(() => {
	if (props.activity) return `activity-${props.activity.id}`;
	return props.topic;
});

const LEADERBOARD_TYPES = ['article', 'prompt', 'event'] as const;

// activity-aware question pools. each variant slots the activity name in. pick is deterministic
// by (activity-id-hash + utc-day) % len so the same activity rolls a different question every day
// but stays stable on reload, and different activities see different starting variants.

const MOOD_VARIANTS = [
	(name: string) => `How are you feeling about ${name} right now?`,
	(name: string) => `What's your vibe with ${name} today?`,
	(name: string) => `How is ${name} treating you lately?`,
	(name: string) => `Where are you with ${name} this week?`,
	(name: string) => `Your current mood on ${name}?`
];

const POLL_VARIANTS = [
	(name: string) => ({
		question: `Where do you do ${name.toLowerCase()} most often?`,
		options: ['Alone', 'With Friends', 'With Family']
	}),
	(name: string) => ({
		question: `When do you fit in ${name.toLowerCase()}?`,
		options: ['Morning', 'Afternoon', 'Evening']
	}),
	(name: string) => ({
		question: `How long is your typical ${name.toLowerCase()} session?`,
		options: ['Under 30 Min', '30-60 Min', 'Over an Hour']
	}),
	(name: string) => ({
		question: `How often do you do ${name.toLowerCase()}?`,
		options: ['Daily', 'Weekly', 'Monthly']
	}),
	(name: string) => ({
		question: `What's your skill level with ${name.toLowerCase()}?`,
		options: ['Just Starting', 'Getting There', 'Experienced']
	})
];

const REFLECTION_VARIANTS = [
	(name: string) => `Share one moment from your recent ${name.toLowerCase()} session.`,
	(name: string) => `What did you learn from your last ${name.toLowerCase()} attempt?`,
	(name: string) => `Describe a small win you had with ${name.toLowerCase()} this week.`,
	(name: string) => `What's a ${name.toLowerCase()} habit you want to build?`,
	(name: string) => `Who or what got you into ${name.toLowerCase()}?`
];

// impact goal pool. without an activity we rotate a generic earth-app goal by UTC day; with one
// we rotate activity-specific micro-goals seeded the same way as the other variants
const IMPACT_GENERIC_VARIANTS = [
	'Reduce one piece of waste today',
	'Walk somewhere short instead of driving',
	'Use a reusable bottle or cup all day',
	'Pick up one piece of litter you pass',
	'Skip one delivery and combine it with another',
	'Eat one meal without packaged food',
	'Spend 10 minutes outside without a screen'
];
const IMPACT_ACTIVITY_VARIANTS = [
	(name: string) => `Spend 15 minutes on ${name.toLowerCase()} today`,
	(name: string) => `Do one full round of ${name.toLowerCase()}`,
	(name: string) => `Share something you learned about ${name.toLowerCase()}`,
	(name: string) => `Try a new ${name.toLowerCase()} approach today`,
	(name: string) => `Connect with someone else who enjoys ${name.toLowerCase()}`
];

function hashId(input: string): number {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

function dayOfYearUtc(): number {
	const now = new Date();
	const start = Date.UTC(now.getUTCFullYear(), 0, 0);
	return Math.floor((now.getTime() - start) / 86_400_000);
}

const variantSeed = computed(() => {
	if (!props.activity) return 0;
	return (hashId(props.activity.id) + dayOfYearUtc()) >>> 0;
});

const extraProps = computed<Record<string, unknown>>(() => {
	const out: Record<string, unknown> = {};

	if (props.kind === 'MiniLeaderboard') {
		out.type = LEADERBOARD_TYPES[dayOfYearUtc() % LEADERBOARD_TYPES.length];
	}

	// ImpactTracker always varies (with or without activity context)
	if (props.kind === 'ImpactTracker') {
		if (props.activity) {
			const seed = variantSeed.value;
			const pick = IMPACT_ACTIVITY_VARIANTS[seed % IMPACT_ACTIVITY_VARIANTS.length]!;
			out.goal = pick(props.activity.name);
		} else {
			out.goal = IMPACT_GENERIC_VARIANTS[dayOfYearUtc() % IMPACT_GENERIC_VARIANTS.length];
		}
	}

	if (props.activity) {
		const name = props.activity.name;
		const seed = variantSeed.value;
		if (props.kind === 'MoodSpark') {
			const pick = MOOD_VARIANTS[seed % MOOD_VARIANTS.length]!;
			out.question = pick(name);
		} else if (props.kind === 'MicroPoll') {
			const pick = POLL_VARIANTS[seed % POLL_VARIANTS.length]!;
			Object.assign(out, pick(name));
		} else if (props.kind === 'MicroReflection') {
			const pick = REFLECTION_VARIANTS[seed % REFLECTION_VARIANTS.length]!;
			out.prompt = pick(name);
		}
	}

	return out;
});
</script>
