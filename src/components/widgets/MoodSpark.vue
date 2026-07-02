<template>
	<UCard
		variant="soft"
		class="relative min-w-72 max-w-md p-4 shadow-md rounded-xl bg-linear-to-br from-info/10 via-primary/5 to-transparent overflow-hidden"
	>
		<div class="flex items-center gap-2 mb-2">
			<UIcon
				name="mdi:heart-pulse"
				class="size-5 text-info"
			/>
			<h3 class="text-sm font-semibold uppercase tracking-wide text-muted">Mood Spark</h3>
		</div>
		<p class="text-base font-medium mb-3">{{ question }}</p>

		<div
			v-if="!showResults"
			class="grid grid-cols-3 sm:grid-cols-6 gap-2"
		>
			<button
				v-for="emoji in EMOJIS"
				:key="emoji"
				type="button"
				:disabled="loading"
				:title="MOOD_LABELS[emoji]"
				:aria-label="`Vote ${MOOD_LABELS[emoji]}`"
				class="group flex flex-col items-center gap-1 py-2 rounded-lg border border-default bg-elevated/40 hover:bg-info/10 hover:border-info/40 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
				@click="onVote(emoji)"
			>
				<span class="text-3xl transition-transform duration-200 group-hover:scale-110">{{
					emoji
				}}</span>
				<span class="text-[10px] uppercase tracking-wide text-muted group-hover:text-info">{{
					MOOD_LABELS[emoji]
				}}</span>
			</button>
		</div>

		<div
			v-else
			class="flex flex-col gap-2"
		>
			<div
				v-for="emoji in EMOJIS"
				:key="`bar-${emoji}`"
				class="flex items-center gap-2"
			>
				<span class="text-xl shrink-0 w-8 text-center">{{ emoji }}</span>
				<div class="flex-1">
					<UProgress
						:model-value="percentages[emoji]"
						:color="myVote === emoji ? 'info' : 'neutral'"
						size="sm"
					/>
				</div>
				<span
					class="text-xs text-muted tabular-nums w-10 text-right"
					:class="{ 'text-info font-semibold': myVote === emoji }"
					>{{ percentages[emoji] }}%</span
				>
			</div>
			<p
				v-if="snapshot && snapshot.total > 0"
				class="text-xs text-muted mt-1"
			>
				{{ snapshot.total }} {{ snapshot.total === 1 ? 'voice' : 'voices' }} today
			</p>
		</div>

		<UAlert
			v-if="errorMessage"
			color="error"
			variant="subtle"
			icon="mdi:alert-circle"
			:title="errorMessage"
			:close="{ color: 'error', variant: 'link' }"
			class="mt-2"
			@update:open="errorMessage = null"
		/>

		<UiSparkleBurst
			:trigger="sparkleTrigger"
			color="info"
		/>
	</UCard>
</template>

<script setup lang="ts">
const props = withDefaults(
	defineProps<{
		topic?: string;
		question?: string;
	}>(),
	{
		topic: 'today',
		question: 'How are you feeling about today?'
	}
);

const emit = defineEmits<{
	(event: 'complete', payload: { emoji: MoodEmoji }): void;
}>();

const { snapshot, hasVoted, vote, fetchSnapshot, EMOJIS } = useMood(() => props.topic);
const toast = useToast();

// short labels keep the button readable in the 6-up grid and double as aria-labels
const MOOD_LABELS: Record<MoodEmoji, string> = {
	'😍': 'Love',
	'😊': 'Good',
	'🤔': 'Curious',
	'😐': 'Meh',
	'😟': 'Worried',
	'😤': 'Frustrated'
};

const myVote = ref<MoodEmoji | null>(null);
const loading = ref(false);
const sparkleTrigger = ref(0);
const errorMessage = ref<string | null>(null);
const showResults = computed(() => hasVoted.value || myVote.value !== null);

const percentages = computed<Record<MoodEmoji, number>>(() => {
	const counts = snapshot.value?.counts;
	const total = snapshot.value?.total ?? 0;
	const out = {} as Record<MoodEmoji, number>;
	for (const e of EMOJIS) {
		const v = counts?.[e] ?? 0;
		out[e] = total > 0 ? Math.round((v / total) * 100) : 0;
	}
	return out;
});

async function onVote(emoji: MoodEmoji) {
	if (loading.value || hasVoted.value) return;
	loading.value = true;
	errorMessage.value = null;

	const res = await vote(props.topic, emoji);
	loading.value = false;

	if (res.success) {
		myVote.value = emoji;
		sparkleTrigger.value++;
		emit('complete', { emoji });
		toast.add({
			title: 'Mood Recorded',
			description: 'Thanks for sharing — your spark joins the others today.',
			icon: 'mdi:heart-pulse',
			color: 'info',
			duration: 4500
		});
	} else {
		errorMessage.value = res.error ?? 'Could not record your mood.';
		// "already voted from this device" is informational, not a toast-worthy error
		if (!res.error?.toLowerCase().includes('already')) {
			toast.add({
				title: 'Could Not Record Mood',
				description: errorMessage.value,
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 6000
			});
		}
	}
}

onMounted(async () => {
	if (import.meta.client && hasVoted.value) {
		// no stored emoji from the prior session, so we just leave myVote null
		// and let the bars highlight without a per-user winner
	}
	await fetchSnapshot();
});
</script>
