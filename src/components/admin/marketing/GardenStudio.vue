<template>
	<div
		v-if="displayOnly && scene"
		class="w-full"
	>
		<CircleGarden
			:garden="derived"
			:render="renderConfig"
			:height="'min(70vh, 640px)'"
			:caption="state.title"
		/>
	</div>

	<div
		v-else
		class="flex flex-col gap-4"
	>
		<div>
			<h3 class="text-lg font-semibold">Garden Studio</h3>
			<p class="mt-1 text-sm text-muted">
				Grow a Shared Garden from mock contribution data, then record it fullscreen. Nothing here is
				a real circle; the numbers only shape the scene.
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<UButton
				v-for="preset in presets"
				:key="preset.name"
				:icon="preset.icon"
				color="primary"
				variant="soft"
				size="sm"
				@click="applyPreset(preset)"
				>{{ preset.name }}</UButton
			>
			<UButton
				icon="mdi:dice-5-outline"
				color="secondary"
				variant="soft"
				size="sm"
				@click="randomize"
				>Randomize</UButton
			>
			<UButton
				icon="mdi:replay"
				color="neutral"
				variant="soft"
				size="sm"
				@click="replay"
				>Replay Growth</UButton
			>
		</div>

		<div class="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
			<div class="order-2 flex flex-col gap-3 xl:order-1">
				<div class="flex items-center justify-between">
					<h4 class="text-sm font-semibold text-muted">Live Preview</h4>
					<UButton
						icon="mdi:fullscreen"
						color="neutral"
						variant="soft"
						size="sm"
						@click="present = true"
						>Present</UButton
					>
				</div>
				<div class="overflow-hidden rounded-2xl border border-default bg-elevated/30 p-2">
					<CircleGarden
						:key="replayKey"
						:garden="derived"
						:render="renderConfig"
						:height="360"
						:caption="state.title"
					/>
				</div>
			</div>

			<div class="order-1 flex flex-col gap-4 xl:order-2">
				<UFormField label="Title">
					<UInput
						v-model="state.title"
						placeholder="Spring Meadow"
						class="w-full"
					/>
				</UFormField>

				<UFormField :label="`Growth Level: ${state.level}`">
					<USlider
						v-model="state.level"
						:min="1"
						:max="12"
					/>
				</UFormField>

				<UFormField :label="`Elements: ${state.elementCount}`">
					<USlider
						v-model="state.elementCount"
						:min="0"
						:max="MAX_GARDEN_ELEMENTS"
					/>
				</UFormField>

				<UFormField :label="`Minutes Outside: ${state.totalMinutes.toLocaleString()}`">
					<USlider
						v-model="state.totalMinutes"
						:min="0"
						:max="3000"
						:step="20"
					/>
				</UFormField>

				<div class="flex items-center justify-between rounded-lg border border-default px-3 py-2">
					<div class="flex flex-col">
						<span class="text-sm font-medium">Animated (Perk)</span>
						<span class="text-xs text-muted">Particles, ripples, and twinkle</span>
					</div>
					<USwitch v-model="state.animated" />
				</div>

				<div class="flex flex-col gap-3 rounded-lg border border-default p-3">
					<span class="text-xs font-semibold tracking-wide text-muted uppercase">Scene Light</span>
					<div class="grid grid-cols-2 gap-3">
						<UFormField label="Season">
							<USelect
								v-model="state.season"
								:items="seasonItems"
								size="sm"
								class="w-full"
							/>
						</UFormField>
						<UFormField label="Time of Day">
							<USelect
								v-model="state.timeOfDay"
								:items="timeItems"
								size="sm"
								class="w-full"
							/>
						</UFormField>
					</div>
					<div class="flex items-center justify-between">
						<div class="flex flex-col">
							<span class="text-sm font-medium">Auto Moon</span>
							<span class="text-xs text-muted">Phase from today's date</span>
						</div>
						<USwitch v-model="autoMoon" />
					</div>
					<UFormField
						v-if="!autoMoon"
						:label="`Moon Phase: ${moonLabel}`"
					>
						<USlider
							v-model="moonSlider"
							:min="0"
							:max="100"
						/>
					</UFormField>
				</div>

				<div class="flex flex-col gap-2 rounded-lg border border-default p-3">
					<span class="text-xs font-semibold tracking-wide text-muted uppercase">Element Mix</span>
					<div
						v-for="kind in kinds"
						:key="kind"
						class="flex items-center gap-3"
					>
						<UIcon
							:name="meta[kind].icon"
							class="shrink-0 text-lg"
							:style="{ color: meta[kind].palette[0] }"
						/>
						<span class="w-16 shrink-0 text-xs">{{ meta[kind].label }}</span>
						<USlider
							v-model="state.mix[kind]"
							:min="0"
							:max="10"
							class="flex-1"
						/>
					</div>
				</div>
			</div>
		</div>

		<div class="flex flex-col gap-2 rounded-lg border border-default bg-elevated/30 p-3">
			<span class="text-xs font-semibold tracking-wide text-muted uppercase">Saved Scenes</span>
			<div class="flex flex-wrap items-end gap-2">
				<UFormField
					label="Scene Name"
					class="min-w-48 flex-1"
				>
					<UInput
						v-model="sceneName"
						placeholder="Spring Meadow Demo"
						class="w-full"
					/>
				</UFormField>
				<UButton
					icon="mdi:content-save-outline"
					color="primary"
					:loading="saving"
					:disabled="!sceneName.trim()"
					@click="onSave"
					>Save Scene</UButton
				>
				<USelectMenu
					v-model="selectedScene"
					:items="sceneItems"
					:loading="loadingScenes"
					placeholder="Load a Scene"
					class="min-w-56"
					@update:model-value="onSelectScene"
				/>
				<UButton
					icon="mdi:refresh"
					color="neutral"
					variant="soft"
					:loading="loadingScenes"
					aria-label="Refresh Scenes"
					@click="loadScenes"
				/>
				<UButton
					v-if="selectedScene"
					icon="mdi:trash-can-outline"
					color="error"
					variant="soft"
					:loading="deleting"
					@click="onDelete"
					>Delete</UButton
				>
			</div>
		</div>

		<Teleport to="body">
			<Transition name="garden-present">
				<div
					v-if="present"
					class="fixed inset-0 z-9990 flex flex-col bg-black"
				>
					<div class="absolute top-4 left-4 z-10 flex items-center gap-2">
						<UBadge
							color="primary"
							variant="subtle"
							icon="mdi:movie-open-play"
							>Preview Only</UBadge
						>
						<span class="text-sm text-white/80">{{ state.title }}</span>
					</div>
					<div class="absolute top-4 right-4 z-10 flex items-center gap-2">
						<AdminMarketingExportBar
							:target="presentGardenEl"
							:animated="state.animated"
							canvas-selector="canvas"
							:filename="state.title || 'circle-garden'"
							:static-override="gardenStaticOverride"
						/>
						<UButton
							icon="mdi:dice-5-outline"
							color="neutral"
							variant="soft"
							aria-label="Randomize"
							@click="randomize"
						/>
						<UButton
							icon="mdi:replay"
							color="neutral"
							variant="soft"
							aria-label="Replay Growth"
							@click="replay"
						/>
						<UButton
							icon="mdi:close"
							color="neutral"
							variant="soft"
							@click="present = false"
							>Exit</UButton
						>
					</div>
					<div
						ref="presentGardenEl"
						class="h-full w-full"
					>
						<CircleGarden
							:key="`present-${replayKey}`"
							ref="presentGardenComp"
							:garden="derived"
							:render="renderConfig"
							:height="'100vh'"
							:caption="state.title"
							class="h-full w-full"
						/>
					</div>
				</div>
			</Transition>
		</Teleport>
	</div>
