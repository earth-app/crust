<template>
	<UCard
		variant="soft"
		class="relative min-w-72 max-w-md p-4 shadow-md rounded-xl bg-linear-to-br from-primary/10 via-secondary/5 to-transparent overflow-hidden"
	>
		<div class="flex items-center gap-2 mb-2">
			<UIcon
				name="mdi:poll"
				class="size-5 text-primary"
			/>
			<h3 class="text-sm font-semibold uppercase tracking-wide text-muted">Quick Poll</h3>
		</div>
		<p class="text-base font-medium mb-3">{{ question }}</p>
		<div class="flex flex-col gap-2">
			<UButton
				v-for="(option, i) in options"
				:key="`poll-${i}`"
				:variant="voted === null ? 'outline' : voted === i ? 'solid' : 'ghost'"
				:color="voted === i ? 'primary' : 'neutral'"
				:disabled="voted !== null || submitting"
				block
				class="justify-start text-left"
				@click="vote(i)"
			>
				{{ option }}
			</UButton>
		</div>
		<div
			v-if="voted !== null && isAuthed && hasAggregate"
			class="mt-3 flex flex-col gap-2"
		>
			<div
				v-for="(option, i) in options"
				:key="`bar-${i}`"
				class="flex flex-col gap-1"
			>
				<div class="flex justify-between text-xs text-muted">
					<span :class="{ 'text-primary font-semibold': voted === i }">{{ option }}</span>
					<span>{{ percentages[i] ?? 0 }}%</span>
				</div>
				<UProgress
					:model-value="percentages[i] ?? 0"
					:color="voted === i ? 'primary' : 'neutral'"
					size="sm"
				/>
			</div>
			<p
				v-if="aggregate && aggregate.total > 0"
				class="text-xs text-muted"
			>
				{{ aggregate.total }} {{ aggregate.total === 1 ? 'vote' : 'votes' }} so far
			</p>
			<p
				v-if="questHint"
				class="text-xs text-primary mt-2"
			>
				{{ questHint }}
			</p>
		</div>
		<div
			v-else-if="voted !== null && !isAuthed"
			class="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted flex items-center gap-2"
		>
			<UIcon
				name="mdi:account-arrow-right"
				class="size-4 text-primary shrink-0"
			/>
			<span>
				Sign in to make your vote count and see what others picked.
				<NuxtLink
					to="/login"
					class="text-primary font-semibold underline"
				>
					Sign in
				</NuxtLink>
			</span>
		</div>

		<p
			v-if="errorMessage"
			class="text-xs text-danger mt-2"
		>
			{{ errorMessage }}
		</p>

		<UiSparkleBurst
			:trigger="sparkleTrigger"
			color="primary"
		/>
	</UCard>
</template>

<script setup lang="ts">
import type { PollAggregate } from '~/composables/usePoll';
import { sanitizePollId } from '~/composables/usePoll';

const props = withDefaults(
	defineProps<{
		question?: string;
		options?: string[];
		// optional explicit id so callers can scope a poll to "this article", "this activity", etc.
		pollId?: string;
		questHint?: string;
	}>(),
	{
		question: 'Which would you choose: Plant a tree OR Walk 1 mile?',
		options: () => ['Plant a tree', 'Walk 1 mile'],
		pollId: undefined,
		questHint: undefined
	}
);

const emit = defineEmits<{
	(event: 'complete', payload: { outcome: number }): void;
}>();

const { isAuthed, submitVote, fetchMyVotes } = usePoll();

const voted = ref<number | null>(null);
const submitting = ref(false);
const errorMessage = ref<string | null>(null);
const aggregate = ref<PollAggregate | null>(null);
const sparkleTrigger = ref(0);

// stable id from explicit prop, else a deterministic hash of the question so repeat renders bucket together
const effectivePollId = computed(() => {
	if (props.pollId) return sanitizePollId(props.pollId);
	return sanitizePollId(`q-${hashString(props.question)}`);
});

function hashString(input: string): string {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return (h >>> 0).toString(36);
}

const hasAggregate = computed(() => (aggregate.value?.total ?? 0) > 0);

const percentages = computed<number[]>(() => {
	const counts = aggregate.value?.counts ?? [];
	const total = aggregate.value?.total ?? 0;
	if (total <= 0) return props.options.map(() => 0);
	return props.options.map((_, i) => Math.round(((counts[i] ?? 0) / total) * 100));
});

async function vote(i: number) {
	if (voted.value !== null || submitting.value) return;
	voted.value = i;
	sparkleTrigger.value++;
	emit('complete', { outcome: i });

	if (!isAuthed.value) {
		return; // anonymous: client-side only, no aggregate displayed
	}

	submitting.value = true;
	errorMessage.value = null;
	const res = await submitVote({
		poll_id: effectivePollId.value,
		option_index: i,
		question: props.question,
		options: props.options
	});
	submitting.value = false;
	if (valid(res)) {
		aggregate.value = res.data.aggregate ?? null;
	} else {
		errorMessage.value = res.message || 'Could not record vote.';
	}
}

// hydrate prior vote + aggregate if the user already answered this poll
onMounted(async () => {
	if (!isAuthed.value) return;
	const res = await fetchMyVotes();
	if (!valid(res)) return;
	const prior = res.data.find((v) => v.poll_id === effectivePollId.value);
	if (prior) {
		voted.value = prior.option_index;
		aggregate.value = prior.aggregate ?? null;
	}
});
</script>
