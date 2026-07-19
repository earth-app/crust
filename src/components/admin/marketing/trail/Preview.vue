<template>
	<div class="flex flex-col gap-4">
		<div
			v-if="!present"
			class="flex flex-col gap-3 rounded-lg border border-default bg-elevated/40 p-4"
		>
			<div class="flex items-center justify-between gap-2">
				<div class="flex items-center gap-2">
					<UIcon
						name="mdi:movie-open-play"
						class="size-5 text-primary"
					/>
					<span class="text-sm font-semibold">Live Preview</span>
				</div>
				<UBadge
					color="warning"
					variant="subtle"
					icon="mdi:shield-lock-outline"
					size="sm"
					>Preview Only</UBadge
				>
			</div>

			<div class="flex flex-wrap gap-2">
				<UButton
					icon="mdi:eye-outline"
					color="info"
					variant="soft"
					@click="openWalkthrough"
					>Open Walkthrough</UButton
				>
				<UButton
					icon="mdi:record-circle-outline"
					color="primary"
					@click="openFullFlow"
					>Record Full Flow</UButton
				>
				<UButton
					icon="mdi:presentation"
					color="neutral"
					variant="ghost"
					@click="enterPresent"
					>Present</UButton
				>
			</div>

			<p class="text-xs text-muted">
				The walkthrough is a read-only tour. The full flow simulates the pledge, presence timer,
				reflection, and reveal locally; nothing here starts a trail, credits real Nature Minutes, or
				reaches the server.
			</p>
		</div>

		<div
			v-if="present"
			class="fixed right-4 top-4 z-100000 flex items-center gap-2"
		>
			<AdminMarketingExportBar
				:get-target="resolveModalNode"
				:filename="trail?.title || 'trail-runner'"
			/>
			<UButton
				icon="mdi:close"
				color="neutral"
				variant="solid"
				size="sm"
				@click="exitPresent"
				>Exit Present</UButton
			>
		</div>

		<TrailRunner
			v-model:open="open"
			:trail="trail"
			:preview="mode === 'walkthrough'"
			@begin="onBegin"
			@complete="onComplete"
		/>
	</div>
</template>

<script setup lang="ts">
import { useTrailsStore } from 'stores/trails';

// Trail / NatureMinutes and the marketing helpers are auto-imported (shared/*); keeping
// the props types ambient keeps the defineProps macro off the ~/shared alias the build can't follow
const props = defineProps<{
	trail: Trail;
	natureMinutes?: NatureMinutes | null;
	autoPresent?: boolean;
}>();

type Mode = 'walkthrough' | 'full';

const store = useTrailsStore();
const wr = useWeeklyReflection();

const open = ref(false);
const present = ref(false);
const mode = ref<Mode>('walkthrough');

// seed the store so the runner resolves the trail without an extra fetch
watch(
	() => props.trail,
	(t) => {
		if (t) store.upsertTrail(t);
	},
	{ immediate: true }
);

// resolve the teleported runner modal (largest open dialog) so the ExportBar can snapshot it
function resolveModalNode(): HTMLElement | null {
	if (!import.meta.client) return null;
	const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'));
	if (!dialogs.length) return null;
	return dialogs.reduce((best, el) => {
		const a = el.getBoundingClientRect();
		const b = best.getBoundingClientRect();
		return a.width * a.height > b.width * b.height ? el : best;
	});
}

// #region preview harness (write-lock + state snapshot so the full flow never persists)

let active = false;
let restoreWriteLock: (() => void) | null = null;
let natureSnapshot: NatureMinutes | null = null;
let hadRun = false;
let weeklySnapshot: string | null = null;

function snapshotWeekly() {
	if (!import.meta.client) return;
	weeklySnapshot = window.localStorage.getItem(`weekly_reflection:${wr.weekKey.value}`);
}

function restoreWeekly() {
	if (!import.meta.client) return;
	const key = `weekly_reflection:${wr.weekKey.value}`;
	if (weeklySnapshot === null) window.localStorage.removeItem(key);
	else window.localStorage.setItem(key, weeklySnapshot);
	weeklySnapshot = null;
	wr.refresh();
}

function activate() {
	if (active || !props.trail) return;
	natureSnapshot = store.natureMinutes;
	hadRun = store.runs.has(props.trail.id);
	snapshotWeekly();

	// seed a mock weekly ring so the header + reveal reflect a real-looking total
	store.natureMinutes = props.natureMinutes ?? mockNatureMinutes({ minutes: 45 });

	restoreWriteLock = installTrailWriteLock(store, {
		startRun: async (t: Trail, pledge?: TrailPledge) => {
			const run = buildPreviewRun(t?.id ?? props.trail.id, pledge);
			store.runs.set(run.trailId, run);
			return run;
		},
		completeRun: async (id: string, reflection: TrailReflection, minutes?: number) => {
			const run = store.runs.get(id);
			if (run) run.completed = true;
			const credited = minutes ?? run?.presenceMinutes ?? 0;
			store.natureMinutes = creditPreviewNatureMinutes(store.natureMinutes, credited);
			const entry = buildPreviewJournalEntry(
				store.get(id) ?? props.trail,
				id,
				reflection,
				credited
			);
			return { success: true, data: entry };
		},
		fetchNatureMinutes: async () => {
			if (!store.natureMinutes)
				store.natureMinutes = props.natureMinutes ?? mockNatureMinutes({ minutes: 45 });
			return { success: true, data: store.natureMinutes };
		}
	});
	active = true;
}

function deactivate() {
	if (!active) return;
	restoreWriteLock?.();
	restoreWriteLock = null;
	if (!hadRun) store.clearRun(props.trail.id);
	store.natureMinutes = natureSnapshot;
	natureSnapshot = null;
	restoreWeekly();
	active = false;
}

// #endregion

function openWalkthrough() {
	mode.value = 'walkthrough';
	open.value = true;
}

function openFullFlow() {
	mode.value = 'full';
	activate();
	open.value = true;
}

// begin from the read-only walkthrough -> arm the harness, then flow into the real steps
function onBegin() {
	mode.value = 'full';
	activate();
}

function onComplete() {
	// the reveal handles its own celebration; nothing to persist in preview
}

function enterPresent() {
	present.value = true;
	if (!open.value) openWalkthrough();
}

function exitPresent() {
	present.value = false;
	open.value = false;
}

watch(open, (isOpen) => {
	if (!isOpen) {
		deactivate();
		present.value = false;
		mode.value = 'walkthrough';
	}
});

onMounted(() => {
	if (props.autoPresent) enterPresent();
});

onUnmounted(() => deactivate());

defineExpose({ openWalkthrough, openFullFlow, enterPresent });
</script>
