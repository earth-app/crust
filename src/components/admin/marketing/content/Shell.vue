<template>
	<div
		v-if="displayOnly"
		class="flex w-full items-center justify-center"
	>
		<slot name="preview" />
	</div>
	<div
		v-else
		class="flex flex-col gap-4"
	>
		<div class="flex flex-col gap-3 rounded-lg border border-default p-3">
			<div class="flex flex-wrap items-center gap-2">
				<span class="text-sm font-semibold text-muted">Get Mock Data</span>
				<UBadge
					color="neutral"
					variant="subtle"
					icon="mdi:source-branch"
					class="ml-auto"
					>{{ sourceLabel }}</UBadge
				>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<UButton
					v-if="canPull"
					icon="mdi:database-search-outline"
					color="info"
					variant="soft"
					:loading="pulling"
					:disabled="pulling"
					@click="onPull"
					>Pull Live</UButton
				>
				<template v-if="canGenerate">
					<UInput
						v-model="hint"
						placeholder="Optional topic hint"
						icon="mdi:lightbulb-on-outline"
						class="w-full sm:w-64"
						@keyup.enter="onGenerate"
					/>
					<UButton
						icon="mdi:auto-fix"
						color="primary"
						:loading="generating"
						:disabled="generating"
						@click="onGenerate"
						>AI Generate</UButton
					>
				</template>
			</div>
		</div>

		<div class="flex flex-col gap-2">
			<slot />
		</div>

		<div
			v-if="showScenes"
			class="flex flex-col gap-3 rounded-lg border border-default p-3"
		>
			<span class="text-sm font-semibold text-muted">Scenes</span>
			<div class="flex flex-wrap items-end gap-2">
				<UFormField
					label="Scene Name"
					class="grow"
				>
					<UInput
						v-model="sceneName"
						placeholder="My Demo Scene"
						class="w-full"
					/>
				</UFormField>
				<UButton
					icon="mdi:content-save-outline"
					color="success"
					:loading="saving"
					:disabled="saving || !sceneName.trim()"
					@click="onSave"
					>Save Scene</UButton
				>
			</div>
			<div class="flex flex-wrap items-end gap-2">
				<UFormField
					label="Load Scene"
					class="grow"
				>
					<USelect
						v-model="selectedSceneId"
						:items="sceneItems"
						placeholder="Select a Saved Scene"
						class="w-full"
					/>
				</UFormField>
				<UButton
					icon="mdi:tray-arrow-down"
					color="secondary"
					variant="soft"
					:disabled="!selectedSceneId"
					@click="onLoadSelected"
					>Load</UButton
				>
				<UButton
					icon="mdi:delete-outline"
					color="error"
					variant="soft"
					:loading="deleting"
					:disabled="deleting || !selectedSceneId"
					@click="onDelete"
					>Delete</UButton
				>
				<UButton
					icon="mdi:refresh"
					color="neutral"
					variant="ghost"
					:loading="loadingScenes"
					@click="refreshScenes"
					>Refresh</UButton
				>
			</div>
		</div>

		<div class="flex items-center justify-between">
			<h3 class="text-sm font-semibold text-muted">Live Preview</h3>
			<UButton
				icon="mdi:fullscreen"
				color="neutral"
				variant="soft"
				@click="present = true"
				>Present</UButton
			>
		</div>
		<div
			v-if="!present"
			class="rounded-lg border border-dashed border-default bg-elevated/30 p-2"
		>
			<slot name="preview" />
		</div>
	</div>

	<Teleport to="body">
		<div
			v-if="present"
			class="fixed inset-0 z-9990 flex flex-col bg-default"
		>
			<div class="flex items-center justify-between p-3">
				<UBadge
					color="primary"
					variant="subtle"
					icon="mdi:movie-open-play"
					>{{ presentTitle || 'Preview' }}</UBadge
				>
				<UButton
					icon="mdi:close"
					color="neutral"
					variant="soft"
					@click="present = false"
					>Close</UButton
				>
			</div>
			<div class="flex flex-1 items-center justify-center overflow-auto p-4">
				<slot name="preview" />
			</div>
		</div>
	</Teleport>
</template>

<script setup lang="ts">
import type { MarketingKind, MarketingScene, MarketingSource } from '~/shared/types/marketing';

const props = defineProps<{
	kind: MarketingKind;
	payload: unknown;
	canGenerate?: boolean;
	canPull?: boolean;
	canSaveScenes?: boolean;
	displayOnly?: boolean;
	presentTitle?: string;
}>();

const emit = defineEmits<{
	(e: 'load', value: { payload: unknown; mode: 'raw' | 'scene'; source: MarketingSource }): void;
}>();

const studio = useMarketingStudio();
const toast = useToast();

