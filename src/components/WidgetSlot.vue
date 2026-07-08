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
import { trimString } from 'utils';

type ActivityContext = { id: string; name: string; types?: readonly ActivityType[] };

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
	MoodSpark: defineAsyncComponent(() => import('~/components/widgets/MoodSpark.vue')),
	MicroPoll: defineAsyncComponent(() => import('~/components/widgets/MicroPoll.vue')),
	MicroQuiz: defineAsyncComponent(() => import('~/components/widgets/MicroQuiz.vue')),
	ImpactTracker: defineAsyncComponent(() => import('~/components/widgets/ImpactTracker.vue')),
	MiniLeaderboard: defineAsyncComponent(() => import('~/components/widgets/MiniLeaderboard.vue')),
	MicroReflection: defineAsyncComponent(() => import('~/components/widgets/MicroReflection.vue')),
	RapidFlash: defineAsyncComponent(() => import('~/components/widgets/RapidFlash.vue'))
};

const resolved = computed(() => COMPONENTS[props.kind] ?? null);

// server topic regex is /^[a-z0-9_-]{1,64}$/ — sanitize so any non-conforming activity id char
// (space, dot, slash, colon, etc.) becomes a hyphen and the mood request doesn't 4xx "Invalid topic"
function sanitizeTopic(raw: string): string {
	return raw
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 64);
}

// activity-scoped mood buckets so different activities don't bleed into one another
const effectiveTopic = computed(() => {
	const raw = props.activity ? `activity-${props.activity.id}` : props.topic;
	return sanitizeTopic(raw) || 'today';
});

type Pair = { term: string; def: string };
const RAPID_FLASH_POOLS_BY_TYPE: Partial<Record<ActivityType, Pair[]>> = {
	NATURE: [
		{ term: 'Biome', def: 'a large ecological community' },
		{ term: 'Watershed', def: 'land draining to one body of water' },
		{ term: 'Canopy', def: 'top layer of a forest' },
		{ term: 'Pollinator', def: 'moves pollen between flowers' },
		{ term: 'Mycelium', def: 'underground fungal network' },
		{ term: 'Estuary', def: 'where river meets the sea' }
	],
	SPORT: [
		{ term: 'Cadence', def: 'rhythm of strides or strokes' },
		{ term: 'Endurance', def: 'capacity to sustain effort' },
		{ term: 'Form', def: 'posture and technique under load' },
		{ term: 'Recovery', def: 'rest that rebuilds tissue' },
		{ term: 'PR', def: 'a personal best result' },
		{ term: 'Drill', def: 'focused repeated practice' }
	],
	HEALTH: [
		{ term: 'Hydration', def: 'maintaining body fluid balance' },
		{ term: 'Sleep Debt', def: 'cumulative missed sleep' },
		{ term: 'VO2 Max', def: 'peak oxygen uptake' },
		{ term: 'Mobility', def: 'range of joint motion' },
		{ term: 'Resting HR', def: 'heart rate at rest' },
		{ term: 'Macros', def: 'carbs, protein, and fat' }
	],
	CREATIVE: [
		{ term: 'Composition', def: 'arrangement of elements' },
		{ term: 'Palette', def: 'a chosen set of colors' },
		{ term: 'Negative Space', def: 'the empty area around' },
		{ term: 'Texture', def: 'tactile or visual surface' },
		{ term: 'Contrast', def: 'difference that draws the eye' },
		{ term: 'Rhythm', def: 'repeated visual or sonic beat' }
	],
	ART: [
		{ term: 'Hue', def: 'pure color on the wheel' },
		{ term: 'Value', def: 'lightness or darkness of a color' },
		{ term: 'Underpainting', def: 'a tonal base layer' },
		{ term: 'Gesture', def: 'a quick capture of motion' },
		{ term: 'Vanishing Point', def: 'where lines meet in perspective' }
	],
	LEARNING: [
		{ term: 'Spaced Repetition', def: 'review at growing intervals' },
		{ term: 'Chunking', def: 'grouping info to aid memory' },
		{ term: 'Active Recall', def: 'retrieve before rereading' },
		{ term: 'Interleaving', def: 'mixing topics in practice' },
		{ term: 'Schema', def: 'a mental framework' },
		{ term: 'Metacognition', def: 'thinking about thinking' }
	],
	STUDY: [
		{ term: 'Outline', def: 'a structured skeleton of ideas' },
		{ term: 'Citation', def: 'credit pointing to a source' },
		{ term: 'Margin Note', def: 'a thought tucked beside the text' },
		{ term: 'Synthesis', def: 'combining sources into your own view' },
		{ term: 'Thesis', def: 'a single claim a paper defends' }
	],
	TECHNOLOGY: [
		{ term: 'Latency', def: 'delay between action and result' },
		{ term: 'Throughput', def: 'amount processed per unit time' },
		{ term: 'Cache', def: 'fast lookup of recent values' },
		{ term: 'API', def: 'a contract between systems' },
		{ term: 'Pipeline', def: 'a series of processing stages' },
		{ term: 'Token', def: 'unit of input a model parses' }
	],
	TRAVEL: [
		{ term: 'Itinerary', def: 'planned route of a trip' },
		{ term: 'Layover', def: 'pause between flights' },
		{ term: 'Visa', def: 'permission to enter a country' },
		{ term: 'Embassy', def: "a nation's diplomatic outpost" },
		{ term: 'Phrasebook', def: 'collection of helpful sentences' },
		{ term: 'Local Time', def: 'time zone where you stand' }
	],
	SOCIAL: [
		{ term: 'Empathy', def: 'feeling with another person' },
		{ term: 'Active Listening', def: 'focused engaged hearing' },
		{ term: 'Boundary', def: 'a limit you set with others' },
		{ term: 'Reciprocity', def: 'mutual give and take' },
		{ term: 'Rapport', def: 'easy mutual understanding' },
		{ term: 'Common Ground', def: 'a shared starting point' }
	]
};

