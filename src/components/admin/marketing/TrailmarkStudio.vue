<template>
	<div
		v-if="displayOnly && scene"
		class="mx-auto w-full max-w-md py-4"
	>
		<div class="pointer-events-none">
			<TrailmarkCard
				:mark="mark"
				:distance-meters="cardDistance"
			/>
		</div>
	</div>

	<div
		v-else
		class="flex flex-col gap-4"
	>
		<div>
			<h3 class="text-lg font-semibold">Trailmark Studio</h3>
			<p class="mt-1 text-sm text-muted">
				Author a mock Trailmark, then preview the real card, the "from outside" prompt-answer
				variant, and the composer. Posting and thanking are simulated locally; no note ever reaches
				the server or another user.
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
				<UFormField label="Note">
					<UTextarea
						v-model="form.note"
						:rows="3"
						:maxlength="maxNote"
						autoresize
						placeholder="You made it here. Take a breath and look up."
						class="w-full"
					/>
				</UFormField>

				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<UFormField label="Author Username">
						<UInput
							v-model="form.authorUsername"
							placeholder="earthwanderer"
							class="w-full"
						/>
					</UFormField>
					<UFormField label="Place Label">
						<UInput
							v-model="form.placeLabel"
							placeholder="Millennium Park"
							class="w-full"
						/>
					</UFormField>
					<UFormField label="Latitude">
						<UInput
							v-model.number="form.lat"
							type="number"
							step="0.0001"
							class="w-full"
						/>
					</UFormField>
					<UFormField label="Longitude">
						<UInput
							v-model.number="form.lng"
							type="number"
							step="0.0001"
							class="w-full"
						/>
					</UFormField>
				</div>

				<UFormField :label="`Left ${form.minutesAgo} min Ago`">
					<USlider
						v-model="form.minutesAgo"
						:min="0"
						:max="1440"
						:step="5"
					/>
				</UFormField>

				<UFormField
					v-if="!form.isMine"
					:label="`Distance Away: ${form.distanceMeters} m`"
				>
					<USlider
						v-model="form.distanceMeters"
						:min="0"
						:max="2000"
						:step="10"
					/>
				</UFormField>

				<UFormField
					v-else
					:label="`Quiet Thanks: ${form.thanksForAuthor}`"
				>
					<USlider
						v-model="form.thanksForAuthor"
						:min="0"
						:max="200"
						:step="1"
					/>
				</UFormField>

				<div class="flex flex-col gap-3 rounded-lg border border-default p-3">
					<label class="flex items-center justify-between gap-3">
						<span class="flex flex-col">
							<span class="text-sm font-medium">Your Note</span>
							<span class="text-xs text-muted">Show as authored by the current viewer</span>
						</span>
						<USwitch v-model="form.isMine" />
					</label>
					<label
						v-if="!form.isMine"
						class="flex items-center justify-between gap-3"
					>
						<span class="flex flex-col">
							<span class="text-sm font-medium">Already Thanked</span>
							<span class="text-xs text-muted">Render the note as thanked by you</span>
						</span>
						<USwitch v-model="form.thankedByMe" />
					</label>
					<label class="flex items-center justify-between gap-3">
						<span class="flex flex-col">
							<span class="text-sm font-medium">From Outside (Prompt Answer)</span>
							<span class="text-xs text-muted">Link the note to today's prompt</span>
						</span>
						<USwitch v-model="form.fromOutside" />
					</label>
				</div>

				<AdminMarketingPeopleSceneBar
					kind="trailmark"
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

				<TrailmarkCard
					:mark="mark"
					:distance-meters="cardDistance"
				/>

				<TrailmarkComposer
					:key="composerKey"
					:prompt-id="form.fromOutside ? previewPromptId : undefined"
					@created="onComposerCreated"
				/>

				<div
					v-if="postedMarks.length"
					class="flex flex-col gap-2"
				>
					<span class="text-xs font-semibold tracking-wide text-muted uppercase"
						>Posted in Preview</span
					>
					<TrailmarkCard
						v-for="posted in postedMarks"
						:key="posted.id"
						:mark="posted"
					/>
				</div>
			</div>
		</div>

		<AdminMarketingPeoplePresent
			v-model="present"
			label="Mock Trailmark"
		>
			<div class="pointer-events-none">
				<TrailmarkCard
					:mark="mark"
					:distance-meters="cardDistance"
				/>
			</div>
		</AdminMarketingPeoplePresent>
	</div>