</template>

<script setup lang="ts">
// drives the Circle Garden canvas with mock data for marketing recordings; scene CRUD
// rides useMarketingStudio under the 'garden' kind (ambient types only inside the macro)
const props = defineProps<MarketingStudioProps<GardenSceneState>>();

const { listScenes, saveScene, deleteScene } = useMarketingStudio();
const toast = useToast();

const kinds = GARDEN_ELEMENT_KINDS;
const meta = GARDEN_ELEMENT_META;
const presets = GARDEN_PRESETS;

const state = reactive<GardenSceneState>(emptyGardenScene());
const derived = computed(() => deriveMockGarden(state));
const renderConfig = computed(() => sceneRenderConfig(state));

const replayKey = ref(0);
const present = ref(false);
const presentGardenEl = ref<HTMLElement | null>(null);
// the garden component re-renders itself at the target scale for a CRISP high-res export
// (a plain html-to-image capture of the canvas only interpolates its fixed backing store)
const presentGardenComp = ref<{
	exportBlob?: (format: 'svg' | 'png' | 'jpg', scale: number) => Promise<Blob>;
} | null>(null);

const gardenStaticOverride = async (
	format: 'svg' | 'png' | 'jpg',
	pixelRatio: number
): Promise<Blob> => {
	const g = presentGardenComp.value;
	if (!g?.exportBlob) throw new Error('The garden is not ready to export yet.');
	return g.exportBlob(format, pixelRatio);
};

// #region scene-light controls (season / time-of-day / moon overrides)
const titleCase = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const seasonItems = [
	{ label: 'Auto', value: 'auto' },
	...GARDEN_SEASONS.map((s) => ({ label: titleCase(s), value: s }))
];
const timeItems = [
	{ label: 'Auto', value: 'auto' },
	...GARDEN_TIMES_OF_DAY.map((t) => ({ label: titleCase(t), value: t }))
];

const autoMoon = computed({
	get: () => state.moonPhase == null,
	set: (v: boolean) => {
		if (v) state.moonPhase = null;
		else if (state.moonPhase == null) state.moonPhase = 0.5;
	}
});
const moonSlider = computed({
	get: () => Math.round((state.moonPhase ?? 0) * 100),
	set: (v: number) => {
		state.moonPhase = v / 100;
	}
});
const moonLabel = computed(() => moonPhaseName(state.moonPhase ?? 0));
// #endregion

