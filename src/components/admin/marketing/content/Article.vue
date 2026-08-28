<template>
	<AdminMarketingContentShell
		kind="article"
		:payload="form"
		:can-generate="true"
		:can-pull="true"
		:display-only="displayOnly"
		present-title="Article Card"
		@load="applyLoad"
	>
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="sm:col-span-2 flex flex-col gap-2">
				<div class="flex flex-wrap items-center gap-2">
					<span class="text-xs text-muted">Lens Presets</span>
					<UButton
						v-for="preset in MARKETING_ARTICLE_PRESETS"
						:key="preset.label"
						size="xs"
						color="primary"
						:variant="activePreset === preset.label ? 'solid' : 'subtle'"
						@click="applyPreset(preset)"
					>
						{{ preset.label }}
					</UButton>
				</div>
				<p
					v-if="activeWhy"
					class="text-xs text-muted"
				>
					{{ activeWhy }}
				</p>
			</div>
			<UFormField
				label="Title"
				class="sm:col-span-2"
			>
				<UInput
					v-model="form.title"
					placeholder="How Kelp Forests Fight Climate Change"
					class="w-full"
				/>
			</UFormField>
			<UFormField
				label="Description"
				class="sm:col-span-2"
			>
				<UTextarea
					v-model="form.description"
					placeholder="A one-line summary shown on the card."
					:rows="2"
					class="w-full"
				/>
			</UFormField>
			<UFormField
				label="Content"
				class="sm:col-span-2"
			>
				<UTextarea
					v-model="form.content"
					placeholder="The body preview shown under the summary."
					:rows="4"
					class="w-full"
				/>
			</UFormField>
			<UFormField label="Tags (Comma-Separated)">
				<UInput
					v-model="form.tags"
					placeholder="Oceans, Climate"
					class="w-full"
				/>
			</UFormField>
			<UFormField label="Accent Color">
				<div class="flex items-center gap-2">
					<UInput
						v-model="form.colorHex"
						type="color"
						class="w-16"
					/>
					<UInput
						v-model="form.colorHex"
						placeholder="#4ade80"
						class="w-full"
					/>
				</div>
			</UFormField>
			<UFormField label="Author Username">
				<UInput
					v-model="form.authorUsername"
					placeholder="earthling"
					class="w-full"
				/>
			</UFormField>
			<UFormField label="Author Account Type">
				<USelect
					v-model="form.authorAccountType"
					:items="accountTypeItems"
					class="w-full"
				/>
			</UFormField>
			<UFormField label="Favicon URL">
				<UInput
					v-model="form.favicon"
					placeholder="https://example.com/favicon.ico"
					class="w-full"
				/>
			</UFormField>
		</div>

		<template #preview>
			<ArticleCard
				:article="mock"
				no-link
			/>
		</template>
	</AdminMarketingContentShell>
</template>

<script setup lang="ts">
import type { MarketingScene } from '~/shared/types/marketing';
import {
	articleFormFromPayload,
	emptyArticleForm,
	MARKETING_ACCOUNT_TYPES,
	MARKETING_ARTICLE_PRESETS,
	type MarketingArticlePreset,
	mockArticle
} from '~/shared/utils/marketing';

const props = defineProps<{
	scene?: MarketingScene | null;
	displayOnly?: boolean;
}>();

const form = reactive(emptyArticleForm());
const mock = computed(() => mockArticle(form));

const accountTypeItems = MARKETING_ACCOUNT_TYPES.map((value) => ({
	label: toTitleCase(value),
	value
}));

const activePreset = ref<string | null>(null);
const activeWhy = computed(
	() => MARKETING_ARTICLE_PRESETS.find((p) => p.label === activePreset.value)?.why ?? ''
);

function applyPreset(preset: MarketingArticlePreset) {
	Object.assign(form, preset.form);
	activePreset.value = preset.label;
}

function applyLoad({ payload, mode }: { payload: unknown; mode: 'raw' | 'scene' }) {
	const next =
		mode === 'scene'
			? { ...emptyArticleForm(), ...(payload as object) }
			: articleFormFromPayload(payload);
	Object.assign(form, next);
	// a pull or a generate replaces the preset, so the "why" note stops describing the wrong card
	activePreset.value = null;
}

if (props.scene) applyLoad({ payload: props.scene.payload, mode: 'scene' });
</script>
