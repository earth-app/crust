<template>
	<AdminMarketingContentShell
		kind="activity"
		:payload="form"
		:can-generate="false"
		:can-pull="false"
		:can-save-scenes="false"
		:display-only="displayOnly"
		present-title="InfoCard"
		@load="applyLoad"
	>
		<div class="grid gap-3 sm:grid-cols-2">
			<UFormField label="Group Title (Optional Wrapper)">
				<UInput
					v-model="form.groupTitle"
					placeholder="Leave empty for a bare card"
					class="w-full"
				/>
			</UFormField>
			<UFormField label="Title">
				<UInput
					v-model="form.title"
					placeholder="Card Title"
					class="w-full"
				/>
			</UFormField>
			<UFormField
				label="Description"
				class="sm:col-span-2"
			>
				<UInput
					v-model="form.description"
					placeholder="Secondary line under the title"
					class="w-full"
				/>
			</UFormField>
			<UFormField
				label="Content"
				class="sm:col-span-2"
			>
				<UTextarea
					v-model="form.content"
					placeholder="Body text of the card"
					:rows="3"
					class="w-full"
				/>
			</UFormField>
			<UFormField label="Icon">
				<UInput
					v-model="form.icon"
					placeholder="mdi:leaf"
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
			<UFormField label="Image URL">
				<UInput
					v-model="form.image"
					placeholder="https://example.com/image.jpg"
					class="w-full"
				/>
			</UFormField>
			<UFormField label="YouTube URL or ID">
				<UInput
					v-model="form.youtubeId"
					placeholder="https://youtu.be/dQw4w9WgXcQ"
					class="w-full"
				/>
			</UFormField>
			<UFormField
				label="Badges (Text or Text:Color, Comma-Separated)"
				class="sm:col-span-2"
			>
				<UInput
					v-model="form.badges"
					placeholder="Recycling, Water:info, Solar:warning"
					class="w-full"
				/>
			</UFormField>
			<UFormField
				label="Buttons (Comma-Separated Labels)"
				class="sm:col-span-2"
			>
				<UInput
					v-model="form.buttons"
					placeholder="Learn More, Sign Up"
					class="w-full"
				/>
			</UFormField>
			<UFormField label="Banner Text">
				<UInput
					v-model="form.bannerText"
					placeholder="Leave empty for no banner"
					class="w-full"
				/>
			</UFormField>
			<UFormField label="Banner Color">
				<USelect
					v-model="form.bannerColor"
					:items="bannerColorItems"
					class="w-full"
				/>
			</UFormField>
			<UFormField label="Footer">
				<UInput
					v-model="form.footer"
					placeholder="Small print under the card"
					class="w-full"
				/>
			</UFormField>
		</div>

		<template #preview>
			<div class="w-full">
				<InfoCardGroup
					v-if="form.groupTitle.trim()"
					:title="form.groupTitle"
				>
					<div class="flex w-full justify-center">
						<InfoCard v-bind="infoCardProps" />
					</div>
				</InfoCardGroup>
				<div
					v-else
					class="flex w-full justify-center"
				>
					<InfoCard v-bind="infoCardProps" />
				</div>
			</div>
		</template>
	</AdminMarketingContentShell>
</template>

<script setup lang="ts">
import type { MarketingScene } from '~/shared/types/marketing';
import {
	hexColorToInt,
	MARKETING_DEFAULT_ARTICLE_HEX,
	parseInfoCardBadges,
	parseYoutubeId,
	splitCsv
} from '~/shared/utils/marketing';

const props = defineProps<{
	scene?: MarketingScene | null;
	displayOnly?: boolean;
}>();

interface InfoCardForm {
	groupTitle: string;
	title: string;
	description: string;
	content: string;
	icon: string;
	colorHex: string;
	image: string;
	youtubeId: string;
	badges: string;
	buttons: string;
	bannerText: string;
	bannerColor: string;
	footer: string;
}

function emptyForm(): InfoCardForm {
	return {
		groupTitle: '',
		title: 'Protect the Planet',
		description: '',
		content: 'A composable card that every content surface is built from.',
		icon: 'mdi:leaf',
		colorHex: MARKETING_DEFAULT_ARTICLE_HEX,
		image: '',
		youtubeId: '',
		badges: 'Sustainability:success, Community:info',
		buttons: '',
		bannerText: '',
		bannerColor: 'info',
		footer: ''
	};
}

const bannerColorItems = ['primary', 'info', 'success', 'warning', 'error', 'neutral'].map(
	(value) => ({ label: toTitleCase(value), value })
);

const form = reactive(emptyForm());

const infoCardProps = computed(() => ({
	title: form.title.trim() || 'Sample Card',
	description: form.description.trim() || undefined,
	content: form.content.trim() || undefined,
	icon: form.icon.trim() || undefined,
	image: form.image.trim() || undefined,
	youtubeId: parseYoutubeId(form.youtubeId),
	color: form.colorHex ? hexColorToInt(form.colorHex) : undefined,
	badges: parseInfoCardBadges(form.badges).map((b) => ({
		text: b.text,
		color: b.color as never,
		variant: 'subtle' as const
	})),
	buttons: splitCsv(form.buttons).map((text) => ({ text, onClick: () => {} })),
	banner: form.bannerText.trim()
		? { text: form.bannerText.trim(), color: form.bannerColor as never }
		: undefined,
	footer: form.footer.trim() || undefined
}));

function applyLoad({ payload, mode }: { payload: unknown; mode: 'raw' | 'scene' }) {
	if (mode === 'scene') Object.assign(form, { ...emptyForm(), ...(payload as object) });
}

if (props.scene) applyLoad({ payload: props.scene.payload, mode: 'scene' });
</script>