</template>

<script setup lang="ts">
import { useTrailmarkStore } from 'stores/trailmark';

// MarketingStudioProps + TrailmarkForm and the marketing helpers are auto-imported
// (shared/*); keeping them unimported holds the defineProps macro off the ~/shared alias
const props = defineProps<MarketingStudioProps<TrailmarkForm>>();

const store = useTrailmarkStore();
const toast = useToast();
const { user } = useAuth();

const presets = TRAILMARK_STUDIO_PRESETS;
const maxNote = PREVIEW_MAX_NOTE;
const previewPromptId = PREVIEW_PROMPT_ID;

const form = reactive<TrailmarkForm>(emptyTrailmarkForm());
const source = ref<MarketingSource>('manual');
const present = ref(false);
// remount the composer when the prompt link flips so it re-reads its variant cleanly
const composerKey = computed(() => (form.fromOutside ? 'prompt' : 'plain'));

const selfUid = computed(() => user.value?.id ?? 'admin-preview');
const selfUsername = computed(() => user.value?.username ?? 'you');

const mark = computed(() => trailmarkFormToTrailmark(form, { selfUid: selfUid.value }));
const cardDistance = computed(() => (form.isMine ? undefined : form.distanceMeters));

// notes "posted" through the write-locked composer (never the authored mock)
const postedMarks = computed(() =>
	store.mine.map((id) => store.get(id)).filter((m): m is Trailmark => !!m && m.id !== mark.value.id)
);

function applyForm(next: Partial<TrailmarkForm>) {
	Object.assign(form, emptyTrailmarkForm(), next);
}

function applyPreset(preset: TrailmarkStudioPreset) {
	applyForm(preset.build());
	source.value = 'manual';
}

function randomize() {
	const pick =
		TRAILMARK_STUDIO_PRESETS[Math.floor(Math.random() * TRAILMARK_STUDIO_PRESETS.length)];
	applyForm(pick!.build());
	form.minutesAgo = Math.floor(Math.random() * 240) + 3;
	form.distanceMeters = Math.floor(Math.random() * 1800) + 40;
	source.value = 'ai';
	toast.add({
		title: 'Trailmark Randomized',
		description: 'Now previewing a fresh mock note.',
		icon: 'mdi:dice-5-outline',
		color: 'success'
	});
}

function reset() {
	applyForm(emptyTrailmarkForm());
	source.value = 'manual';
}

function onSceneLoad(payload: unknown, scene: MarketingScene) {
	applyForm(payload as TrailmarkForm);
	source.value = scene.source ?? 'manual';
}

function onComposerCreated() {
	toast.add({
		title: 'Preview Note Added',
		description: 'The mock note was added locally, not posted.',
		icon: 'mdi:map-marker-check-outline',
		color: 'info'
	});
}

// keep the authored mock in the store so TrailmarkCard / ThankButton resolve it
watch(mark, (m) => store.upsert(m), { immediate: true });

watch(
	() => props.scene,
	(scene) => {
		if (scene?.payload) {
			applyForm(scene.payload as TrailmarkForm);
			source.value = scene.source ?? 'manual';
		}
	},
	{ immediate: true }
);

// #region preview write-lock (Post + Thank never reach mantle2)

let restoreLock: (() => void) | null = null;

onMounted(() => {
	restoreLock = installTrailmarkWriteLock(store, {
		createTrailmark: async (input: TrailmarkCreateInput) => {
			const created = buildPreviewCreatedTrailmark(input, {
				selfUid: selfUid.value,
				selfUsername: selfUsername.value
			});
			store.upsert(created);
			if (!store.mine.includes(created.id)) store.mine = [created.id, ...store.mine];
			return { success: true, data: created };
		},
		thankTrailmark: async (id: string) => {
			const existing = store.get(id);
			if (existing) store.cache.set(id, { ...existing, thanked_by_me: true });
			return { success: true };
		}
	});
});

onUnmounted(() => {
	restoreLock?.();
	restoreLock = null;
});
</script>
