<template>
	<div class="min-h-screen bg-neutral-950 p-4 text-white">
		<div
			data-testid="harness-ready"
			class="text-xs text-neutral-500"
		>
			{{ ready ? 'ready' : 'loading' }}
		</div>
		<div
			data-testid="widget-kind"
			class="text-xs text-neutral-500"
		>
			{{ kind }}
		</div>

		<div
			v-if="!primitives"
			data-testid="widget-mount"
			class="mt-4 max-w-md"
		>
			<WidgetSlot
				:kind="kind"
				:topic="topic"
				:activity="activity"
			/>
		</div>

		<!-- animation-primitive rig (mounted only with ?primitives=1) -->
		<div
			v-else
			data-testid="primitive-mount"
			class="mt-4 flex flex-col gap-6 max-w-md"
		>
			<div class="relative h-24 w-24 border border-neutral-700">
				<UiSparkleBurst
					:trigger="sparkleTrigger"
					color="primary"
				/>
			</div>
			<UButton
				data-testid="sparkle-trigger"
				@click="sparkleTrigger++"
			>
				Burst
			</UButton>

			<UiPulseRing
				:active="true"
				color="primary"
			>
				<span data-testid="pulse-target">Pulse Target</span>
			</UiPulseRing>

			<div data-testid="countup-target">
				<UiCountUp :value="countUpValue" />
			</div>
			<UButton
				data-testid="countup-trigger"
				@click="countUpValue = 500"
			>
				Count
			</UButton>

			<UiAnimatedGradientBorder>
				<div
					data-testid="gradient-target"
					class="p-4"
				>
					Gradient Card
				</div>
			</UiAnimatedGradientBorder>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { FeedWidgetKind } from '~/composables/useUser';

definePageMeta({ layout: false });

// gated behind the test build flag, same guard as quest-harness/drag-harness
const config = useRuntimeConfig();
if (!config.public.testBuild) {
	throw createError({ statusCode: 404, statusMessage: 'Not Found' });
}

const route = useRoute();

const VALID_KINDS: FeedWidgetKind[] = [
	'MoodSpark',
	'MicroPoll',
	'MicroQuiz',
	'ImpactTracker',
	'MiniLeaderboard',
	'MicroReflection',
	'RapidFlash'
];

const kind = computed<FeedWidgetKind>(() => {
	const q = String(route.query.kind ?? 'MoodSpark');
	return (VALID_KINDS as string[]).includes(q) ? (q as FeedWidgetKind) : 'MoodSpark';
});

// unique topic per harness load so parallel mood tests don't share a tally
const topic = computed(() => String(route.query.topic ?? 'today'));

// pass an activity context when a test wants the activity-scoped RapidFlash pool etc
const activity = computed(() => {
	const id = route.query.activityId;
	if (!id) return null;
	return {
		id: String(id),
		name: String(route.query.activityName ?? 'Nature'),
		types: route.query.types ? (String(route.query.types).split(',') as any[]) : undefined
	};
});

const primitives = computed(() => route.query.primitives === '1');
const sparkleTrigger = ref(0);
const countUpValue = ref(0);

const ready = ref(false);
onMounted(() => {
	ready.value = true;
});
</script>
