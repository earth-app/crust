<template>
	<div class="flex flex-col gap-4">
		<div
			v-if="!present"
			class="flex flex-col gap-3 rounded-lg border border-default bg-elevated/40 p-4"
		>
			<div class="flex items-center justify-between gap-2">
				<div class="flex items-center gap-2">
					<UIcon
						name="mdi:movie-open-play"
						class="size-5 text-primary"
					/>
					<span class="text-sm font-semibold">Live Preview</span>
				</div>
				<UBadge
					color="warning"
					variant="subtle"
					icon="mdi:shield-lock-outline"
					size="sm"
					>Preview Only</UBadge
				>
			</div>

			<div
				v-if="!canPreview"
				class="text-sm text-muted"
			>
				Add a title and at least one step to preview the quest.
			</div>

			<template v-else>
				<div class="flex flex-col gap-2">
					<span class="text-xs font-semibold text-muted uppercase tracking-wide">Quest State</span>
					<div class="flex flex-wrap gap-2">
						<UButton
							v-for="option in stateOptions"
							:key="option.value"
							:color="previewState === option.value ? 'primary' : 'neutral'"
							:variant="previewState === option.value ? 'solid' : 'soft'"
							:icon="option.icon"
							size="sm"
							@click="previewState = option.value"
							>{{ option.label }}</UButton
						>
					</div>
				</div>

				<div class="flex flex-wrap items-center gap-4">
					<USwitch
						v-model="showChallenge"
						label="Co-op Challenge Banner"
					/>
					<USelect
						v-if="showChallenge"
						v-model="challengeStatus"
						:items="challengeStatusItems"
						size="sm"
						class="min-w-40"
					/>
				</div>

				<div class="flex flex-wrap gap-2">
					<UButton
						icon="mdi:play-circle-outline"
						color="primary"
						@click="openPreview"
						>Open Quest Modal</UButton
					>
					<UButton
						icon="mdi:trophy-outline"
						color="success"
						variant="soft"
						@click="openOverlay"
						>Preview Completion Overlay</UButton
					>
					<UButton
						icon="mdi:restore"
						color="neutral"
						variant="soft"
						:disabled="!open"
						@click="reseed"
						>Reset Interaction</UButton
					>
					<UButton
						icon="mdi:presentation"
						color="neutral"
						variant="ghost"
						@click="enterPresent"
						>Present</UButton
					>
				</div>

				<p class="text-xs text-muted">
					Interactions are simulated locally. Starting, ending, or submitting a step in this preview
					never reaches the server or changes your real quest.
				</p>

				<div
					v-if="showChallenge && canPreview"
					class="mt-1 rounded-lg border border-dashed border-default p-3"
				>
					<span class="text-xs font-semibold text-muted">Challenge Banner Preview</span>
					<UserQuestChallengeBanner
						:key="`challenge-${quest!.id}-${challengeStatus}`"
						:quest-id="quest!.id"
						:your-completed-steps="1"
						:total-steps="quest!.steps.length"
					/>
				</div>
			</template>
		</div>

		<div
			v-if="present"
			class="fixed right-4 top-4 z-[100000] flex items-center gap-2"
		>
			<UButton
				icon="mdi:close"
				color="neutral"
				variant="solid"
				size="sm"
				@click="exitPresent"
				>Exit Present</UButton
			>
		</div>

		<UserQuestModal
			v-if="canPreview"
			v-model:open="open"
			:quest="quest!"
			:progress="modalProgress"
			:completed-at="modalCompletedAt"
		/>

		<UserQuestCompletionOverlay
			v-model:open="overlayOpen"
			:quest-title="quest?.title"
			:points="quest?.reward ?? 0"
		>
			<template #actions="{ close }">
				<UButton
					color="primary"
					icon="mdi:check"
					@click="close"
					>Continue</UButton
				>
			</template>
		</UserQuestCompletionOverlay>
	</div>
</template>

<script setup lang="ts">
import { useUserStore } from 'stores/user';
import type { Ref } from 'vue';

// Quest / QuestChallengeView / QuestProgressEntry / QuestStateSnapshot and the marketingQuest
// helpers are auto-imported (shared/*); the ambient Quest keeps the defineProps macro resolver
// off the ~/shared alias, matching the pattern user/quest/Modal.vue already relies on
type PreviewState = 'not_started' | 'in_progress' | 'completed';

const props = defineProps<{
	quest: Quest | null;
	autoPresent?: boolean;
}>();

const store = useUserStore();
const { user } = useAuth();
const uid = computed(() => user.value?.id);
// the store's reactive quest maps satisfy the pure helpers' QuestStateMaps shape
const maps = { quest: store.quest, questHistory: store.questHistory };

const open = ref(false);
const present = ref(false);
const overlayOpen = ref(false);
const previewState = ref<PreviewState>('in_progress');
const showChallenge = ref(false);
const challengeStatus = ref<'active' | 'pending'>('active');

const canPreview = computed(() => {
	const q = props.quest;
	return !!q && q.steps.length > 0 && q.title.trim().length > 0;
});

const stateOptions: { label: string; value: PreviewState; icon: string }[] = [
	{ label: 'Not Started', value: 'not_started', icon: 'mdi:flag-outline' },
	{ label: 'In Progress', value: 'in_progress', icon: 'mdi:progress-clock' },
	{ label: 'Completed', value: 'completed', icon: 'mdi:flag-checkered' }
];

