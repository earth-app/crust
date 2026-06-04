<template>
	<UCard
		variant="soft"
		class="relative min-w-72 max-w-md p-4 shadow-md rounded-xl bg-linear-to-br from-success/10 via-primary/5 to-transparent overflow-hidden"
	>
		<div class="flex items-center gap-2 mb-2">
			<UIcon
				name="mdi:earth"
				class="size-5 text-success"
			/>
			<h3 class="text-sm font-semibold uppercase tracking-wide text-muted">Today's Impact Goal</h3>
		</div>
		<p class="text-base font-medium mb-4">{{ goal }}</p>
		<button
			type="button"
			class="w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-colors"
			:class="
				done
					? 'border-success/60 bg-success/10 cursor-default'
					: 'border-muted/30 hover:border-success/50 hover:bg-success/5 cursor-pointer'
			"
			:disabled="done"
			@click="check"
		>
			<UIcon
				:name="done ? 'mdi:checkbox-marked-circle' : 'mdi:checkbox-blank-circle-outline'"
				class="size-8"
				:class="done ? 'text-success' : 'text-muted'"
			/>
			<div class="flex-1 text-left">
				<p class="text-sm font-semibold">
					{{ done ? 'Done for Today' : 'Mark Today Complete' }}
				</p>
				<p
					v-if="done"
					class="text-xs text-muted"
				>
					Streak: {{ streak }} consecutive day{{ streak === 1 ? '' : 's' }}
				</p>
			</div>
			<UIcon
				v-if="done && streak > 1"
				name="mdi:fire"
				class="size-6 text-warning"
			/>
		</button>
		<p
			v-if="done && questHint"
			class="text-xs text-primary mt-3"
		>
			{{ questHint }}
		</p>
		<UiSparkleBurst
			:trigger="sparkleTrigger"
			color="success"
		/>
	</UCard>
</template>

<script setup lang="ts">
const props = withDefaults(
	defineProps<{
		goal?: string;
		questHint?: string;
	}>(),
	{
		goal: 'Reduce one piece of waste',
		questHint: undefined
	}
);

const emit = defineEmits<{
	(event: 'complete', payload: { outcome: number }): void;
}>();

const STORAGE_KEY = 'impact_streak';
const done = ref(false);
const streak = ref(0);
const sparkleTrigger = ref(0);

// dateKey is UTC day so it stays stable across timezones
function todayKey(): string {
	const d = new Date();
	return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

function yesterdayKey(): string {
	const d = new Date(Date.now() - 86_400_000);
	return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

function readState(): { lastDay: string; streak: number } {
	if (!import.meta.client) return { lastDay: '', streak: 0 };
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return { lastDay: '', streak: 0 };
		const parsed = JSON.parse(raw);
		return { lastDay: parsed.lastDay ?? '', streak: parsed.streak ?? 0 };
	} catch {
		return { lastDay: '', streak: 0 };
	}
}

onMounted(() => {
	const state = readState();
	const today = todayKey();
	if (state.lastDay === today) {
		done.value = true;
		streak.value = state.streak;
	} else if (state.lastDay !== yesterdayKey() && state.lastDay !== '') {
		// streak broken — reset display to 0; persist on next check
		streak.value = 0;
	} else {
		streak.value = state.streak;
	}
});

function check() {
	if (done.value) return;
	const state = readState();
	const today = todayKey();
	const newStreak = state.lastDay === yesterdayKey() ? state.streak + 1 : 1;
	streak.value = newStreak;
	done.value = true;
	sparkleTrigger.value++;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ lastDay: today, streak: newStreak }));
	} catch {
		// quota — display still updates, just not persisted
	}
	emit('complete', { outcome: newStreak });
}
</script>
