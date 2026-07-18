<template>
	<div class="flex flex-col gap-2">
		<Transition
			name="kudos-swap"
			mode="out-in"
		>
			<div
				v-if="sent"
				key="sent"
				class="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm"
			>
				<UIcon
					name="mdi:heart"
					class="text-success"
				/>
				<span class="font-medium">{{ sentLabel }}</span>
				<span class="text-muted">{{ giverNote }}</span>
			</div>

			<div
				v-else
				key="pick"
				class="flex flex-col gap-2"
			>
				<span class="text-xs font-semibold tracking-wide text-muted uppercase">{{ heading }}</span>
				<div class="flex flex-wrap gap-2">
					<UButton
						v-for="p in phrases"
						:key="p.phrase"
						:icon="p.icon"
						color="primary"
						variant="soft"
						size="sm"
						:loading="pending === p.phrase"
						:disabled="pending !== null"
						@click="onSend(p.phrase)"
						>{{ p.label }}</UButton
					>
				</div>
			</div>
		</Transition>
	</div>
</template>

<script setup lang="ts">
// counter-free kudos: a fixed warm phrase set, one tap, a warm private acknowledgment.
// no tally is shown or fetched; sending frames the value to the giver (giverNote)
const props = withDefaults(
	defineProps<{
		toUid: string;
		contextType: KudosContextType;
		contextRef?: string;
		username?: string;
		heading?: string;
	}>(),
	{ contextRef: undefined, username: '', heading: 'Send Kudos' }
);

const { phrases, giverNote, send, hasSent } = useKudos();
const toast = useToast();

const pending = ref<KudosPhrase | null>(null);

const sent = computed(() =>
	hasSent({ toUid: props.toUid, contextType: props.contextType, contextRef: props.contextRef })
);

const who = computed(() => (props.username ? props.username : 'Them'));
const sentLabel = computed(() => `You Cheered ${who.value} On`);

async function onSend(phrase: KudosPhrase) {
	if (pending.value || sent.value) return;
	pending.value = phrase;
	const res = await send({
		toUid: props.toUid,
		contextType: props.contextType,
		contextRef: props.contextRef,
		phrase
	});
	pending.value = null;

	if (res.success) {
		toast.add({
			title: sentLabel.value,
			description: giverNote,
			icon: 'mdi:heart',
			color: 'success',
			duration: 4000
		});
		return;
	}

	toast.add({
		title: 'Could Not Send Kudos',
		description: res.error || 'Please try again.',
		icon: 'mdi:cloud-alert-outline',
		color: 'error',
		duration: 5000
	});
}
</script>

<style scoped>
.kudos-swap-enter-active,
.kudos-swap-leave-active {
	transition:
		opacity 180ms ease,
		transform 180ms ease;
}

.kudos-swap-enter-from,
.kudos-swap-leave-to {
	opacity: 0;
	transform: translateY(4px);
}
</style>
