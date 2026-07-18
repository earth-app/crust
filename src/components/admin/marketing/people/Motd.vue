<template>
	<div
		v-if="displayOnly"
		class="w-full"
	>
		<UBanner
			v-if="normalized.motd"
			:icon="normalized.icon || 'mdi:earth'"
			:title="normalized.motd"
			:color="normalized.type"
			:actions="bannerActions"
			:ui="{ root: 'flex items-center', title: 'font-semibold' }"
		/>
	</div>

	<div
		v-else
		class="grid grid-cols-1 gap-4 lg:grid-cols-2"
	>
		<div class="flex flex-col gap-3">
			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				<UFormField
					label="Message"
					class="sm:col-span-2"
				>
					<UInput
						v-model="form.motd"
						placeholder="Welcome to The Earth App..."
						class="w-full"
					/>
				</UFormField>
				<UFormField label="Icon">
					<UInput
						v-model="form.icon"
						:icon="form.icon || 'mdi:earth'"
						placeholder="mdi:sprout"
					/>
				</UFormField>
				<UFormField label="Type">
					<USelect
						v-model="form.type"
						:items="typeItems"
						class="w-full"
					/>
				</UFormField>
				<UFormField
					label="Link"
					class="sm:col-span-2"
					help="Optional. Adds a Learn More action to the banner."
				>
					<UInput
						v-model="form.link"
						placeholder="https://..."
					/>
				</UFormField>
			</div>

			<div class="flex flex-wrap gap-2">
				<UButton
					icon="mdi:playlist-star"
					color="primary"
					variant="soft"
					@click="loadPreset"
					>Load Preset</UButton
				>
				<UButton
					icon="mdi:presentation"
					color="neutral"
					variant="ghost"
					@click="present = true"
					>Present</UButton
				>
			</div>

			<AdminMarketingPeopleSceneBar
				kind="motd"
				:payload="form"
				:source="source"
				@load="onSceneLoad"
			/>
		</div>

		<div class="flex flex-col gap-3">
			<div class="text-sm font-semibold text-muted">Live Preview</div>
			<UBanner
				v-if="normalized.motd"
				:icon="normalized.icon || 'mdi:earth'"
				:title="normalized.motd"
				:color="normalized.type"
				:actions="bannerActions"
				:ui="{ root: 'flex items-center', title: 'font-semibold' }"
			/>
			<p
				v-else
				class="text-sm text-muted"
			>
				Enter a message to preview the banner.
			</p>
		</div>

		<AdminMarketingPeoplePresent
			v-model="present"
			label="Mock MOTD"
		>
			<UBanner
				v-if="normalized.motd"
				:icon="normalized.icon || 'mdi:earth'"
				:title="normalized.motd"
				:color="normalized.type"
				:actions="bannerActions"
				:ui="{ root: 'flex items-center', title: 'font-semibold' }"
			/>
		</AdminMarketingPeoplePresent>
	</div>
</template>

<script setup lang="ts">
import type { MockMotdForm } from '~/shared/utils/marketingPeople';
import { emptyMotdForm, MOTD_PRESETS, normalizeMotdForm } from '~/shared/utils/marketingPeople';
import type { MarketingScene, MarketingSource } from '../../../../shared/types/marketing';

const props = defineProps<{
	scene?: MarketingScene | null;
	displayOnly?: boolean;
}>();

const toast = useToast();

const form = reactive<MockMotdForm>(emptyMotdForm());
const source = ref<MarketingSource>('manual');
const present = ref(false);
const lastPreset = ref(-1);

const typeItems = [
	{ label: 'Info', value: 'info', icon: 'mdi:information' },
	{ label: 'Success', value: 'success', icon: 'mdi:check-circle' },
	{ label: 'Warning', value: 'warning', icon: 'mdi:alert' },
	{ label: 'Error', value: 'error', icon: 'mdi:close-circle' }
];

const normalized = computed(() => normalizeMotdForm(form));

// mirrors NavBar's banner action; onClick is inert so a recording never navigates
const bannerActions = computed(() =>
	normalized.value.link
		? [
				{
					label: 'Learn More',
					color: 'neutral' as const,
					variant: 'outline' as const,
					trailingIcon: 'mdi:arrow-right',
					size: 'sm' as const,
					onClick: () => {},
					ui: { base: 'hover:cursor-pointer' }
				}
			]
		: []
);

function applyForm(next: MockMotdForm) {
	Object.assign(form, emptyMotdForm(), next);
}

function loadPreset() {
	const count = MOTD_PRESETS.length;
	let idx = Math.floor(Math.random() * count);
	if (idx === lastPreset.value) idx = (idx + 1) % count;
	lastPreset.value = idx;
	applyForm(MOTD_PRESETS[idx]!);
	source.value = 'ai';
	toast.add({
		title: 'Preset Loaded',
		icon: 'mdi:playlist-check',
		color: 'success'
	});
}

function onSceneLoad(payload: unknown, scene: MarketingScene) {
	applyForm(payload as MockMotdForm);
	source.value = scene.source ?? 'manual';
}

watch(
	() => props.scene,
	(scene) => {
		if (scene?.payload) {
			applyForm(scene.payload as MockMotdForm);
			source.value = scene.source ?? 'manual';
		}
	},
	{ immediate: true }
);
</script>
