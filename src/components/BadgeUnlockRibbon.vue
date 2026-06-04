<template>
	<ClientOnly>
		<Teleport to="body">
			<Transition
				:name="reducedMotion ? '' : 'badge-ribbon'"
				appear
			>
				<div
					v-if="current"
					role="status"
					aria-live="polite"
					class="fixed top-4 inset-x-0 mx-auto z-9999 max-w-md px-3 pointer-events-none"
				>
					<div
						class="pointer-events-auto relative flex items-center gap-3 p-3 rounded-2xl border border-yellow-400/60 bg-linear-to-r from-yellow-500/95 via-amber-400/95 to-yellow-500/95 text-amber-950 shadow-xl shadow-amber-500/30"
					>
						<UiSparkleBurst
							:trigger="sparkleTrigger"
							color="warning"
							:count="36"
							:duration="900"
						/>

						<div
							class="flex items-center justify-center size-10 shrink-0 rounded-xl bg-white/40 border border-white/60"
						>
							<UIcon
								:name="current.badgeIcon || 'mdi:medal-outline'"
								class="size-6 text-amber-900"
							/>
						</div>

						<div class="flex flex-col min-w-0 flex-1">
							<span class="text-[11px] uppercase font-semibold tracking-wider opacity-80">
								New Badge Unlocked
							</span>
							<span class="font-semibold text-sm truncate">{{ current.badgeName }}</span>
							<span class="text-xs opacity-80 mt-0.5 line-clamp-2">{{ footerCopy }}</span>
						</div>

						<UButton
							v-if="cta"
							:to="cta"
							size="xs"
							color="neutral"
							variant="solid"
							class="shrink-0"
							@click="dismissCurrent"
						>
							View
						</UButton>

						<UButton
							icon="i-heroicons-x-mark"
							color="neutral"
							variant="ghost"
							size="xs"
							aria-label="Dismiss"
							class="shrink-0 text-amber-950 hover:bg-white/30"
							@click="dismissCurrent"
						/>
					</div>
				</div>
			</Transition>
		</Teleport>
	</ClientOnly>
</template>

<script setup lang="ts">
const { queue, dismiss } = useBadgeUnlockListener();
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
const { user } = useAuth();

const current = computed(() => queue.value[0] || null);
const sparkleTrigger = ref(0);

// auto-dismiss bookkeeping
let dismissTimer: ReturnType<typeof setTimeout> | null = null;
let gapTimer: ReturnType<typeof setTimeout> | null = null;
const DWELL_MS = 5000;
const GAP_MS = 1000;

const clearTimers = () => {
	if (dismissTimer) clearTimeout(dismissTimer);
	if (gapTimer) clearTimeout(gapTimer);
	dismissTimer = null;
	gapTimer = null;
};

const dismissCurrent = () => {
	clearTimers();
	dismiss();
};

const cta = computed(() => {
	const uid = user.value?.id;
	if (!uid || !current.value?.badgeId) return null;
	return `/profile/${uid}/badges#${current.value.badgeId}`;
});

// quest-funnel footer copy: prefer the tracker variant when we know more
// progress is possible, otherwise the generic earned-via-quest line
const footerCopy = computed(() => {
	if (!current.value) return '';
	return current.value.trackerId
		? 'Keep going — more badges are waiting in your quests.'
		: 'Earned through your quest progress. Keep going.';
});

// when a ribbon becomes current, fire sparkle (unless reduced-motion) and arm
// auto-dismiss. on dismiss we hold for GAP_MS before showing the next.
watch(
	current,
	(next, prev) => {
		clearTimers();
		if (!next) return;
		if (!reducedMotion.value) sparkleTrigger.value = sparkleTrigger.value + 1;
		// briefly stall the next item so back-to-back ribbons aren't jarring
		if (prev) {
			gapTimer = setTimeout(() => {
				dismissTimer = setTimeout(() => dismiss(), DWELL_MS);
			}, GAP_MS);
		} else {
			dismissTimer = setTimeout(() => dismiss(), DWELL_MS);
		}
	},
	{ immediate: true }
);

onBeforeUnmount(() => clearTimers());
</script>

<style scoped>
.badge-ribbon-enter-active,
.badge-ribbon-leave-active {
	transition:
		transform 400ms cubic-bezier(0.16, 1, 0.3, 1),
		opacity 300ms ease-out;
}
.badge-ribbon-enter-from,
.badge-ribbon-leave-to {
	transform: translateY(-100%);
	opacity: 0;
}
.badge-ribbon-enter-to,
.badge-ribbon-leave-from {
	transform: translateY(0);
	opacity: 1;
}
</style>
