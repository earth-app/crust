<template>
	<UModal
		v-model:open="isOpen"
		class="min-w-full min-h-full"
		:dismissible="!stepOpen"
		:modal="true"
		fullscreen
	>
		<template #header>
			<div class="flex items-center w-full gap-3">
				<UIcon
					:name="trail.icon || 'mdi:map-marker-path'"
					class="size-11 text-primary shrink-0"
				/>
				<div class="flex flex-col min-w-0">
					<div class="flex items-center gap-2 flex-wrap">
						<h1 class="font-semibold text-lg truncate">{{ trail.title }}</h1>
						<UBadge
							color="primary"
							variant="soft"
							size="sm"
							>{{ themeLabel }}</UBadge
						>
						<UBadge
							v-if="trail.seasonal"
							color="warning"
							variant="soft"
							size="sm"
							icon="mdi:calendar-star"
							>Seasonal</UBadge
						>
					</div>
					<span class="text-sm opacity-90 line-clamp-2">{{ trail.description }}</span>
				</div>

				<TrailNatureRing
					v-if="natureMinutes"
					:minutes="natureMinutes.minutes"
					:target="natureMinutes.target"
					:best="natureMinutes.best"
					:size="56"
					compact
					class="ml-auto hidden sm:flex"
				/>

				<UButton
					variant="outline"
					color="error"
					icon="mdi:exit-to-app"
					class="ml-auto sm:ml-2 shrink-0"
					aria-label="Close Trail"
					@click="isOpen = false"
				/>
			</div>
		</template>

		<template #body>
			<div
				class="h-full w-full overscroll-contain"
				:class="stepOpen ? 'overflow-hidden' : 'overflow-y-auto'"
			>
				<Loading v-if="!asQuest" />

				<template v-else>
					<TrailPledge
						v-if="!hasPledge"
						:trail-title="trail.title"
						@accept="onAccept"
					/>

					<template v-else>
						<div
							class="flex items-start gap-2 p-3 mb-2 rounded-lg border border-primary/25 bg-primary/5"
						>
							<UIcon
								name="mdi:hand-heart"
								class="size-5 text-primary shrink-0 mt-0.5"
							/>
							<p class="text-sm opacity-90 wrap-break-word">
								Your Pledge: when {{ pledgeText }}, you set out on this trail.
							</p>
						</div>

						<UAlert
							v-if="!isTrailActive && !allRevealed"
							color="info"
							variant="subtle"
							icon="mdi:information-outline"
							title="Begin Your Run"
							description="Press Start below to begin the trail. Each step opens with a curious clue and ends with a reveal."
							class="mb-2"
						/>

						<LazyUserQuestTimeline
							:quest="asQuest"
							:progress="mergedProgress"
							@select-step="onSelectStep"
						/>
					</template>
				</template>
			</div>
		</template>
	</UModal>

	<UModal
		v-model:open="stepOpen"
		:modal="true"
		scrollable
		class="md:min-w-160 lg:min-w-200"
		@close="resetStep"
	>
		<template #header="{ close }">
			<div class="flex items-center justify-between w-full px-1">
				<div class="flex items-center gap-2">
					<UIcon
						v-if="openStep?.icon"
						:name="openStep.icon"
						class="size-5 text-primary"
					/>
					<span class="text-sm ml-2 font-medium truncate max-w-160">{{ phaseLabel }}</span>
				</div>
				<button
					class="w-8 h-8 rounded-full border border-neutral-700 bg-neutral-900/60 flex items-center justify-center text-neutral-400 hover:text-white hover:border-neutral-500 transition-all active:scale-95 shrink-0"
					aria-label="Close"
					@click="close"
				>
					<UIcon
						name="i-lucide-x"
						class="size-4"
					/>
				</button>
			</div>
		</template>
		<template #body>
			<TrailClue
				v-if="phase === 'clue' && activeTrailStep"
				:clue="activeTrailStep.clue"
				:index="activeIndex + 1"
				:total="trail.steps.length"
				@continue="phase = 'act'"
			/>

			<LazyUserQuestStepSubmission
				v-else-if="phase === 'act' && openStep"
				:quest="asQuest"
				:progress="mergedProgress"
				:step="openStep"
				@submitted="onStepSubmitted"
			/>

			<TrailReveal
				v-else-if="phase === 'reveal' && activeTrailStep"
				:reveal="activeTrailStep.reveal"
				:minutes="stepMinutes"
				:last="isLastStep"
				@next="onRevealNext"
			/>

			<Loading v-else />
		</template>
	</UModal>

	<UiSparkleBurst
		:trigger="finaleBurst"
		:count="48"
		color="success"
	/>
</template>

<script setup lang="ts">
const props = defineProps<{
	trail: Trail;
	open: boolean;
	progress?: (QuestProgressEntry | QuestProgressEntry[])[];
}>();