const challengeStatusItems = [
	{ label: 'Accepted (Shared Progress)', value: 'active' },
	{ label: 'Pending (Accept or Decline)', value: 'pending' }
];

const completedTimestamp = ref(Date.now());
const completedProgress = ref<(QuestProgressEntry | QuestProgressEntry[])[] | undefined>();

// in_progress and not_started read live store state (the write-lock stubs mutate it as the
// admin clicks Start / submit); completed reads the seeded completed replay
const modalProgress = computed(() => {
	if (previewState.value === 'completed') return completedProgress.value;
	return store.quest.get(uid.value ?? '')?.progress ?? [];
});
const modalCompletedAt = computed(() =>
	previewState.value === 'completed' ? completedTimestamp.value : undefined
);

let snapshot: QuestStateSnapshot | null = null;
let restoreWriteLock: (() => void) | null = null;
const active = ref(false);

function applyState(state: PreviewState) {
	const q = props.quest;
	const id = uid.value;
	if (!q || !id) return;

	if (state === 'not_started') {
		clearActiveQuest(maps, id);
		completedProgress.value = undefined;
	} else if (state === 'in_progress') {
		const done =
			q.steps.length <= 1 ? 0 : Math.min(Math.floor(q.steps.length / 2), q.steps.length - 1);
		seedActiveQuest(maps, id, partialQuestProgress(q, done));
		completedProgress.value = undefined;
	} else {
		clearActiveQuest(maps, id);
		completedTimestamp.value = Date.now();
		const entry = toHistoryEntry(q, completedTimestamp.value);
		seedCompletedHistory(maps, id, entry);
		completedProgress.value = entry.progress;
	}
}

// reset to the admin's real baseline, then apply the selected preview state on top
function reseed() {
	if (!active.value || !snapshot || !uid.value) return;
	restoreQuestState(maps, uid.value, snapshot);
	applyState(previewState.value);
}

function activate() {
	if (active.value || !uid.value || !props.quest) return;
	snapshot = snapshotQuestState(maps, uid.value);
	// swap the three write actions for local-only stubs so no submit / start / end ever
	// reaches the network, regardless of what the real modal/timeline do internally
	restoreWriteLock = installQuestWriteLock(store, {
		startQuest: async () => {
			if (props.quest && uid.value)
				seedActiveQuest(maps, uid.value, freshQuestProgress(props.quest));
			return { message: 'Quest started (preview)' };
		},
		endQuest: async () => {
			if (uid.value) clearActiveQuest(maps, uid.value);
			return { message: 'Quest ended (preview)' };
		},
		updateQuest: async (
			_id: string,
			stepResponse: { type: string; index: number; altIndex?: number }
		) => {
			const id = uid.value;
			if (!id) return { message: '', completed: false, validated: false };
			const cur = store.quest.get(id);
			if (!cur) return { message: 'No preview quest active', completed: false, validated: false };
			const { next, result } = applyPreviewSubmit(cur, stepResponse);
			store.quest.set(id, next);
			return result;
		}
	});
	active.value = true;
	applyState(previewState.value);
	applyChallenge();
}

function deactivate() {
	if (!active.value) return;
	teardownChallenge();
	restoreWriteLock?.();
	restoreWriteLock = null;
	if (snapshot && uid.value) restoreQuestState(maps, uid.value, snapshot);
	snapshot = null;
	active.value = false;
}

function openPreview() {
	if (!canPreview.value) return;
	activate();
	open.value = true;
}

function openOverlay() {
	overlayOpen.value = true;
}

function enterPresent() {
	present.value = true;
	openPreview();
}

function exitPresent() {
	present.value = false;
	open.value = false;
}

// challenge banner seeding - the real banner self-fetches on mount and nulls the state for
// a preview quest id, so re-seed once if that happens while the toggle is on
let challengeRef: Ref<QuestChallengeView | null> | null = null;
let stopChallengeWatch: (() => void) | null = null;

function teardownChallenge() {
	stopChallengeWatch?.();
	stopChallengeWatch = null;
	if (challengeRef) challengeRef.value = null;
	challengeRef = null;
}

function applyChallenge() {
	const q = props.quest;
	const id = uid.value;
	teardownChallenge();
	if (!q || !id || !showChallenge.value) return;

	const state = useState<QuestChallengeView | null>(`quest-challenge-${q.id}`, () => null);
	challengeRef = state;
	state.value = mockChallengeView(q, id, { status: challengeStatus.value });
	stopChallengeWatch = watch(state, (v) => {
		if (!v && showChallenge.value) {
			state.value = mockChallengeView(q, id, { status: challengeStatus.value });
		}
	});
}

watch(previewState, () => reseed());
watch([showChallenge, challengeStatus], () => {
	if (active.value) applyChallenge();
});
watch(
	() => props.quest,
	() => {
		if (active.value) {
			reseed();
			applyChallenge();
		}
	}
);
watch(open, (isOpen) => {
	if (isOpen) activate();
	else deactivate();
});

onMounted(() => {
	if (props.autoPresent) enterPresent();
});

onUnmounted(() => deactivate());

defineExpose({ openPreview, enterPresent });
</script>
