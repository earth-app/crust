<template>
	<UAlert
		v-if="variant === 'countdown' && countdown"
		:icon="icon"
		:title="`Expires in ${countdown.label}`"
		:description="countdownDescription"
		:color="countdownColor"
		variant="subtle"
		:ui="{ root: 'mb-3' }"
	/>
	<UAlert
		v-else-if="variant === 'banner'"
		:icon="icon"
		:title="headline"
		:description="hook"
		:color="color"
		variant="subtle"
		:ui="{ root: 'mb-3' }"
	/>
	<UBadge
		v-else-if="variant === 'badge'"
		:color="color"
		variant="subtle"
		:icon="icon"
		size="sm"
	>
		{{ label }}
	</UBadge>
	<div
		v-else-if="variant === 'inline'"
		class="flex items-start gap-2 text-xs text-muted"
	>
		<UIcon
			:name="icon"
			class="size-3.5 mt-0.5 shrink-0 text-warning"
		/>
		<span>
			<span class="font-medium">{{ headline }}.</span>
			{{ hook }}
		</span>
	</div>
</template>

<script setup lang="ts">
import { describeRemainingTtl } from 'utils';

const props = withDefaults(
	defineProps<{
		kind: ContentKind;
		variant?: 'banner' | 'inline' | 'badge' | 'countdown';
		color?: 'warning' | 'info' | 'primary' | 'secondary';
		// timestamp (seconds since epoch) when this specific content expires. Only
		// used by the countdown variant - the static variants ignore it.
		expiresAt?: number;
	}>(),
	{ variant: 'inline', color: 'warning' }
);

const icon = computed(() => CONTENT_TTL_ICON[props.kind]);
const headline = computed(() => ttlHeadline(props.kind));
const hook = computed(() => ttlHook(props.kind));
const label = computed(() => `Auto-deleted in ${ttlLabel(props.kind)}`);

// countdown variant - recompute once a minute so the "X hours" label stays fresh
// without spamming reactivity
const now = ref(Date.now());
let tick: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
	if (props.variant !== 'countdown') return;
	tick = setInterval(() => {
		now.value = Date.now();
	}, 60_000);
});
onBeforeUnmount(() => {
	if (tick) clearInterval(tick);
});

const countdown = computed(() =>
	props.expiresAt ? describeRemainingTtl(props.expiresAt, now.value) : null
);

const countdownColor = computed<'info' | 'warning' | 'error'>(() => {
	if (!countdown.value) return 'info';
	if (countdown.value.urgency === 'low') return 'info';
	if (countdown.value.urgency === 'medium') return 'warning';
	return 'error';
});

const countdownDescription = computed(() => {
	if (!countdown.value) return '';
	if (props.kind === 'event') {
		return countdown.value.urgency === 'high'
			? 'This event will be removed soon. Save anything you want to keep.'
			: 'When this expires, the event listing will be removed automatically.';
	}
	if (props.kind === 'article') {
		return countdown.value.urgency === 'high'
			? 'This article is about to expire. Save it or share it now.'
			: 'Articles stay live for 14 days from creation - then they auto-delete.';
	}
	return countdown.value.urgency === 'high'
		? 'This prompt is closing soon. Reply before it vanishes.'
		: 'Prompts and their replies expire 2 days after creation.';
});
</script>
