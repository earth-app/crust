<template>
	<div
		v-if="displayOnly && scene"
		class="w-full"
	>
		<AdminMarketingQuestPreview
			:quest="quest"
			auto-present
		/>
	</div>

	<div
		v-else
		class="flex flex-col gap-4"
	>
		<div>
			<h3 class="text-lg font-semibold">Quest Studio</h3>
			<p class="mt-1 text-sm text-muted">
				Author a full custom quest, then preview the real quest modal, timeline, steps, completion
				overlay, and challenge banner with mock data. Nothing here starts, ends, or submits a real
				quest.
			</p>
		</div>

		<div class="flex flex-col gap-2 rounded-lg border border-default bg-elevated/30 p-3">
			<span class="text-xs font-semibold text-muted uppercase tracking-wide">Saved Scenes</span>
			<div class="flex flex-wrap items-end gap-2">
				<UFormField
					label="Scene Name"
					class="flex-1 min-w-48"
				>
					<UInput
						v-model="sceneName"
						placeholder="Nature Quest Demo"
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

		<div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
			<AdminMarketingQuestBuilder
				:model="builder"
				@template="onTemplate"
			/>
			<AdminMarketingQuestPreview :quest="quest" />
		</div>
	</div>
</template>

<script setup lang="ts">
// Marketing* types (shared/types) and the Builder* types + factory helpers (shared/utils) are
// all auto-imported; keeping them unimported means the defineProps<MarketingStudioProps<...>>
// macro resolves against ambient globals instead of a ~/shared alias a Vite build can't follow
const props = defineProps<MarketingStudioProps<BuilderQuest>>();

const toast = useToast();
const { listScenes, saveScene, deleteScene } = useMarketingStudio();

const builder = reactive<BuilderQuest>(emptyBuilderQuest());
const source = ref<MarketingSource>('manual');
const quest = computed(() => toPreviewQuest(builder));

const sceneName = ref('');
const saving = ref(false);
const deleting = ref(false);
const loadingScenes = ref(false);
const scenes = ref<MarketingScene<BuilderQuest>[]>([]);
const selectedScene = ref<{ label: string; value: string } | null>(null);

const sceneItems = computed(() => scenes.value.map((s) => ({ label: s.name, value: s.id })));

function applyBuilder(next: Partial<BuilderQuest>) {
	const base = emptyBuilderQuest();
	Object.assign(builder, base, next);
	builder.permissions = [...(next.permissions ?? [])];
	builder.steps = (next.steps ?? base.steps).map((step) => ({
		...step,
		_id: nextLocalId(),
		parameters: Array.isArray(step.parameters) ? [...step.parameters] : []
	}));
}

function onTemplate(title: string) {
	source.value = 'ai';
	toast.add({
		title: 'Template Loaded',
		description: `Now editing "${title}".`,
		icon: 'mdi:auto-fix',
		color: 'success'
	});
}

async function loadScenes() {
	loadingScenes.value = true;
	try {
		const res = await listScenes('quest');
		if (res.success) {
			scenes.value = (res.data ?? []) as MarketingScene<BuilderQuest>[];
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
	if (!sceneName.trim() || saving.value) return;
	saving.value = true;
	try {
		const payload = JSON.parse(JSON.stringify(builder)) as BuilderQuest;
		const res = await saveScene<BuilderQuest>({
			name: sceneName.value.trim(),
			kind: 'quest',
			source: source.value,
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
	if (!scene) return;
	applyBuilder(scene.payload);
	source.value = scene.source ?? 'manual';
	sceneName.value = scene.name;
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
			toast.add({
				title: 'Scene Deleted',
				icon: 'mdi:trash-can-outline',
				color: 'neutral'
			});
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
			applyBuilder(scene.payload);
			source.value = scene.source ?? 'manual';
			sceneName.value = scene.name;
		}
	},
	{ immediate: true }
);

onMounted(() => {
	if (!props.displayOnly) loadScenes();
});
</script>
