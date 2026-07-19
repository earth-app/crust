<template>
	<div
		v-if="displayOnly && scene"
		class="flex flex-col items-center gap-4 py-4"
	>
		<div class="pointer-events-none w-full max-w-sm">
			<TrailCard :trail="trail" />
		</div>
		<TrailNatureRing
			:minutes="natureMinutes.minutes"
			:target="natureMinutes.target"
			:best="natureMinutes.best"
		/>
	</div>

	<div
		v-else
		class="flex flex-col gap-4"
	>
		<div>
			<h3 class="text-lg font-semibold">Trail Studio</h3>
			<p class="mt-1 text-sm text-muted">
				Author a mock Curiosity Trail, then preview the real trail card, the full runner flow
				(pledge, presence, reflection, reveal), and the weekly Nature Minutes ring. Nothing here
				starts a trail or credits real minutes.
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
				icon="mdi:backup-restore"
				color="neutral"
				variant="soft"
				size="sm"
				@click="reset"
				>Reset</UButton
			>
		</div>

		<div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
			<div class="flex flex-col gap-3">
				<UFormField label="Title">
					<UInput
						v-model="form.title"
						placeholder="The Ten-Minute Sit"
						class="w-full"
					/>
				</UFormField>

				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<UFormField label="Theme">
						<USelect
							v-model="form.theme"
							:items="themeItems"
							class="w-full"
						/>
					</UFormField>
					<UFormField label="Practice">
						<USelect
							v-model="form.practice"
							:items="practiceItems"
							class="w-full"
						/>
					</UFormField>
					<UFormField label="Rarity">
						<USelect
							v-model="form.rarity"
							:items="rarityItems"
							class="w-full"
						/>
					</UFormField>
					<UFormField label="Icon">
						<UInput
							v-model="form.icon"
							placeholder="mdi:meditation"
							class="w-full"
						/>
					</UFormField>
				</div>

				<UFormField :label="`Suggested Minutes: ${form.duration}`">
					<USlider
						v-model="form.duration"
						:min="5"
						:max="60"
					/>
				</UFormField>

				<UFormField label="Description">
					<UTextarea
						v-model="form.description"
						:rows="2"
						placeholder="Find one spot outside and let the place come to you."
						class="w-full"
					/>
				</UFormField>

				<UFormField label="Curiosity Gap">
					<UTextarea
						v-model="form.curiosity"
						:rows="2"
						placeholder="What arrives when you stop moving and simply wait?"
						class="w-full"
					/>
				</UFormField>

				<UFormField label="Reflection Prompt">
					<UInput
						v-model="form.reflectionPrompt"
						placeholder="What did the stillness let you notice?"
						class="w-full"
					/>
				</UFormField>

				<UFormField label="Awe Reveal">
					<UTextarea
						v-model="form.reveal"
						:rows="2"
						placeholder="Your senses recalibrate to a place in about eight minutes of stillness."
						class="w-full"
					/>
				</UFormField>

				<div class="flex flex-wrap gap-4">
					<USwitch
						v-model="form.premium"
						label="Premium (Perk)"
					/>
					<USwitch
						v-model="form.seasonal"
						label="Seasonal"
					/>
				</div>

				<div class="flex flex-col gap-3 rounded-lg border border-default p-3">
					<span class="text-xs font-semibold tracking-wide text-muted uppercase"
						>Nature Minutes Ring</span
					>
					<UFormField :label="`This Week: ${form.natureMinutes} min`">
						<USlider
							v-model="form.natureMinutes"
							:min="0"
							:max="300"
							:step="5"
						/>
					</UFormField>
					<UFormField :label="`Weekly Target: ${form.natureTarget} min`">
						<USlider
							v-model="form.natureTarget"
							:min="30"
							:max="240"
							:step="10"
						/>
					</UFormField>
					<UFormField :label="`Personal Best: ${form.natureBest} min`">
						<USlider
							v-model="form.natureBest"
							:min="0"
							:max="300"
							:step="5"
						/>
					</UFormField>
				</div>

				<AdminMarketingPeopleSceneBar
					kind="trail"
					:payload="form"
					:source="source"
					@load="onSceneLoad"
				/>
			</div>

			<div class="flex flex-col gap-4">
				<div class="flex items-center justify-between">
					<span class="text-sm font-semibold text-muted">Live Preview</span>
					<UButton
						icon="mdi:presentation"
						color="neutral"
						variant="soft"
						size="sm"
						@click="present = true"
						>Present Card</UButton
					>
				</div>

				<TrailCard
					:trail="trail"
					@preview="previewRef?.openWalkthrough()"
					@select="previewRef?.openFullFlow()"
				/>

				<div class="flex justify-center rounded-2xl border border-default bg-elevated/30 p-4">
					<TrailNatureRing
						:minutes="natureMinutes.minutes"
						:target="natureMinutes.target"
						:best="natureMinutes.best"
					/>
				</div>

				<AdminMarketingTrailPreview
					ref="previewRef"
					:trail="trail"
					:nature-minutes="natureMinutes"
				/>
			</div>
		</div>

		<AdminMarketingPeoplePresent
			v-model="present"
			label="Mock Trail"
		>
			<div class="pointer-events-none flex flex-col items-center gap-5">
				<div class="w-full max-w-sm">
					<TrailCard :trail="trail" />
				</div>
				<TrailNatureRing
					:minutes="natureMinutes.minutes"
					:target="natureMinutes.target"
					:best="natureMinutes.best"
				/>
			</div>
		</AdminMarketingPeoplePresent>
	</div>
