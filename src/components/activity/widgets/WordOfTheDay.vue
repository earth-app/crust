<template>
	<UCard
		variant="soft"
		class="relative min-w-72 max-w-md p-4 shadow-md rounded-xl bg-linear-to-br from-info/10 via-primary/5 to-transparent overflow-hidden"
	>
		<div class="flex items-center gap-2 mb-2">
			<UIcon
				name="mdi:book-alphabet"
				class="size-5 text-info"
			/>
			<h3 class="text-sm font-semibold uppercase tracking-wide text-muted">Word of the Day</h3>
		</div>
		<div class="mb-3">
			<p class="text-2xl font-bold tracking-tight">{{ entry.word }}</p>
			<p class="text-xs italic text-muted">{{ entry.partOfSpeech }}</p>
		</div>
		<p class="text-sm mb-4">{{ entry.definition }}</p>
		<div
			v-if="!acted"
			class="flex flex-col sm:flex-row gap-2"
		>
			<UButton
				color="neutral"
				variant="outline"
				block
				icon="mdi:check"
				@click="markKnown"
			>
				I Knew It
			</UButton>
			<UButton
				color="primary"
				variant="solid"
				block
				icon="mdi:notebook-plus-outline"
				@click="addToJourney"
			>
				Add to Quest Journey
			</UButton>
		</div>
		<p
			v-else
			class="text-xs text-success font-medium"
		>
			<UIcon
				name="mdi:check-circle"
				class="size-4 inline mr-1"
			/>
			{{ actedMsg }}
		</p>
		<p
			v-if="acted && questHint"
			class="text-xs text-primary mt-2"
		>
			{{ questHint }}
		</p>
		<UiSparkleBurst
			:trigger="sparkleTrigger"
			color="info"
		/>
	</UCard>
</template>

<script setup lang="ts">
type WordEntry = { word: string; partOfSpeech: string; definition: string };

const props = withDefaults(defineProps<{ words?: WordEntry[]; questHint?: string }>(), {
	words: () => DEFAULT_WORDS,
	questHint: undefined
});

const emit = defineEmits<{
	(event: 'complete', payload: { outcome: 'known' | 'added' }): void;
}>();

const { tapCurrentJourney } = useAuth();
const acted = ref(false);
const actedMsg = ref('');
const sparkleTrigger = ref(0);

// deterministic pick per UTC day
function pickIndex(): number {
	const now = new Date();
	const day = Math.floor(now.getTime() / 86_400_000);
	return ((day % props.words.length) + props.words.length) % props.words.length;
}

const entry = computed(() => props.words[pickIndex()] ?? props.words[0]!);

function markKnown() {
	acted.value = true;
	actedMsg.value = 'Glad you knew it.';
	sparkleTrigger.value++;
	emit('complete', { outcome: 'known' });
}

async function addToJourney() {
	acted.value = true;
	actedMsg.value = 'Added to your article journey.';
	sparkleTrigger.value++;
	void tapCurrentJourney('article', entry.value.word);
	emit('complete', { outcome: 'added' });
}
</script>

<script lang="ts">
// 30 quest-relevant words baked in for default render
// prettier-ignore
const DEFAULT_WORDS = [
	{ word: 'Biome', partOfSpeech: 'noun', definition: 'a large community of plants and animals occupying a distinct region.' },
	{ word: 'Symbiosis', partOfSpeech: 'noun', definition: 'a close relationship between two species that often benefits both.' },
	{ word: 'Sustainable', partOfSpeech: 'adjective', definition: 'maintainable without depleting natural resources.' },
	{ word: 'Watershed', partOfSpeech: 'noun', definition: 'an area of land that drains into a common body of water.' },
	{ word: 'Photosynthesis', partOfSpeech: 'noun', definition: 'the process plants use to convert sunlight into energy.' },
	{ word: 'Pollinator', partOfSpeech: 'noun', definition: 'an animal that moves pollen from one flower to another.' },
	{ word: 'Compost', partOfSpeech: 'noun', definition: 'decayed organic material used as fertilizer for growing plants.' },
	{ word: 'Resilience', partOfSpeech: 'noun', definition: 'the ability of a system to recover from disturbances.' },
	{ word: 'Biodegradable', partOfSpeech: 'adjective', definition: 'capable of being decomposed by bacteria or other living organisms.' },
	{ word: 'Mycelium', partOfSpeech: 'noun', definition: 'the underground network of fungal threads beneath soil.' },
	{ word: 'Permaculture', partOfSpeech: 'noun', definition: 'a design approach that mimics natural ecosystems.' },
	{ word: 'Estuary', partOfSpeech: 'noun', definition: 'the mouth of a river where it meets the sea.' },
	{ word: 'Canopy', partOfSpeech: 'noun', definition: 'the uppermost layer of a forest formed by tree crowns.' },
	{ word: 'Renewable', partOfSpeech: 'adjective', definition: 'a resource that naturally replenishes within a human timescale.' },
	{ word: 'Carbon', partOfSpeech: 'noun', definition: 'a chemical element central to all known life on earth.' },
	{ word: 'Habitat', partOfSpeech: 'noun', definition: 'the natural home of a plant or animal.' },
	{ word: 'Migration', partOfSpeech: 'noun', definition: 'the seasonal movement of animals between regions.' },
	{ word: 'Foraging', partOfSpeech: 'verb', definition: 'searching widely for food or provisions.' },
	{ word: 'Wetland', partOfSpeech: 'noun', definition: 'land saturated with water supporting its own ecosystem.' },
	{ word: 'Apex', partOfSpeech: 'noun', definition: 'a predator at the top of its food chain.' },
	{ word: 'Endemic', partOfSpeech: 'adjective', definition: 'native and restricted to a particular geographic region.' },
	{ word: 'Equinox', partOfSpeech: 'noun', definition: 'a day when day and night are nearly equal in length.' },
	{ word: 'Solstice', partOfSpeech: 'noun', definition: 'the longest or shortest day of the year.' },
	{ word: 'Tundra', partOfSpeech: 'noun', definition: 'a treeless region where the subsoil is permanently frozen.' },
	{ word: 'Drought', partOfSpeech: 'noun', definition: 'a prolonged period of abnormally low rainfall.' },
	{ word: 'Erosion', partOfSpeech: 'noun', definition: 'the gradual wearing away of soil or rock by natural forces.' },
	{ word: 'Albedo', partOfSpeech: 'noun', definition: 'the proportion of sunlight reflected by a surface.' },
	{ word: 'Aquifer', partOfSpeech: 'noun', definition: 'an underground layer of rock that holds groundwater.' },
	{ word: 'Stewardship', partOfSpeech: 'noun', definition: 'the responsible care of natural resources.' },
	{ word: 'Lichen', partOfSpeech: 'noun', definition: 'a composite organism of fungus and algae living on rocks.' }
];
</script>
