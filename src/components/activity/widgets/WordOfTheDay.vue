<template>
	<UCard
		variant="soft"
		class="relative w-full min-w-0 p-4 shadow-md rounded-xl bg-linear-to-br from-info/10 via-primary/5 to-transparent overflow-hidden"
	>
		<div class="flex items-center justify-between gap-2 mb-2">
			<div class="flex items-center gap-2">
				<UIcon
					name="mdi:book-alphabet"
					class="size-5 text-info"
				/>
				<h3 class="text-sm font-semibold uppercase tracking-wide text-muted">Word of the Day</h3>
			</div>
			<span
				v-if="entry?.date"
				class="text-xs text-muted tabular-nums"
				>{{ entry.date }}</span
			>
		</div>

		<div
			v-if="loading"
			class="py-4 text-xs text-muted text-center"
		>
			Fetching today's word...
		</div>

		<template v-else-if="entry">
			<div class="mb-3">
				<p class="text-2xl font-bold tracking-tight wrap-break-word">{{ entry.word }}</p>
				<p class="text-xs italic text-muted">
					{{ entry.partOfSpeech
					}}<template v-if="entry.pronunciation">
						<span class="not-italic mx-1">•</span>{{ entry.pronunciation }}
					</template>
				</p>
			</div>

			<p class="text-sm mb-3">{{ entry.definition }}</p>

			<blockquote
				v-if="entry.example"
				class="text-xs italic text-muted border-l-2 border-info/40 pl-2 mb-3"
			>
				"{{ entry.example }}"
			</blockquote>

			<details
				v-if="entry.etymology"
				class="mb-3"
			>
				<summary class="text-xs text-info cursor-pointer hover:underline">Etymology</summary>
				<p class="text-xs text-muted mt-1">{{ entry.etymology }}</p>
			</details>

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
				<NuxtLink
					v-if="entry.sourceUrl"
					:to="entry.sourceUrl"
					target="_blank"
					rel="noopener noreferrer"
					class="text-xs text-info hover:underline self-center"
				>
					Source ({{ entry.source || 'dictionary' }})
				</NuxtLink>
			</div>
		</template>

		<UiSparkleBurst
			:trigger="sparkleTrigger"
			color="info"
		/>
	</UCard>
</template>

<script setup lang="ts">
// fetches the real "word of the day" from a free public API (wordoftheday.freeapi.me)
// and falls back to an eclectic baked-in pool when the request fails or storage is empty.
//
// the widget is mounted ONCE per day on /activities (above the grid), not in the
// rotating WidgetSlot pool — since the word is arbitrary per UTC day, rotating slots
// would show stale or duplicated words.

type WordEntry = {
	word: string;
	partOfSpeech: string;
	definition: string;
	pronunciation?: string;
	example?: string;
	etymology?: string;
	source?: string;
	sourceUrl?: string;
	date?: string;
};

const emit = defineEmits<{
	(event: 'complete', payload: { outcome: 'known' | 'saved' }): void;
}>();

const REMOTE_URL = 'https://wordoftheday.freeapi.me/';
const SAVED_KEY = 'wordoftheday:saved';
const SAVED_CAP = 30;
const REMOTE_CACHE_KEY = 'wordoftheday:remote';
// the remote refreshes daily; cache for 12h so we don't burn requests on every nav
const REMOTE_TTL_MS = 12 * 60 * 60 * 1000;

const remoteEntry = ref<WordEntry | null>(null);
const loading = ref(true);
const acted = ref(false);
const actedMsg = ref('');
const sparkleTrigger = ref(0);
const saved = ref(false);

// fallback pool used only when the remote API is unreachable.
// deterministic per UTC day so the offline experience still feels intentional.
function fallbackEntry(): WordEntry {
	const day = Math.floor(Date.now() / 86_400_000);
	const len = FALLBACK_WORDS.length;
	const i = ((day % len) + len) % len;
	return FALLBACK_WORDS[i] ?? FALLBACK_WORDS[0]!;
}

const entry = computed<WordEntry>(() => remoteEntry.value ?? fallbackEntry());

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
		list.unshift({
			word: w.word,
			partOfSpeech: w.partOfSpeech,
			definition: w.definition,
			...(w.example ? { example: w.example } : {}),
			...(w.etymology ? { etymology: w.etymology } : {})
		});
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

// reflect existing saved state on initial mount + when the entry changes
watchEffect(() => {
	if (typeof window === 'undefined') return;
	if (!entry.value?.word) return;
	saved.value = isAlreadySaved(entry.value.word);
});