</template>

<script setup lang="ts">
import { useTrailsStore } from 'stores/trails';

// MarketingStudioProps + TrailForm and the marketing helpers are auto-imported (shared/*);
// keeping them unimported holds the defineProps macro off the ~/shared alias the build can't follow
const props = defineProps<MarketingStudioProps<TrailForm>>();

const store = useTrailsStore();
const toast = useToast();

const presets = TRAIL_STUDIO_PRESETS;
const form = reactive<TrailForm>(TRAIL_STUDIO_PRESETS[0]!.build());
const source = ref<MarketingSource>('manual');
const present = ref(false);
const previewRef = ref<{ openWalkthrough: () => void; openFullFlow: () => void } | null>(null);

const trail = computed(() => trailFormToTrail(form));
const natureMinutes = computed(() => mockNatureMinutesFromForm(form));

const themeItems = TRAIL_THEMES.map((t) => ({ label: TRAIL_THEME_LABELS[t], value: t }));
const practiceItems = TRAIL_PRACTICES.map((p) => ({ label: trailPracticeMeta(p).label, value: p }));
const rarityItems = TRAIL_RARITY_ORDER.map((r) => ({ label: TRAIL_RARITY_LABELS[r], value: r }));

function applyForm(next: Partial<TrailForm>) {
	Object.assign(form, emptyTrailForm(), next);
}

function applyPreset(preset: TrailStudioPreset) {
	applyForm(preset.build());
	source.value = 'manual';
}

function randomize() {
	applyForm(randomTrailForm());
	source.value = 'ai';
	toast.add({
		title: 'Trail Randomized',
		description: `Now previewing "${form.title}".`,
		icon: 'mdi:dice-5-outline',
		color: 'success'
	});
}

function reset() {
	applyForm(emptyTrailForm());
	source.value = 'manual';
}

function onSceneLoad(payload: unknown, scene: MarketingScene) {
	applyForm(payload as TrailForm);
	source.value = scene.source ?? 'manual';
}

// keep the store seeded so TrailCard / TrailRunner resolve the mock trail
watch(trail, (t) => store.upsertTrail(t), { immediate: true });

watch(
	() => props.scene,
	(scene) => {
		if (scene?.payload) {
			applyForm(scene.payload as TrailForm);
			source.value = scene.source ?? 'manual';
		}
	},
	{ immediate: true }
);
</script>
