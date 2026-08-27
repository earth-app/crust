<template>
	<div
		v-if="displayOnly"
		class="mx-auto w-full max-w-2xl py-4"
	>
		<div class="pointer-events-none">
			<UserJourneyHero
				:user="previewUser"
				:preview="previewRows"
			/>
		</div>
	</div>

	<div
		v-else
		class="flex flex-col gap-4"
	>
		<div>
			<h3 class="text-lg font-semibold">Streak &amp; Journey Studio</h3>
			<p class="mt-1 text-sm text-muted">
				Stage the journey hero at any streak, rank, and time-remaining, then export the growth or
				rescue story as numbered frames. Every number here is authored; nothing is fetched.
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
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<UFormField
						v-for="row in rowFields"
						:key="row.key"
						:label="row.label"
					>
						<UInput
							v-model.number="form[row.key]"
							type="number"
							min="0"
							class="w-full"
						/>
					</UFormField>
				</div>

				<UFormField :label="`Hours Left in the Window: ${form.hoursLeft}`">
					<USlider
						v-model="form.hoursLeft"
						:min="0"
						:max="48"
						:step="1"
					/>
				</UFormField>

				<label class="flex items-center justify-between gap-3 rounded-lg border border-default p-3">
					<span class="flex flex-col">
						<span class="text-sm font-medium">Mark a Personal Best</span>
						<span class="text-xs text-muted">Flags the highest row as "Your Longest Yet"</span>
					</span>
					<USwitch v-model="form.markBest" />
				</label>

				<AdminMarketingSequenceBar
					:sequences="sequences"
					:get-target="() => sequenceTarget"
					filename="journey-streak"
					label="Streak stories"
				/>
			</div>

			<div class="flex flex-col gap-4">
				<div class="flex items-center justify-between">
					<span class="text-sm font-semibold text-muted">Live Preview</span>
					<AdminMarketingExportBar
						:get-target="() => sequenceTarget"
						filename="journey-streak"
					/>
				</div>

				<div ref="sequenceTarget">
					<UserJourneyHero
						:user="previewUser"
						:preview="previewRows"
					/>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
defineProps<MarketingStudioProps>();

const { user } = useAuth();

const presets = JOURNEY_STUDIO_PRESETS;
const form = reactive<JourneyStreakForm>(emptyJourneyStreakForm());

const rowFields = [
	{ key: 'article' as const, label: 'Article Streak' },
	{ key: 'articleRank' as const, label: 'Article Rank (0 Hides)' },
	{ key: 'prompt' as const, label: 'Prompt Streak' },
	{ key: 'promptRank' as const, label: 'Prompt Rank (0 Hides)' },
	{ key: 'event' as const, label: 'Event Streak' },
	{ key: 'eventRank' as const, label: 'Event Rank (0 Hides)' }
];

const sequenceTarget = ref<HTMLElement | null>(null);

// the hero only reads `user.id` for its own fetches, which the preview prop switches off
const previewUser = computed(
	() => (user.value ?? { id: 'marketing-preview', username: 'preview' }) as User
);
const previewRows = computed(() => journeyPreviewRows(form));

function applyForm(next: Partial<JourneyStreakForm>) {
	Object.assign(form, emptyJourneyStreakForm(), next);
}

function applyPreset(preset: JourneyStudioPreset) {
	applyForm(preset.build());
}

function reset() {
	applyForm(emptyJourneyStreakForm());
}

const SEQUENCE_KINDS: { name: string; kind: JourneySequenceKind }[] = [
	{ name: 'Streak Builds', kind: 'build' },
	{ name: 'Rescued Before Expiry', kind: 'save' }
];

const sequences = computed(() =>
	SEQUENCE_KINDS.map(({ name, kind }) => ({
		name,
		steps: journeySequenceFrames(kind).map((frame) => ({
			label: frame.label,
			apply: () => applyForm(frame.form)
		}))
	}))
);
</script>
