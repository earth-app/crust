<template>
	<UCard
		variant="soft"
		class="relative min-w-72 max-w-md p-4 shadow-md rounded-xl bg-linear-to-br from-warning/10 via-primary/5 to-transparent overflow-hidden"
	>
		<div class="flex items-center gap-2 mb-2">
			<UIcon
				name="mdi:feather"
				class="size-5 text-warning"
			/>
			<h3 class="text-sm font-semibold uppercase tracking-wide text-muted">Quick Reflection</h3>
		</div>
		<p class="text-base font-medium mb-3">{{ prompt }}</p>
		<template v-if="!saved">
			<UTextarea
				v-model="text"
				:rows="3"
				:maxlength="MAX"
				placeholder="A short thought is enough..."
				class="w-full"
				autoresize
			/>
			<div class="flex justify-between items-center mt-2">
				<span
					class="text-xs"
					:class="charCount > MAX - 20 ? 'text-warning' : 'text-muted'"
				>
					{{ charCount }} / {{ MAX }}
				</span>
				<UButton
					color="primary"
					variant="solid"
					:disabled="!canSubmit"
					icon="mdi:check"
					@click="submit"
				>
					Save Reflection
				</UButton>
			</div>
		</template>
		<template v-else>
			<p class="text-sm italic whitespace-pre-line mb-3">{{ text }}</p>
			<div class="flex items-center gap-2 text-success">
				<UIcon
					name="mdi:check-circle"
					class="size-4"
				/>
				<span class="text-xs font-semibold">Reflection Saved</span>
			</div>
			<p
				v-if="questHint"
				class="text-xs text-primary mt-2"
			>
				{{ questHint }}
			</p>
		</template>
		<UiSparkleBurst
			:trigger="sparkleTrigger"
			color="warning"
		/>
	</UCard>
</template>

<script setup lang="ts">
const props = withDefaults(
	defineProps<{
		prompt?: string;
		questHint?: string;
	}>(),
	{
		prompt: 'What surprised you about today?',
		questHint: 'Reflect deeper → Try a related quest'
	}
);

const emit = defineEmits<{
	(event: 'complete', payload: { outcome: string }): void;
}>();

const MAX = 280;
const STORAGE_KEY = 'reflections';
const text = ref('');
const saved = ref(false);
const sparkleTrigger = ref(0);

const charCount = computed(() => text.value.length);
const canSubmit = computed(() => text.value.trim().length > 0 && charCount.value <= MAX);

function submit() {
	if (!canSubmit.value) return;
	const trimmed = text.value.trim();
	text.value = trimmed;
	saved.value = true;
	sparkleTrigger.value++;
	persist(trimmed);
	emit('complete', { outcome: trimmed });
}

function persist(reflection: string) {
	if (!import.meta.client) return;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		const list: { text: string; at: number }[] = raw ? JSON.parse(raw) : [];
		list.unshift({ text: reflection, at: Date.now() });
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 10)));
	} catch {
		// localStorage quota or parse failure — silently skip
	}
}
</script>