onMounted(async () => {
	if (typeof window === 'undefined') {
		loading.value = false;
		return;
	}

	// hot path: serve from cache if fresh
	try {
		const raw = window.localStorage.getItem(REMOTE_CACHE_KEY);
		if (raw) {
			const cached = JSON.parse(raw) as { ts?: number; entry?: WordEntry };
			if (
				cached &&
				typeof cached.ts === 'number' &&
				Date.now() - cached.ts < REMOTE_TTL_MS &&
				cached.entry?.word
			) {
				remoteEntry.value = cached.entry;
				loading.value = false;
				return;
			}
		}
	} catch {
		// ignore cache read errors
	}

	// network fetch; AbortController bound to a 6s budget so a hanging API
	// never blocks the rest of the page from settling
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), 6000);
	try {
		const res = await fetch(REMOTE_URL, {
			signal: ctrl.signal,
			headers: { Accept: 'application/json' }
		});
		if (!res.ok) throw new Error(`status ${res.status}`);
		const data = (await res.json()) as WordEntry;
		if (data?.word && data?.definition) {
			remoteEntry.value = {
				word: data.word,
				partOfSpeech: data.partOfSpeech ?? '',
				definition: data.definition,
				pronunciation: data.pronunciation,
				example: data.example,
				etymology: data.etymology,
				source: data.source,
				sourceUrl: data.sourceUrl,
				date: data.date
			};
			try {
				window.localStorage.setItem(
					REMOTE_CACHE_KEY,
					JSON.stringify({ ts: Date.now(), entry: remoteEntry.value })
				);
			} catch {
				// quota — fine, we'll refetch next mount
			}
		}
	} catch (err) {
		// fallback pool already covers this case via the entry computed
		console.warn('[word-of-the-day] remote fetch failed, using fallback:', err);
	} finally {
		clearTimeout(timer);
		loading.value = false;
	}
});
</script>

<script lang="ts">
// 30 eclectic fallback words across nature, science, art, language, philosophy, food, music, tech
// prettier-ignore
const FALLBACK_WORDS = [
	{ word: 'Mycelium', partOfSpeech: 'noun', definition: 'the underground network of fungal threads beneath soil.' },
	{ word: 'Petrichor', partOfSpeech: 'noun', definition: 'the earthy scent produced when rain falls on dry soil.' },
	{ word: 'Symbiosis', partOfSpeech: 'noun', definition: 'a close relationship between two species that often benefits both.' },
	{ word: 'Aurora', partOfSpeech: 'noun', definition: 'a natural light display in the polar skies.' },
	{ word: 'Tessellate', partOfSpeech: 'verb', definition: 'to fit shapes together without gaps or overlaps.' },
	{ word: 'Apogee', partOfSpeech: 'noun', definition: 'the highest point or culmination of something.' },
	{ word: 'Chiaroscuro', partOfSpeech: 'noun', definition: 'the dramatic contrast of light and shadow in art.' },
	{ word: 'Counterpoint', partOfSpeech: 'noun', definition: 'two or more independent melodies played together.' },
	{ word: 'Pastiche', partOfSpeech: 'noun', definition: 'a work that imitates the style of another artist or era.' },
	{ word: 'Crescendo', partOfSpeech: 'noun', definition: 'a gradual increase in loudness or intensity.' },
	{ word: 'Defenestration', partOfSpeech: 'noun', definition: 'the act of throwing someone or something out of a window.' },
	{ word: 'Sonder', partOfSpeech: 'noun', definition: 'the realization that every stranger lives a life as vivid as your own.' },
	{ word: 'Onomatopoeia', partOfSpeech: 'noun', definition: 'a word that imitates the sound it describes.' },
	{ word: 'Liminal', partOfSpeech: 'adjective', definition: 'occupying a transitional space between two states.' },
	{ word: 'Sisyphean', partOfSpeech: 'adjective', definition: 'requiring endless effort with no clear end in sight.' },
	{ word: 'Apocryphal', partOfSpeech: 'adjective', definition: 'widely circulated but of doubtful authenticity.' },
	{ word: 'Ineffable', partOfSpeech: 'adjective', definition: 'too great or extreme to be expressed in words.' },
	{ word: 'Quotidian', partOfSpeech: 'adjective', definition: 'of or belonging to everyday life.' },
	{ word: 'Umami', partOfSpeech: 'noun', definition: 'a savory taste that rounds out the basic flavor profile.' },
	{ word: 'Verdant', partOfSpeech: 'adjective', definition: 'lush with green vegetation.' },
	{ word: 'Brackish', partOfSpeech: 'adjective', definition: 'slightly salty, as in the mix of fresh and sea water.' },
	{ word: 'Ambrosial', partOfSpeech: 'adjective', definition: 'exceptionally pleasing to taste or smell.' },
	{ word: 'Wabi-sabi', partOfSpeech: 'noun', definition: 'a Japanese aesthetic that finds beauty in imperfection.' },
	{ word: 'Sprezzatura', partOfSpeech: 'noun', definition: 'studied effortlessness in difficult work or art.' },
	{ word: 'Mellifluous', partOfSpeech: 'adjective', definition: 'sweet or musical; pleasant to hear.' },
	{ word: 'Susurrus', partOfSpeech: 'noun', definition: 'a soft, whispering or rustling sound.' },
	{ word: 'Palimpsest', partOfSpeech: 'noun', definition: 'a surface bearing visible traces of earlier writing.' },
	{ word: 'Anachronism', partOfSpeech: 'noun', definition: 'something out of its proper place in time.' },
	{ word: 'Synesthesia', partOfSpeech: 'noun', definition: 'a blending of the senses, such as seeing sounds as colors.' },
	{ word: 'Algorithm', partOfSpeech: 'noun', definition: 'a precise sequence of steps for solving a problem.' }
];
</script>
