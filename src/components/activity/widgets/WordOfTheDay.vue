<template>
	<UCard
		variant="soft"
		class="relative w-full min-w-0 p-4 shadow-md rounded-xl bg-linear-to-br from-info/10 via-primary/5 to-transparent overflow-hidden"
	>
		<div class="flex items-center gap-2 mb-2">
			<UIcon
				name="mdi:book-alphabet"
				class="size-5 text-info"
			/>
			<h3 class="text-sm font-semibold uppercase tracking-wide text-muted">Word of the Day</h3>
		</div>
		<div class="mb-3">
			<p class="text-2xl font-bold tracking-tight wrap-break-word">{{ entry.word }}</p>
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
				:icon="saved ? 'mdi:bookmark-check' : 'mdi:bookmark-plus-outline'"
				:disabled="saved"
				@click="saveWord"
			>
				{{ saved ? 'Saved' : 'Save Word' }}
			</UButton>
		</div>
		<div
			v-else
			class="flex flex-col sm:flex-row gap-2 items-stretch"
		>
			<p class="text-xs text-success font-medium flex-1 flex items-center">
				<UIcon
					name="mdi:check-circle"
					class="size-4 inline mr-1"
				/>
				{{ actedMsg }}
			</p>
			<UButton
				color="neutral"
				variant="ghost"
				size="xs"
				icon="mdi:refresh"
				@click="showAnother"
			>
				Show Another
			</UButton>
		</div>
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

const props = withDefaults(
	defineProps<{ topic?: string; words?: WordEntry[]; questHint?: string }>(),
	{
		topic: 'today',
		words: () => DEFAULT_WORDS,
		questHint: undefined
	}
);

const emit = defineEmits<{
	(event: 'complete', payload: { outcome: 'known' | 'saved' | 'skipped' }): void;
}>();

const SAVED_KEY = 'wordoftheday:saved';
const SAVED_CAP = 30;
// 24h client cache key for a future cloud word-of-the-day route
const REMOTE_CACHE_KEY = 'wordoftheday:remote';
const REMOTE_TTL_MS = 24 * 60 * 60 * 1000;

const acted = ref(false);
const actedMsg = ref('');
const sparkleTrigger = ref(0);
const saved = ref(false);
const sessionOffset = ref(0);
const remoteWords = ref<WordEntry[] | null>(null);

// effective pool: remote (if available) else props.words
const pool = computed<WordEntry[]>(() => {
	const r = remoteWords.value;
	if (r && r.length > 0) return r;
	return props.words;
});

// deterministic pick per UTC day, shifted by sessionOffset for Show Another
function pickIndex(offset = 0): number {
	const day = Math.floor(Date.now() / 86_400_000);
	const len = pool.value.length;
	if (len === 0) return 0;
	return (((day + offset) % len) + len) % len;
}

const entry = computed<WordEntry>(
	() => pool.value[pickIndex(sessionOffset.value)] ?? pool.value[0] ?? DEFAULT_WORDS[0]!
);

// localStorage saved-words list (capped)
function readSavedList(): WordEntry[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = window.localStorage.getItem(SAVED_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(item): item is WordEntry =>
				item &&
				typeof item.word === 'string' &&
				typeof item.partOfSpeech === 'string' &&
				typeof item.definition === 'string'
		);
	} catch {
		return [];
	}
}

function isAlreadySaved(word: string): boolean {
	return readSavedList().some((w) => w.word.toLowerCase() === word.toLowerCase());
}

function saveWord() {
	if (typeof window === 'undefined') return;
	const list = readSavedList();
	const w = entry.value;
	if (!isAlreadySaved(w.word)) {
		list.unshift({ word: w.word, partOfSpeech: w.partOfSpeech, definition: w.definition });
		while (list.length > SAVED_CAP) list.pop();
		try {
			window.localStorage.setItem(SAVED_KEY, JSON.stringify(list));
		} catch {
			// quota or disabled storage — silent
		}
	}
	saved.value = true;
	acted.value = true;
	actedMsg.value = 'Saved to your words.';
	sparkleTrigger.value++;
	emit('complete', { outcome: 'saved' });
}

function markKnown() {
	acted.value = true;
	actedMsg.value = 'Glad you knew it.';
	sparkleTrigger.value++;
	emit('complete', { outcome: 'known' });
}

function showAnother() {
	sessionOffset.value++;
	acted.value = false;
	actedMsg.value = '';
	saved.value = false;
	emit('complete', { outcome: 'skipped' });
}

// reflect existing saved state on initial mount
watchEffect(() => {
	if (typeof window === 'undefined') return;
	saved.value = isAlreadySaved(entry.value.word);
});

