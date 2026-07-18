<template>
	<div class="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
		<header class="flex flex-col gap-1">
			<div class="flex items-center gap-2">
				<UIcon
					name="mdi:account-group-outline"
					class="text-2xl text-primary"
				/>
				<h1 class="text-2xl font-bold">Your Circle</h1>
			</div>
			<p class="text-sm text-muted">
				Your close circle, one shared outdoor goal. Cheer each other on and watch your garden grow.
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
			<p class="text-sm text-muted">Sign in to see your circle's expedition and garden.</p>
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
					<UBadge
						v-if="garden && garden.animated"
						icon="mdi:sparkles"
						color="primary"
						variant="subtle"
						>Living Garden</UBadge
					>
				</div>
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
			</section>

			<section>
				<CircleExpedition
					:expedition="expedition"
					:current-uid="currentUid"
					:can-start="true"
					@started="onStarted"
				/>
			</section>
		</template>
	</div>
</template>

<script setup lang="ts">
// self-contained circle page composition; all user-specific fetching is client-side
// (onMounted) so the route stays SSR-safe, and the canvas sits behind ClientOnly
const { user, fetchUser } = useAuth();
const circles = useCircles();
const store = useCirclesStore();

const currentUid = computed(() => user.value?.id ?? '');
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

onMounted(load);
</script>