const source = ref<MarketingSource>('manual');
const sourceLabel = computed(
	() => ({ manual: 'Manual', live: 'Live Sample', ai: 'AI Generated' })[source.value] ?? 'Manual'
);

const hint = ref('');
const generating = ref(false);
const pulling = ref(false);

async function onGenerate() {
	generating.value = true;
	const res = await studio.generate<{
		payload: unknown;
		fallback?: boolean;
		source?: MarketingSource;
	}>(props.kind, hint.value.trim() || undefined);
	generating.value = false;

	if (!res.success || !res.data) {
		toast.add({
			title: 'Generation Failed',
			description: res.error || 'The AI generator did not return anything. Try again.',
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 6000
		});
		return;
	}

	source.value = 'ai';
	emit('load', { payload: res.data.payload, mode: 'raw', source: 'ai' });
	toast.add({
		title: 'Content Generated',
		description: res.data.fallback
			? 'No live source was available, so a deterministic sample was used.'
			: 'A fresh AI mock was loaded into the form.',
		icon: 'mdi:auto-fix',
		color: res.data.fallback ? 'warning' : 'success',
		duration: 5000
	});
}

async function onPull() {
	pulling.value = true;
	const res = await studio.pullLive<{ payload: unknown }>(props.kind);
	pulling.value = false;

	if (!res.success || !res.data) {
		toast.add({
			title: 'Pull Failed',
			description: res.error || 'No live sample could be pulled from the API.',
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 6000
		});
		return;
	}

	source.value = 'live';
	emit('load', { payload: res.data.payload, mode: 'raw', source: 'live' });
	toast.add({
		title: 'Live Sample Loaded',
		description: 'A real sample was loaded into the form to tweak.',
		icon: 'mdi:database-check-outline',
		color: 'success',
		duration: 5000
	});
}

const scenes = ref<MarketingScene[]>([]);
const loadingScenes = ref(false);
const selectedSceneId = ref<string | undefined>(undefined);
const sceneName = ref('');
const saving = ref(false);
const deleting = ref(false);

const sceneItems = computed(() =>
	scenes.value.map((s) => ({
		label: s.description ? `${s.name} — ${s.description}` : s.name,
		value: s.id
	}))
);

async function refreshScenes() {
	loadingScenes.value = true;
	const res = await studio.listScenes(props.kind);
	loadingScenes.value = false;
	if (res.success && res.data) scenes.value = res.data;
}

async function onSave() {
	if (!sceneName.trim()) return;
	saving.value = true;
	const res = await studio.saveScene({
		kind: props.kind,
		source: source.value,
		payload: clone(props.payload),
		name: sceneName.value.trim()
	});
	saving.value = false;

	if (!res.success || !res.data) {
		toast.add({
			title: 'Save Failed',
			description: res.error || 'The scene could not be saved.',
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 6000
		});
		return;
	}

	scenes.value = [res.data, ...scenes.value.filter((s) => s.id !== res.data!.id)];
	selectedSceneId.value = res.data.id;
	sceneName.value = '';
	toast.add({
		title: 'Scene Saved',
		description: 'This preview can be reloaded from the Load Scene list.',
		icon: 'mdi:content-save-check-outline',
		color: 'success',
		duration: 4000
	});
}

function onLoadSelected() {
	const scene = scenes.value.find((s) => s.id === selectedSceneId.value);
	if (!scene) return;
	source.value = scene.source;
	emit('load', { payload: scene.payload, mode: 'scene', source: scene.source });
	toast.add({
		title: 'Scene Loaded',
		description: `"${scene.name}" was loaded into the form.`,
		icon: 'mdi:tray-arrow-down',
		color: 'info',
		duration: 4000
	});
}

async function onDelete() {
	if (!selectedSceneId.value) return;
	deleting.value = true;
	const res = await studio.deleteScene(selectedSceneId.value);
	deleting.value = false;

	if (!res.success) {
		toast.add({
			title: 'Delete Failed',
			description: res.error || 'The scene could not be deleted.',
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 6000
		});
		return;
	}

	scenes.value = scenes.value.filter((s) => s.id !== selectedSceneId.value);
	selectedSceneId.value = undefined;
	toast.add({
		title: 'Scene Deleted',
		description: 'The saved scene was removed.',
		icon: 'mdi:delete-outline',
		color: 'success',
		duration: 4000
	});
}

function clone<T>(value: T): T {
	try {
		return structuredClone(value);
	} catch {
		return JSON.parse(JSON.stringify(value));
	}
}

const present = ref(false);
useEventListener(document, 'keydown', (e: KeyboardEvent) => {
	if (e.key === 'Escape' && present.value) {
		e.preventDefault();
		present.value = false;
	}
});

const showScenes = computed(() => props.canSaveScenes !== false);

onMounted(() => {
	if (!props.displayOnly && showScenes.value) refreshScenes();
});
</script>