// future cloud route: read 24h-cached remote pool if present.
// if no cloud word-of-the-day route exists, the fallback list ships as the pool.
onMounted(async () => {
	if (typeof window === 'undefined') return;
	try {
		const raw = window.localStorage.getItem(REMOTE_CACHE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as { ts?: number; words?: WordEntry[] };
			if (
				parsed &&
				typeof parsed.ts === 'number' &&
				Date.now() - parsed.ts < REMOTE_TTL_MS &&
				Array.isArray(parsed.words) &&
				parsed.words.length > 0
			) {
				remoteWords.value = parsed.words;
				return;
			}
		}
	} catch {
		// ignore cache read errors
	}
	// TODO(cloud): when a public word-of-the-day route lands, fetch here:
	// const res = await $fetch<WordEntry[]>('/api/word-of-the-day').catch(() => null);
	// if (res?.length) {
	//   remoteWords.value = res;
	//   window.localStorage.setItem(REMOTE_CACHE_KEY, JSON.stringify({ ts: Date.now(), words: res }));
	// }
});
</script>

<script lang="ts">
// 30 eclectic words across nature, science, art, language, philosophy, food, music, tech
// prettier-ignore
const DEFAULT_WORDS = [
	// nature & science
	{ word: 'Mycelium', partOfSpeech: 'noun', definition: 'the underground network of fungal threads beneath soil.' },
	{ word: 'Petrichor', partOfSpeech: 'noun', definition: 'the earthy scent produced when rain falls on dry soil.' },
	{ word: 'Symbiosis', partOfSpeech: 'noun', definition: 'a close relationship between two species that often benefits both.' },
	{ word: 'Aurora', partOfSpeech: 'noun', definition: 'a natural light display in the polar skies.' },
	{ word: 'Tessellate', partOfSpeech: 'verb', definition: 'to fit shapes together without gaps or overlaps.' },
	{ word: 'Apogee', partOfSpeech: 'noun', definition: 'the highest point or culmination of something.' },
	// art & music
	{ word: 'Chiaroscuro', partOfSpeech: 'noun', definition: 'the dramatic contrast of light and shadow in art.' },
	{ word: 'Counterpoint', partOfSpeech: 'noun', definition: 'two or more independent melodies played together.' },
	{ word: 'Pastiche', partOfSpeech: 'noun', definition: 'a work that imitates the style of another artist or era.' },
	{ word: 'Crescendo', partOfSpeech: 'noun', definition: 'a gradual increase in loudness or intensity.' },
	// language & writing
	{ word: 'Defenestration', partOfSpeech: 'noun', definition: 'the act of throwing someone or something out of a window.' },
	{ word: 'Sonder', partOfSpeech: 'noun', definition: 'the realization that every stranger lives a life as vivid as your own.' },
	{ word: 'Onomatopoeia', partOfSpeech: 'noun', definition: 'a word that imitates the sound it describes.' },
	{ word: 'Liminal', partOfSpeech: 'adjective', definition: 'occupying a transitional space between two states.' },
	// philosophy & cognition
	{ word: 'Sisyphean', partOfSpeech: 'adjective', definition: 'requiring endless effort with no clear end in sight.' },
	{ word: 'Apocryphal', partOfSpeech: 'adjective', definition: 'widely circulated but of doubtful authenticity.' },
	{ word: 'Ineffable', partOfSpeech: 'adjective', definition: 'too great or extreme to be expressed in words.' },
	{ word: 'Quotidian', partOfSpeech: 'adjective', definition: 'of or belonging to everyday life.' },
	// food & senses
	{ word: 'Umami', partOfSpeech: 'noun', definition: 'a savory taste that rounds out the basic flavor profile.' },
	{ word: 'Verdant', partOfSpeech: 'adjective', definition: 'lush with green vegetation.' },
	{ word: 'Brackish', partOfSpeech: 'adjective', definition: 'slightly salty, as in the mix of fresh and sea water.' },
	{ word: 'Ambrosial', partOfSpeech: 'adjective', definition: 'exceptionally pleasing to taste or smell.' },
	// culture & quirk
	{ word: 'Wabi-sabi', partOfSpeech: 'noun', definition: 'a Japanese aesthetic that finds beauty in imperfection.' },
	{ word: 'Sprezzatura', partOfSpeech: 'noun', definition: 'studied effortlessness in difficult work or art.' },
	{ word: 'Mellifluous', partOfSpeech: 'adjective', definition: 'sweet or musical; pleasant to hear.' },
	{ word: 'Susurrus', partOfSpeech: 'noun', definition: 'a soft, whispering or rustling sound.' },
	// history, tech, cosmos
	{ word: 'Palimpsest', partOfSpeech: 'noun', definition: 'a surface bearing visible traces of earlier writing.' },
	{ word: 'Anachronism', partOfSpeech: 'noun', definition: 'something out of its proper place in time.' },
	{ word: 'Synesthesia', partOfSpeech: 'noun', definition: 'a blending of the senses, such as seeing sounds as colors.' },
	{ word: 'Algorithm', partOfSpeech: 'noun', definition: 'a precise sequence of steps for solving a problem.' }
];
</script>
