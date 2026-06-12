<template>
	<div
		v-if="challenge"
		id="quest-challenge-banner"
		class="my-3"
	>
		<UAlert
			v-if="status === 'pending' && role === 'recipient'"
			color="warning"
			variant="subtle"
			icon="mdi:sword-cross"
			:title="`${challengerHandle} challenged you to this quest`"
			description="Accept to start a co-op run — you'll both work through it side by side."
		>
			<template #actions>
				<UButton
					color="success"
					icon="mdi:check"
					:loading="acting"
					:disabled="acting"
					@click="onAccept"
					>Accept</UButton
				>
				<UButton
					color="neutral"
					variant="soft"
					icon="mdi:close"
					:loading="acting"
					:disabled="acting"
					@click="onDecline"
					>Decline</UButton
				>
			</template>
		</UAlert>

		<!-- challenger waiting for the recipient -->
		<UAlert
			v-else-if="status === 'pending' && role === 'challenger'"
			color="neutral"
			variant="subtle"
			icon="mdi:timer-sand"
			:title="`Waiting for ${recipientHandle} to accept your challenge`"
			description="We'll start the shared timeline as soon as they're in."
		/>

		<!-- shared-progress card for an accepted (or finished) challenge -->
		<div
			v-else-if="status === 'active' || status === 'completed'"
			class="rounded-lg border border-default bg-elevated/50 p-4"
		>
			<div class="flex items-center gap-2 mb-3">
				<UIcon
					name="mdi:handshake-outline"
					class="size-5 text-primary"
				/>
				<span class="font-semibold text-sm">You're in this together</span>
				<UBadge
					v-if="otherCompleted"
					color="warning"
					variant="subtle"
					size="xs"
					icon="mdi:flag-checkered"
					class="ml-auto"
					>{{ otherHandle }} finished</UBadge
				>
			</div>

			<div class="flex flex-col gap-3">
				<div class="flex flex-col gap-1">
					<div class="flex items-center justify-between text-sm">
						<span class="font-medium">You</span>
						<span class="opacity-80">{{ yourSteps }}/{{ total }}</span>
					</div>
					<UProgress
						:model-value="yourSteps"
						:max="total || 1"
						color="primary"
						size="sm"
					/>
				</div>

				<div class="flex flex-col gap-1">
					<div class="flex items-center justify-between text-sm">
						<span class="font-medium">{{ otherHandle }}</span>
						<span class="opacity-80">{{ otherSteps }}/{{ otherTotal }}</span>
					</div>
					<UProgress
						:model-value="otherSteps"
						:max="otherTotal || 1"
						color="secondary"
						size="sm"
					/>
				</div>
			</div>

			<p
				v-if="otherCompleted"
				class="text-xs text-warning mt-3"
			>
				They finished — catch up!
			</p>
		</div>
	</div>
</template>

<script setup lang="ts">
const props = defineProps<{
	questId: string;
	yourCompletedSteps?: number;
	totalSteps?: number;
}>();

const questIdRef = computed(() => props.questId);
const { challenge, otherUser, otherProgress, role, status, fetch, accept, decline } =
	useQuestChallenge(questIdRef);

const toast = useToast();
const acting = ref(false);

const { handle: challengerHandle } = useDisplayName(
	() => (challenge.value ? { username: challenge.value.challenger_name } : null),
	{ anonymous: 'a friend' }
);
const { handle: recipientHandle } = useDisplayName(
	() => (challenge.value ? { username: challenge.value.recipient_name } : null),
	{ anonymous: 'a friend' }
);
const { handle: otherHandle } = useDisplayName(() => otherUser.value, { anonymous: 'your friend' });

const yourSteps = computed(() => props.yourCompletedSteps ?? 0);
const total = computed(() => props.totalSteps ?? otherProgress.value?.total_steps ?? 0);
const otherSteps = computed(() => otherProgress.value?.current_step ?? 0);
const otherTotal = computed(() => otherProgress.value?.total_steps ?? total.value);
const otherCompleted = computed(() => otherProgress.value?.completed === true);

async function onAccept() {
	if (acting.value) return;
	acting.value = true;
	try {
		const res = await accept();
		if (valid(res)) {
			toast.add({
				title: 'Challenge Accepted',
				description: "You're in — race you to the finish.",
				icon: 'mdi:sword-cross',
				color: 'success',
				duration: 4000
			});
		} else {
			toast.add({
				title: 'Could Not Accept',
				description: res.message || 'Please try again.',
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 4000
			});
		}
	} finally {
		acting.value = false;
	}
}

async function onDecline() {
	if (acting.value) return;
	acting.value = true;
	try {
		const res = await decline();
		if (valid(res)) {
			toast.add({
				title: 'Challenge Declined',
				icon: 'mdi:close-circle',
				color: 'neutral',
				duration: 3000
			});
		} else {
			toast.add({
				title: 'Could Not Decline',
				description: res.message || 'Please try again.',
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 4000
			});
		}
	} finally {
		acting.value = false;
	}
}

onMounted(() => {
	void fetch();
});
</script>