function buildRapidFlashPool(types: readonly ActivityType[] | null | undefined): Pair[] {
	if (!types || types.length === 0) return [];
	const seen = new Set<string>();
	const merged: Pair[] = [];
	for (const t of types) {
		const pool = RAPID_FLASH_POOLS_BY_TYPE[t];
		if (!pool) continue;
		for (const pair of pool) {
			if (seen.has(pair.term)) continue;
			seen.add(pair.term);
			merged.push(pair);
		}
	}
	return merged;
}

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// first sentence (else a short slice) with the activity name stripped/masked so a def never reveals its term
function shortDef(description: string, name: string): string | null {
	let d = description.trim();
	if (!d) return null;
	const sentence = d.match(/^.*?[.!?](?=\s|$)/);
	d = sentence ? sentence[0]!.trim() : trimString(d, 65);
	const term = name.trim();
	if (term) {
		const escaped = escapeRegExp(term);
		d = d.replace(new RegExp(`^${escaped}\\s+(?:is|are|refers to|means)\\b[:,]?\\s*`, 'i'), '');
		d = d.replace(new RegExp(escaped, 'ig'), '___').trim();
	}
	return d.length > 0 ? d : null;
}

// map random activities into rapid-flash pairs; drop empty/duplicate terms and defs
function buildRealPool(
	activities: readonly { name?: string | null; description?: string | null }[]
): Pair[] {
	const pairs: Pair[] = [];
	const seenTerms = new Set<string>();
	const seenDefs = new Set<string>();
	for (const a of activities) {
		const term = (a?.name ?? '').trim();
		const rawDesc = (a?.description ?? '').trim();
		if (!term || !rawDesc) continue;
		const def = shortDef(rawDesc, term);
		if (!def) continue;
		const termKey = term.toLowerCase();
		const defKey = def.toLowerCase();
		if (seenTerms.has(termKey) || seenDefs.has(defKey)) continue;
		seenTerms.add(termKey);
		seenDefs.add(defKey);
		pairs.push({ term, def });
	}
	return pairs;
}

// only RapidFlash needs live activities; every other kind skips the fetch
const activitiesApi = props.kind === 'RapidFlash' ? useActivities() : null;
const realPool = ref<Pair[] | null>(null);

async function loadRealPool() {
	if (!activitiesApi) return;
	try {
		const res = await activitiesApi.fetchRandom(8);
		if (res.success && Array.isArray(res.data)) {
			const pool = buildRealPool(res.data);
			realPool.value = pool.length >= 4 ? pool : null;
		}
	} catch {
		realPool.value = null;
	}
}

onMounted(loadRealPool);

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
		} else if (props.kind === 'RapidFlash') {
			const pool = buildRapidFlashPool(props.activity.types);
			if (pool.length >= 4) {
				out.pool = pool;
				out.ctaTitle = `Match 4 ${name} terms to their meanings`;
				out.ctaSubtitle = `Themed to ${name}. Tap when you’re ready — the timer only starts after you do.`;
			}
		}
	}

	// real activities from the API take priority over the activity-typed pool; a full round of
	// >=4 replaces whatever the type-table produced (and fills no-activity slots too)
	if (props.kind === 'RapidFlash' && realPool.value && realPool.value.length >= 4) {
		out.pool = realPool.value;
		out.ctaTitle = 'Match 4 activities to their descriptions';
		delete out.ctaSubtitle;
	}

	return out;
});
</script>