const emit = defineEmits<{
	'update:open': [value: boolean];
	complete: [];
}>();

const store = useTrailsStore();
// seed the store so the run/asQuest are available without an extra fetch
store.upsertTrail(props.trail);

const { asQuest, run, accept, completeStep, complete } = useTrail(props.trail.id);
const { user } = useAuth();
const userId = computed(() => user.value?.id);
const { quest: activeQuest } = useUser(userId);
const { natureMinutes, fetchNatureMinutes } = useTrails();
const toast = useToast();

const stepMinutes = TRAIL_STEP_MINUTES;

const isOpen = computed({
	get: () => props.open,
	set: (v) => emit('update:open', v)
});

const themeLabel = computed(
	() =>
		({ nature: 'Nature', curiosity: 'Curiosity', creative: 'Creative', mixed: 'Mixed' })[
			props.trail.theme
		] ?? 'Mixed'
);

const hasPledge = computed(() => !!run.value?.pledge);
const pledgeText = computed(() => {
	const p = run.value?.pledge;
	if (!p) return '';
	return p.where ? `${p.when} at ${p.where}` : p.when;
});

// the underlying quest is live when its id matches this trail (trail run = quest run)
const isTrailActive = computed(() => activeQuest.value?.questId === props.trail.id);
const allRevealed = computed(() => !!run.value?.stepRevealed.every(Boolean));

// stable synthetic progress: real backend progress wins; otherwise mirror the
// trail run's revealed steps so the reused timeline advances as reveals unlock
const mergedProgress = computed<(QuestProgressEntry | QuestProgressEntry[])[] | undefined>(() => {
	const steps = props.trail.steps;
	const revealed = run.value?.stepRevealed ?? [];
	const base = run.value ? Date.parse(run.value.startedAt) || Date.now() : Date.now();
	const any = props.progress || revealed.some(Boolean);
	if (!any) return props.progress;

	return steps.map((s, i) => {
		const passed = props.progress?.[i];
		if (passed) return passed;
		if (revealed[i]) {
			return { type: s.step.type, index: i, submittedAt: base + i } as QuestProgressEntry;
		}
		return undefined as unknown as QuestProgressEntry;
	});
});

const stepOpen = ref(false);
const phase = ref<'clue' | 'act' | 'reveal'>('clue');
const activeIndex = ref(0);
const openStep = ref<
	| (QuestStep & {
			icon: string;
			completed: boolean;
			index: number;
			altIndex?: number;
			isCurrentQuest: boolean;
			isUnlocked: boolean;
			data?: string;
	  })
	| null
>(null);
const finaleBurst = ref(0);

const activeTrailStep = computed<TrailStep | null>(
	() => props.trail.steps[activeIndex.value] ?? null
);
const isLastStep = computed(() => activeIndex.value === props.trail.steps.length - 1);

const phaseLabel = computed(() => {
	if (phase.value === 'clue') return 'The Clue';
	if (phase.value === 'reveal') return 'The Reveal';
	return openStep.value?.description ?? 'The Step';
});

function onAccept(pledge: { when: string; where?: string }) {
	const res = accept(pledge);
	if (!res.success) {
		toast.add({ title: 'Pledge Incomplete', description: res.error, color: 'warning' });
		return;
	}
	toast.add({
		title: 'Pledge Set',
		description: 'Your trail is now a promise to yourself.',
		icon: 'mdi:hand-heart',
		color: 'success',
		duration: 3000
	});
}

function onSelectStep(step: NonNullable<typeof openStep.value>) {
	if (!step) return;
	activeIndex.value = step.index;
	openStep.value = step;
	phase.value = 'clue';
	stepOpen.value = true;
}

async function onStepSubmitted() {
	phase.value = 'reveal';
	const res = await completeStep(activeIndex.value);
	if (!res.success) {
		// reveal still shows; nature-minutes credit is best-effort (store bumps optimistically)
		toast.add({
			title: 'Saved Your Step',
			description: 'We could not sync Nature Minutes just now.',
			color: 'warning',
			duration: 3000
		});
	}
}

function onRevealNext() {
	stepOpen.value = false;
	phase.value = 'clue';
	openStep.value = null;

	if (allRevealed.value) {
		complete();
		finaleBurst.value++;
		emit('complete');
		toast.add({
			title: 'Trail Complete!',
			description: 'You followed your curiosity all the way through.',
			icon: 'mdi:flag-checkered',
			color: 'success',
			duration: 4000
		});
	}
}

function resetStep() {
	openStep.value = null;
	phase.value = 'clue';
}

watch(
	() => props.open,
	(open) => {
		if (!open) {
			stepOpen.value = false;
			resetStep();
			return;
		}
		store.upsertTrail(props.trail);
		if (userId.value) void fetchNatureMinutes();
	},
	{ immediate: true }
);
</script>