function assign(next: GardenSceneState) {
	state.title = next.title;
	state.level = next.level;
	state.totalMinutes = next.totalMinutes;
	state.elementCount = next.elementCount;
	state.seed = next.seed;
	state.animated = next.animated;
	state.mix = { ...next.mix };
	state.season = next.season ?? 'auto';
	state.timeOfDay = next.timeOfDay ?? 'auto';
	state.moonPhase = next.moonPhase ?? null;
}

function applyPreset(preset: { name: string; state: GardenSceneState }) {
	assign(preset.state);
	replay();
}

function randomize() {
	state.seed = Math.floor(Math.random() * 1_000_000);
	for (const kind of kinds) state.mix[kind] = Math.floor(Math.random() * 11);
	// keep at least one kind so the scene never collapses to nothing
	if (kinds.every((k) => state.mix[k] === 0)) state.mix.flower = 6;
	// shuffle the light too so a recording jumps across seasons / times / moons
	state.season = GARDEN_SEASONS[Math.floor(Math.random() * GARDEN_SEASONS.length)]!;
	state.timeOfDay = GARDEN_TIMES_OF_DAY[Math.floor(Math.random() * GARDEN_TIMES_OF_DAY.length)]!;
	state.moonPhase = Math.random();
	replay();
}

function replay() {
	replayKey.value++;
}

// --- scene persistence (garden kind through the shared marketing studio) ---
const GARDEN_KIND = 'garden' as MarketingKind;
const sceneName = ref('');
const saving = ref(false);
const deleting = ref(false);
const loadingScenes = ref(false);
const scenes = ref<MarketingScene<GardenSceneState>[]>([]);
const selectedScene = ref<{ label: string; value: string } | null>(null);
const sceneItems = computed(() => scenes.value.map((s) => ({ label: s.name, value: s.id })));

async function loadScenes() {
	loadingScenes.value = true;
	try {
		const res = await listScenes(GARDEN_KIND);
		if (res.success) {
			scenes.value = (res.data ?? []) as MarketingScene<GardenSceneState>[];
		} else {
			toast.add({
				title: 'Could Not Load Scenes',
				description: res.error || 'Please try again.',
				icon: 'mdi:cloud-alert-outline',
				color: 'warning'
			});
		}
	} finally {
		loadingScenes.value = false;
	}
}

async function onSave() {
	if (!sceneName.value.trim() || saving.value) return;
	saving.value = true;
	try {
		const payload = JSON.parse(JSON.stringify(state)) as GardenSceneState;
		const res = await saveScene<GardenSceneState>({
			name: sceneName.value.trim(),
			kind: GARDEN_KIND,
			source: 'manual',
			payload
		});
		if (res.success) {
			toast.add({
				title: 'Scene Saved',
				description: `"${sceneName.value.trim()}" is ready to reload.`,
				icon: 'mdi:content-save-check-outline',
				color: 'success'
			});
			await loadScenes();
		} else {
			toast.add({
				title: 'Could Not Save Scene',
				description: res.error || 'Please try again.',
				icon: 'mdi:cloud-alert-outline',
				color: 'error'
			});
		}
	} finally {
		saving.value = false;
	}
}

function onSelectScene(selection: { label: string; value: string } | null) {
	if (!selection) return;
	const scene = scenes.value.find((s) => s.id === selection.value);
	if (!scene?.payload) return;
	assign({ ...emptyGardenScene(), ...scene.payload });
	sceneName.value = scene.name;
	replay();
	toast.add({
		title: 'Scene Loaded',
		description: `Now editing "${scene.name}".`,
		icon: 'mdi:folder-open-outline',
		color: 'success'
	});
}

async function onDelete() {
	const id = selectedScene.value?.value;
	if (!id || deleting.value) return;
	deleting.value = true;
	try {
		const res = await deleteScene(id);
		if (res.success) {
			toast.add({ title: 'Scene Deleted', icon: 'mdi:trash-can-outline', color: 'neutral' });
			selectedScene.value = null;
			await loadScenes();
		} else {
			toast.add({
				title: 'Could Not Delete Scene',
				description: res.error || 'Please try again.',
				icon: 'mdi:cloud-alert-outline',
				color: 'error'
			});
		}
	} finally {
		deleting.value = false;
	}
}

watch(
	() => props.scene,
	(scene) => {
		if (scene?.payload) {
			assign({ ...emptyGardenScene(), ...scene.payload });
			sceneName.value = scene.name;
		}
	},
	{ immediate: true }
);

useEventListener(document, 'keydown', (e: KeyboardEvent) => {
	if (e.key === 'Escape' && present.value) {
		e.preventDefault();
		present.value = false;
	}
});

onMounted(() => {
	if (!props.displayOnly) loadScenes();
});
</script>

<style scoped>
.garden-present-enter-active,
.garden-present-leave-active {
	transition: opacity 220ms ease;
}

.garden-present-enter-from,
.garden-present-leave-to {
	opacity: 0;
}
</style>
