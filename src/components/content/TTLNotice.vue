<template>
	<UAlert
		v-if="variant === 'banner'"
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
		v-else
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
const props = withDefaults(
	defineProps<{
		kind: ContentKind;
		variant?: 'banner' | 'inline' | 'badge';
		color?: 'warning' | 'info' | 'primary' | 'secondary';
	}>(),
	{ variant: 'inline', color: 'warning' }
);

const icon = computed(() => CONTENT_TTL_ICON[props.kind]);
const headline = computed(() => ttlHeadline(props.kind));
const hook = computed(() => ttlHook(props.kind));
const label = computed(() => `Auto-deleted in ${ttlLabel(props.kind)}`);
</script>
