<template>
	<UCard
		variant="soft"
		class="relative w-full max-w-2xl mx-4 overflow-hidden bg-linear-to-br from-primary/10 via-secondary/5 to-transparent"
	>
		<UiSparkleBurst
			:trigger="celebrate"
			color="primary"
		/>

		<div class="flex items-center gap-2 mb-1">
			<UIcon
				name="mdi:account-multiple-plus"
				class="size-6 text-primary"
			/>
			<h3 class="text-lg font-semibold">Invite Friends</h3>
		</div>
		<p class="text-sm text-muted mb-4">
			Share your link! When a friend joins, you both move up the Recruiter ranks.
		</p>

		<div class="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center mb-4">
			<UInput
				:model-value="inviteUrl"
				readonly
				icon="mdi:link-variant"
				class="flex-1 font-mono text-sm"
				:ui="{ base: 'truncate' }"
				@focus="selectAll"
			/>
			<div class="flex gap-2">
				<UButton
					icon="mdi:content-copy"
					color="success"
					variant="soft"
					:disabled="!inviteUrl"
					@click="onCopy"
				>
					Copy Link
				</UButton>
				<UButton
					icon="mdi:share-variant"
					color="secondary"
					variant="soft"
					:disabled="!inviteUrl"
					@click="onShare"
				>
					Share
				</UButton>
			</div>
		</div>

		<div class="grid grid-cols-2 gap-3 mb-4">
			<div class="flex flex-col items-center p-3 rounded-lg bg-elevated/50">
				<span class="text-2xl font-bold text-primary">
					<CountUp :value="clicks" />
				</span>
				<span class="text-xs text-muted">Link Clicks</span>
			</div>
			<div class="flex flex-col items-center p-3 rounded-lg bg-elevated/50">
				<span class="text-2xl font-bold text-success">
					<CountUp :value="conversions" />
				</span>
				<span class="text-xs text-muted">Friends Joined</span>
			</div>
		</div>

		<div class="flex flex-col gap-1">
			<div class="flex items-center justify-between text-sm">
				<span class="font-medium">{{ tierLabel }}</span>
				<span class="text-muted">
					<template v-if="nextTier">{{ conversions }} / {{ nextTier }}</template>
					<template v-else>Max tier reached</template>
				</span>
			</div>
			<UProgress
				:model-value="tierProgress"
				color="primary"
				size="sm"
			/>
			<p
				v-if="nextTier"
				class="text-xs text-muted"
			>
				{{ nextTier - conversions }} more to reach the next Recruiter tier.
			</p>
		</div>
	</UCard>
</template>

<script setup lang="ts">
// recruiter tiers — friends-joined thresholds
const TIERS = [1, 5, 25] as const;

const { inviteUrl, stats, fetchCode, fetchStats, copyLink, webShare } = useReferral();
const toast = useToast();

const clicks = computed(() => stats.value?.clicks ?? 0);
const conversions = computed(() => stats.value?.conversions ?? 0);

const nextTier = computed<number | null>(() => TIERS.find((t) => conversions.value < t) ?? null);

const tierLabel = computed(() => {
	const reached = TIERS.filter((t) => conversions.value >= t).length;
	if (reached === 0) return 'Newcomer';
	if (reached === 1) return 'Recruiter';
	if (reached === 2) return 'Connector';
	return 'Ambassador';
});

const tierProgress = computed(() => {
	if (!nextTier.value) return 100;
	const prev = TIERS.filter((t) => t < nextTier.value!).pop() ?? 0;
	const span = nextTier.value - prev;
	if (span <= 0) return 100;
	return Math.min(100, Math.round(((conversions.value - prev) / span) * 100));
});

// celebrate when a new conversion lands while the card is mounted
const celebrate = ref(0);
watch(conversions, (next, prev) => {
	if (next > prev) celebrate.value++;
});

function selectAll(event: FocusEvent) {
	(event.target as HTMLInputElement | null)?.select();
}

async function onCopy() {
	const ok = await copyLink();
	celebrate.value++;
	toast.add({
		title: ok ? 'Link Copied' : 'Copy Failed',
		description: ok
			? 'Your invite link is on the clipboard - paste it anywhere.'
			: 'Could not access the clipboard. Try selecting and copying manually.',
		icon: ok ? 'mdi:check-circle' : 'mdi:alert-circle',
		color: ok ? 'success' : 'error',
		duration: 3000
	});
}

async function onShare() {
	const state = await webShare();
	celebrate.value++;

	if (state === 'shared') {
		toast.add({
			title: 'Share Successful',
			description: 'Your invite link has been shared.',
			icon: 'mdi:check-circle',
			color: 'success',
			duration: 3000
		});
	} else if (state === 'copied') {
		toast.add({
			title: 'Share Unavailable',
			description:
				'Your invite link is on the clipboard instead of being shared. Paste it anywhere.',
			icon: 'mdi:check',
			color: 'warning',
			duration: 3000
		});
	} else {
		toast.add({
			title: 'Share Unavailable',
			description: 'We could not open the share sheet. Try the Copy Link button instead.',
			icon: 'mdi:alert-circle',
			color: 'warning',
			duration: 3000
		});
	}
}

onMounted(async () => {
	await fetchCode();
	await fetchStats();
});

onMounted(async () => {
	await fetchCode();
	await fetchStats();
});
</script>
