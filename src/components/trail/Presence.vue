<template>
	<div class="flex flex-col items-center text-center gap-6 py-8 px-4 max-w-xl mx-auto">
		<div class="flex flex-col gap-2">
			<span class="text-xs uppercase tracking-widest opacity-60">Be Present</span>
			<div
				class="flex items-center justify-center size-16 rounded-full bg-primary/10 text-primary mx-auto"
				:class="running && !reduced ? 'motion-safe:animate-pulse' : ''"
			>
				<UIcon
					:name="meta.icon"
					class="size-9"
				/>
			</div>
			<h2 class="text-lg font-semibold">{{ meta.label }}</h2>
			<p class="text-base opacity-90 wrap-break-word">{{ meta.cue }}</p>
		</div>

		<div class="flex flex-col items-center gap-1">
			<span class="text-5xl font-semibold tabular-nums tracking-tight">{{ clock }}</span>
			<span class="text-xs opacity-60"
				>Suggested {{ targetMinutes }} min &middot; go at your own pace</span
			>
		</div>

		<p class="text-sm opacity-60 max-w-md">
			The app doesn't need to stay open. Put it away, be where you are, then come back and log your
			time.
		</p>

		<div
			v-if="meta.photos"
			class="flex items-center gap-3 rounded-lg border border-default px-3 py-2"
		>
			<span class="text-sm opacity-80">Photos Taken</span>
			<UButton
				variant="soft"
				color="neutral"
				size="xs"
				icon="mdi:minus"
				square
				aria-label="One Fewer Photo"
				:disabled="photoCount <= 0"
				@click="photoCount = Math.max(0, photoCount - 1)"
			/>
			<span class="text-sm font-semibold tabular-nums w-5">{{ photoCount }}</span>
			<UButton
				variant="soft"
				color="primary"
				size="xs"
				icon="mdi:plus"
				square
				aria-label="One More Photo"
				@click="photoCount++"
			/>
		</div>

		<div class="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
			<UButton
				:color="running ? 'neutral' : 'primary'"
				:variant="running ? 'soft' : 'solid'"
				size="lg"
				:icon="running ? 'mdi:pause' : 'mdi:play'"
				class="w-full sm:w-auto"
				@click="toggle"
				>{{ running ? 'Pause Timer' : elapsed > 0 ? 'Resume Timer' : 'Start Timer' }}</UButton
			>
			<UButton
				color="success"
				size="lg"
				icon="mdi:check"
				class="w-full sm:w-auto"
				@click="finish"
				>Log {{ loggedMinutes }} Nature Minutes</UButton
			>
		</div>
	</div>
</template>

<script setup lang="ts">
const props = defineProps<{
	practice: TrailPractice;
	targetMinutes: number;
}>();

const emit = defineEmits<{
	finish: [payload: { minutes: number; photoCount: number }];
}>();

const meta = computed(() => trailPracticeMeta(props.practice));

const reduced = ref(false);
const elapsed = ref(0); // seconds
const running = ref(false);
const photoCount = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

// logged minutes track the live timer once started, else fall back to the suggestion
const loggedMinutes = computed(() =>
	elapsed.value > 0 ? Math.max(1, Math.round(elapsed.value / 60)) : props.targetMinutes
);

const clock = computed(() => {
	const m = Math.floor(elapsed.value / 60);
	const s = elapsed.value % 60;
	return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
});

function toggle() {
	running.value = !running.value;
}

function tick() {
	if (running.value) elapsed.value++;
}

function finish() {
	running.value = false;
	emit('finish', { minutes: loggedMinutes.value, photoCount: photoCount.value });
}

onMounted(() => {
	if (!import.meta.client) return;
	reduced.value = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
	timer = setInterval(tick, 1000);
});

onBeforeUnmount(() => {
	if (timer) clearInterval(timer);
});
</script>
