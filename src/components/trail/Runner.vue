<template>
	<UModal
		v-model:open="isOpen"
		class="min-w-full min-h-full"
		:dismissible="dismissible"
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
							v-if="isPreview"
							color="neutral"
							variant="subtle"
							size="sm"
							icon="mdi:eye-outline"
							>Preview</UBadge
						>
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
			<div class="h-full w-full overflow-y-auto overscroll-contain">
				<Loading v-if="!trail" />

				<!-- read-only walkthrough; no pledge, no writes -->
				<div
					v-else-if="isPreview"
					class="flex flex-col gap-4 max-w-xl mx-auto py-6 px-4"
				>
					<div class="flex items-start gap-2 p-3 rounded-lg border border-primary/25 bg-primary/5">
						<UIcon
							name="mdi:eye-outline"
							class="size-5 text-primary shrink-0 mt-0.5"
						/>
						<p class="text-sm opacity-90 wrap-break-word">
							You're previewing this trail. Begin it to make your pledge and head out.
						</p>
					</div>

					<section class="flex flex-col gap-1">
						<span class="text-xs uppercase tracking-widest opacity-60">The Invitation</span>
						<p class="text-base opacity-90 whitespace-pre-line">{{ trail.curiosity }}</p>
					</section>

					<section class="flex items-center gap-3 text-sm opacity-80">
						<span class="flex items-center gap-1">
							<UIcon
								:name="practiceMeta.icon"
								class="size-4"
							/>
							{{ practiceMeta.label }}
						</span>
						<span class="flex items-center gap-1">
							<UIcon
								name="mdi:timer-sand"
								class="size-4"
							/>
							~{{ targetMinutes }} min
						</span>
					</section>

					<section class="flex flex-col gap-1">
						<span class="text-xs uppercase tracking-widest opacity-60">You'll Reflect On</span>
						<p class="text-sm opacity-80">{{ trail.reflectionPrompt }}</p>
					</section>

					<UButton
						color="primary"
						icon="mdi:map-marker-path"
						block
						@click="onBegin"
						>Begin This Trail</UButton
					>
				</div>

				<template v-else>
					<TrailClue
						v-if="phase === 'intro'"
						:curiosity="trail.curiosity"
						:practice="trail.practice"
						:target-minutes="targetMinutes"
						@continue="phase = 'pledge'"
					/>

					<TrailPledge
						v-else-if="phase === 'pledge'"
						:trail-title="trail.title"
						@accept="onAccept"
					/>

					<TrailPresence
						v-else-if="phase === 'presence'"
						:practice="trail.practice"
						:target-minutes="targetMinutes"
						@finish="onPresenceFinish"
					/>

					<TrailReflect
						v-else-if="phase === 'reflect'"
						:reflection-prompt="trail.reflectionPrompt"
						:practice="trail.practice"
						:photo-count="photoCount"
						@save="onReflectSave"
					/>

					<TrailReveal
						v-else-if="phase === 'reveal'"
						:reveal="trail.reveal"
						:minutes="loggedMinutes"
						:personal-best="personalBest"
						@finish="isOpen = false"
					/>

					<Loading v-else />
				</template>
			</div>
		</template>
	</UModal>

	<UiSparkleBurst
		:trigger="finaleBurst"
		:count="48"
		color="success"
	/>
</template>

<script setup lang="ts">
const props = withDefaults(
	defineProps<{
		trail: Trail;
		open: boolean;
		// read-only walkthrough: no pledge gate, no completion writes
		preview?: boolean;
	}>(),
	{ preview: false }
);

const emit = defineEmits<{
	'update:open': [value: boolean];
	complete: [];
	// user chose to start the real run from the preview
	begin: [];
}>();

const isPreview = computed(() => props.preview);

const store = useTrailsStore();
// seed the store so the run is available without an extra fetch
store.upsertTrail(props.trail);

const { start, addPresence, complete } = useTrail(props.trail.id);
const { user } = useAuth();
const userId = computed(() => user.value?.id);
const { natureMinutes, fetchNatureMinutes } = useTrails();
const toast = useToast();

type Phase = 'intro' | 'pledge' | 'presence' | 'reflect' | 'reveal';
const phase = ref<Phase>('intro');
const loggedMinutes = ref(0);
const photoCount = ref(0);
const personalBest = ref(false);
const bestBefore = ref(0);
const finaleBurst = ref(0);

const isOpen = computed({
	get: () => props.open,
	set: (v) => emit('update:open', v)
});

// stay dismissible only when nothing is mid-practice, so a stray tap can't drop the run
const dismissible = computed(
	() => isPreview.value || phase.value === 'intro' || phase.value === 'reveal'
);

const practiceMeta = computed(() => trailPracticeMeta(props.trail.practice));
const targetMinutes = computed(() => trailTargetMinutes(props.trail));

const themeLabel = computed(
	() =>
		({
			nature: 'Nature',
			curiosity: 'Curiosity',
			creative: 'Creative',
			reflective: 'Reflective',
			mixed: 'Mixed'
		})[props.trail.theme] ?? 'Mixed'
);

async function onAccept(pledge: { when: string; where?: string }) {
	bestBefore.value = natureMinutes.value?.best ?? 0;
	const res = await start(pledge);
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
	phase.value = 'presence';
}

function onPresenceFinish(payload: { minutes: number; photoCount: number }) {
	loggedMinutes.value = payload.minutes;
	photoCount.value = payload.photoCount;
	addPresence(payload.minutes);
	phase.value = 'reflect';
}

async function onReflectSave(reflection: TrailReflection) {
	const res = await complete(reflection, loggedMinutes.value);
	if (!res.success) {
		toast.add({
			title: 'Saved Your Reflection',
			description: 'We could not sync Nature Minutes just now.',
			color: 'warning',
			duration: 3000
		});
	}
	// a new weekly high once this credit lands (personal-best, never a rank)
	personalBest.value =
		(natureMinutes.value?.minutes ?? 0) > bestBefore.value && bestBefore.value > 0;
	finaleBurst.value++;
	emit('complete');
	phase.value = 'reveal';
}

// convert a preview into the real run; the parent flips preview off so the flow begins
function onBegin() {
	emit('begin');
	phase.value = 'intro';
}

watch(
	() => props.open,
	(open) => {
		if (!open) {
			phase.value = 'intro';
			loggedMinutes.value = 0;
			photoCount.value = 0;
			personalBest.value = false;
			return;
		}
		store.upsertTrail(props.trail);
		if (userId.value) void fetchNatureMinutes();
	},
	{ immediate: true }
);
</script>
