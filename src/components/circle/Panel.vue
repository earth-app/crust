<template>
	<div class="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
		<header
			id="shared-garden"
			class="flex flex-col gap-1"
		>
			<div class="flex items-center justify-between gap-2">
				<div class="flex items-center gap-2">
					<UIcon
						name="mdi:flower-tulip-outline"
						class="text-2xl text-primary"
					/>
					<h1 class="text-2xl font-bold">My Shared Garden</h1>
				</div>
				<UButton
					v-if="currentUid"
					icon="mdi:progress-question"
					color="secondary"
					variant="subtle"
					aria-label="Replay Shared Garden Tour"
					@click="startTour('shared-garden')"
				/>
			</div>
			<p class="text-sm text-muted">
				A garden you grow together with your circle of friends. Share one outdoor goal, cheer each
				other on, and watch it come to life.
			</p>
		</header>

		<div
			v-if="!currentUid"
			class="flex flex-col items-center gap-3 rounded-2xl border border-default bg-elevated/30 p-8 text-center"
		>
			<UIcon
				name="mdi:login-variant"
				class="text-3xl text-muted"
			/>
			<p class="text-sm text-muted">Sign in to see your shared garden and expedition.</p>
			<UButton
				to="/login"
				icon="mdi:login"
				color="primary"
				>Sign In</UButton
			>
		</div>

		<template v-else>
			<section class="flex flex-col gap-3">
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-semibold tracking-wide text-muted uppercase">Shared Garden</h2>
					<UTooltip
						v-if="garden"
						:text="garden.animated ? livingHelp : restingHelp"
						:ui="{ text: 'whitespace-normal max-w-xs' }"
					>
						<UBadge
							:icon="garden.animated ? 'mdi:sparkles' : 'mdi:sprout-outline'"
							:color="garden.animated ? 'primary' : 'neutral'"
							variant="subtle"
							class="cursor-help"
							>{{ garden.animated ? 'Living Garden' : 'Resting Garden' }}</UBadge
						>
					</UTooltip>
				</div>
				<div id="garden-canvas">
					<ClientOnly>
						<CircleGarden
							v-if="garden"
							:garden="garden"
							:height="300"
							caption="Grown Together"
						/>
						<div
							v-else-if="gardenLoaded"
							class="flex h-75 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-default bg-elevated/30 text-center"
						>
							<UIcon
								name="mdi:sprout-outline"
								class="text-3xl text-muted"
							/>
							<p class="text-sm text-muted">
								Your garden starts growing on your first outdoor minutes.
							</p>
						</div>
						<template #fallback>
							<div class="h-75 rounded-2xl border border-default bg-elevated/30" />
						</template>
					</ClientOnly>
				</div>
			</section>

			<section id="circle-members">
				<CircleMembers />
			</section>

			<section id="circle-expedition">
				<CircleExpedition
					:expedition="expedition"
					:current-uid="currentUid"
					:can-start="true"
					@started="onStarted"
				/>
			</section>

			<ClientOnly>
				<SiteTour
					:steps="gardenTour"
					tour-id="shared-garden"
					name="Shared Garden Tour"
					:pulse="true"
				/>
			</ClientOnly>
		</template>
	</div>
</template>

<script setup lang="ts">
const { user, fetchUser } = useAuth();
const circles = useCircles();
const store = useCirclesStore();
const { startTour, startTourIfNew } = useSiteTour();

const currentUid = computed(() => user.value?.id ?? '');

// #region tour
const gardenTour = computed<SiteTourStep[]>(() => [
	{
		id: 'shared-garden',
		title: 'Your Shared Garden',
		description:
			'This garden is grown together by your whole circle. It flourishes from the outdoor time you all share - more trails and minutes outside mean more trees, flowers, and life. A quiet garden is just a gentle nudge to get outside together.',
		footer: 'You tend it as a group, never alone and never in competition.',
		icon: 'mdi:flower-tulip-outline',
		waitFor: 'shared-garden'
	},
	{
		id: 'garden-canvas',
		title: 'A Living Scene',
		description:
			"This is the garden itself, painted from your circle's combined Nature Minutes. Tap around to interact with it and watch it come alive as your circle keeps getting outdoors.",
		footer: 'It turns "Living" once your circle is actively growing it.',
		icon: 'mdi:sprout-outline',
		waitFor: 'garden-canvas',
		placement: 'top'
	},
	{
		id: 'circle-members',
		title: 'Who Grows It With You',
		description:
			"These are the friends in your circle tending the garden alongside you. Everyone's time outside feeds the same shared scene.",
		footer: 'Invite a friend or two to grow it faster - together.',
		icon: 'mdi:account-group-outline'
	},
	{
		id: 'circle-expedition',
		title: 'A Shared Goal',
		description:
			"An expedition is one outdoor goal your whole circle works toward together. Everyone's minutes add to the same total - this is your circle versus the challenge, never member against member.",
		footer: 'There is no scoreboard and no ranking here.',
		icon: 'mdi:tent'
	},
	{
		id: 'circle-kudos',
		title: 'Counter-Free Encouragement',
		description:
			'Send a teammate a little cheer for their time outside. Kudos are pure encouragement - there is no tally, no leaderboard, and nothing to win by sending more.',
		footer: 'Kindness here is quiet by design.',
		icon: 'mdi:hand-heart-outline'
	}
]);
// #endregion

// tooltip copy explaining how the shared garden is cared for + what "Living" means
const livingHelp =
	'Living Garden: it animates because your circle keeps getting outside. It grows with your combined Nature Minutes - run trails, contribute to your expedition, and spend time outdoors together. A quiet garden is a gentle nudge to take a walk.';
const restingHelp =
	"Resting Garden: it grows with your circle's combined Nature Minutes - more time outside means more trees, flowers, and life. Animations (the Living variant) turn on for active, growing circles.";

const expedition = computed(() => (store.expedition === undefined ? null : store.expedition));
const garden = computed(
	() => (currentUid.value ? store.getGarden(currentUid.value) : null) ?? null
);
const gardenLoaded = ref(false);

async function load() {
	if (!user.value) await fetchUser();
	if (!user.value) return;
	await Promise.all([
		circles.fetchExpedition(),
		circles.fetchGarden(user.value.id).finally(() => (gardenLoaded.value = true))
	]);
}

function onStarted() {
	circles.fetchExpedition(true);
}

onMounted(async () => {
	await load();
	// gate the auto-tour on a signed-in user; anon has no garden anchors to target
	if (currentUid.value) startTourIfNew('shared-garden');
});
</script>
