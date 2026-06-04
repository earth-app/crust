<template>
	<UCard
		variant="soft"
		class="relative min-w-72 max-w-md p-4 shadow-md rounded-xl bg-linear-to-br from-info/10 via-secondary/5 to-transparent overflow-hidden"
	>
		<div class="flex items-center gap-2 mb-2">
			<UIcon
				name="mdi:draw"
				class="size-5 text-info"
			/>
			<h3 class="text-sm font-semibold uppercase tracking-wide text-muted">Tiny Sketch</h3>
		</div>
		<p class="text-base font-medium mb-3">{{ prompt }}</p>

		<template v-if="!saved">
			<UiSketchCanvas
				:canvas-size="320"
				:persist-key="`tiny-sketch-${props.topic}`"
				compact
				confirm-label="Save"
				@capture="onCapture"
				@clear="onClear"
			/>
		</template>
		<template v-else>
			<div class="relative">
				<img
					v-if="lastImage"
					:src="lastImage"
					alt="Saved sketch"
					class="w-full rounded-lg border border-neutral-700 bg-white"
				/>
				<div class="flex items-center gap-2 text-success mt-3">
					<UIcon
						name="mdi:check-circle"
						class="size-4"
					/>
					<span class="text-xs font-semibold">Saved</span>
				</div>
				<p
					v-if="questHint"
					class="text-xs text-primary mt-2"
				>
					{{ questHint }}
				</p>
				<div class="mt-3">
					<UButton
						size="xs"
						color="primary"
						variant="ghost"
						icon="mdi:refresh"
						@click="reset"
					>
						Sketch Again
					</UButton>
				</div>
			</div>
		</template>

		<UiSparkleBurst
			:trigger="sparkleTrigger"
			color="info"
		/>
	</UCard>
</template>

<script setup lang="ts">
const props = withDefaults(
	defineProps<{
		prompt?: string;
		topic?: string;
		questHint?: string;
	}>(),
	{
		prompt: "Sketch something that represents today's activity",
		topic: 'default',
		questHint: 'Want a bigger canvas? Try a related quest'
	}
);

const emit = defineEmits<{
	(event: 'complete', payload: { file: File; dataUrl: string }): void;
}>();

const STORAGE_KEY = 'tiny-sketches';
const saved = ref(false);
const lastImage = ref<string | null>(null);
const sparkleTrigger = ref(0);

function onCapture(file: File) {
	const reader = new FileReader();
	reader.onload = () => {
		const dataUrl = typeof reader.result === 'string' ? reader.result : '';
		lastImage.value = dataUrl;
		saved.value = true;
		sparkleTrigger.value++;
		persist(dataUrl);
		emit('complete', { file, dataUrl });
	};
	reader.readAsDataURL(file);
}

function onClear() {
	// nothing to do at the widget level; canvas handles its own clear
}

function reset() {
	saved.value = false;
	lastImage.value = null;
}

function persist(dataUrl: string) {
	if (!import.meta.client) return;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		const list: { dataUrl: string; topic: string; at: number }[] = raw ? JSON.parse(raw) : [];
		list.unshift({ dataUrl, topic: props.topic, at: Date.now() });
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 5)));
	} catch {
		// localStorage quota or parse failure — silently skip
	}
}
</script>
