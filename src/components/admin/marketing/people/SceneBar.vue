<template>
	<div class="flex flex-col gap-3 rounded-lg border border-gray-700 light:border-gray-300 p-3">
		<div class="flex items-center gap-2 text-sm font-semibold text-muted">
			<UIcon
				name="mdi:bookmark-multiple-outline"
				class="size-4"
			/>
			<span>Scenes</span>
		</div>

		<div class="grid grid-cols-1 gap-2 md:grid-cols-2">
			<UFormField label="Scene Name">
				<UInput
					v-model="name"
					placeholder="Sunrise Persona Demo"
					:disabled="disabled || saving"
				/>
			</UFormField>
			<UFormField label="Description">
				<UInput
					v-model="description"
					placeholder="Optional note for this recording"
					:disabled="disabled || saving"
				/>
			</UFormField>
		</div>

		<div class="flex flex-wrap items-end gap-2">
			<UButton
				icon="mdi:content-save-outline"
				color="primary"
				:loading="saving"
				:disabled="disabled || !name.trim()"
				@click="save"
				>Save Scene</UButton
			>

			<div class="flex flex-1 flex-wrap items-end gap-2 min-w-60">
				<UFormField
					label="Load Scene"
					class="flex-1 min-w-40"
				>
					<USelect
						v-model="selectedId"
						:items="sceneItems"
						:loading="loadingList"
						:disabled="disabled || scenes.length === 0"
						placeholder="Select a Saved Scene"
						class="w-full"
					/>
				</UFormField>
				<UButton
					icon="mdi:tray-arrow-up"
					color="neutral"
					variant="soft"
					:disabled="disabled || !selectedId"
					@click="load"
					>Load</UButton
				>
				<UButton
					icon="mdi:trash-can-outline"
					color="error"
					variant="soft"
					:loading="deleting"
					:disabled="disabled || !selectedId"
					@click="remove"
					>Delete</UButton
				>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import type {
	MarketingKind,
	MarketingScene,
	MarketingSource
} from '../../../../shared/types/marketing';

const props = withDefaults(
	defineProps<{
		kind: MarketingKind;
		payload: unknown;
		source?: MarketingSource;
		disabled?: boolean;
	}>(),
	{ source: 'manual' }
);

const emit = defineEmits<{
	(event: 'load', payload: unknown, scene: MarketingScene): void;
}>();

const { listScenes, saveScene, deleteScene } = useMarketingStudio();
const toast = useToast();

const name = ref('');
const description = ref('');
const scenes = ref<MarketingScene[]>([]);
const selectedId = ref<string | undefined>(undefined);
const saving = ref(false);
const deleting = ref(false);
const loadingList = ref(false);

const sceneItems = computed(() => scenes.value.map((s) => ({ label: s.name, value: s.id })));

async function refresh() {
	loadingList.value = true;
	try {
		const res = await listScenes(props.kind);
		scenes.value = res.success && res.data ? res.data : [];
		if (selectedId.value && !scenes.value.some((s) => s.id === selectedId.value)) {
			selectedId.value = undefined;
		}
	} finally {
		loadingList.value = false;
	}
}

async function save() {
	if (!name.value.trim() || saving.value) return;
	saving.value = true;
	try {
		const res = await saveScene({
			name: name.value.trim(),
			description: description.value.trim() || undefined,
			kind: props.kind,
			source: props.source,
			payload: props.payload
		});
		if (res.success) {
			toast.add({
				title: 'Scene Saved',
				description: `"${name.value.trim()}" is ready to reload.`,
				icon: 'mdi:content-save-check-outline',
				color: 'success'
			});
			name.value = '';
			description.value = '';
			await refresh();
		} else {
			toast.add({
				title: 'Save Failed',
				description: res.error || 'Could not save this scene.',
				icon: 'mdi:alert-circle-outline',
				color: 'error'
			});
		}
	} finally {
		saving.value = false;
	}
}

function load() {
	const scene = scenes.value.find((s) => s.id === selectedId.value);
	if (!scene) return;
	emit('load', scene.payload, scene);
	toast.add({
		title: 'Scene Loaded',
		description: `Now previewing "${scene.name}".`,
		icon: 'mdi:tray-arrow-up',
		color: 'info'
	});
}

async function remove() {
	if (!selectedId.value || deleting.value) return;
	deleting.value = true;
	try {
		const res = await deleteScene(selectedId.value);
		if (res.success) {
			toast.add({
				title: 'Scene Deleted',
				icon: 'mdi:trash-can-outline',
				color: 'success'
			});
			selectedId.value = undefined;
			await refresh();
		} else {
			toast.add({
				title: 'Delete Failed',
				description: res.error || 'Could not delete this scene.',
				icon: 'mdi:alert-circle-outline',
				color: 'error'
			});
		}
	} finally {
		deleting.value = false;
	}
}

onMounted(refresh);
</script>
