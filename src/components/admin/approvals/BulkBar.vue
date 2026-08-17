<template>
	<div
		role="group"
		data-testid="bulk-bar"
		:data-position="position"
		:aria-label="`Bulk Review Actions (${positionLabel})`"
		class="flex items-center gap-3 flex-wrap"
		:class="
			position === 'floating'
				? 'rounded-full border border-default bg-default/95 px-4 py-2 shadow-lg backdrop-blur'
				: 'rounded-lg border border-default px-3 py-2'
		"
	>
		<UCheckbox
			:model-value="allSelected"
			:indeterminate="someSelected"
			:disabled="pageTotal === 0 || !!busy"
			label="Select Page"
			@update:model-value="emit('toggle-all')"
		/>

		<span class="text-xs text-muted">
			{{ pageSelected }} of {{ pageTotal }} Selected
			<template v-if="offPageSelected > 0">
				&middot; {{ offPageSelected }} on Other Pages
			</template>
		</span>

		<UBadge
			v-if="flagged > 0"
			color="error"
			variant="subtle"
			size="sm"
			icon="mdi:alert"
			data-testid="bulk-flagged"
			>{{ flagged }} Flagged</UBadge
		>

		<div class="flex items-center gap-2 flex-wrap ml-auto">
			<UButton
				size="sm"
				color="success"
				variant="soft"
				icon="mdi:check-all"
				:loading="busy === 'approve'"
				:disabled="totalSelected === 0 || !!busy"
				@click="emit('act', 'approve')"
				>{{ actionLabel('approve') }}</UButton
			>
			<UButton
				size="sm"
				color="error"
				variant="soft"
				icon="mdi:close-box-multiple-outline"
				:loading="busy === 'deny'"
				:disabled="totalSelected === 0 || !!busy"
				@click="emit('act', 'deny')"
				>{{ actionLabel('deny') }}</UButton
			>
			<UButton
				size="sm"
				color="neutral"
				variant="ghost"
				:disabled="totalSelected === 0 || !!busy"
				@click="emit('clear')"
				>Clear</UButton
			>
		</div>
	</div>
</template>

<script setup lang="ts">
const props = defineProps<{
	position: 'top' | 'bottom' | 'floating';
	// selection counts are split because the checkbox is page-scoped while the actions are not
	pageSelected: number;
	pageTotal: number;
	totalSelected: number;
	offPageSelected: number;
	allSelected: boolean;
	someSelected: boolean;
	busy: 'approve' | 'deny' | null;
	progress: number;
	flagged: number;
}>();

const emit = defineEmits<{
	(event: 'toggle-all'): void;
	(event: 'clear'): void;
	(event: 'act', action: 'approve' | 'deny'): void;
}>();

const positionLabel = computed(
	() => ({ top: 'Top', bottom: 'Bottom', floating: 'Floating' })[props.position]
);

// never a bare "Approve"/"Deny"; the per-row buttons own those names
function actionLabel(action: 'approve' | 'deny'): string {
	const verb = action === 'approve' ? 'Approve' : 'Deny';
	if (props.busy === action) return `${verb} ${props.progress}/${props.totalSelected}`;
	return props.totalSelected > 0 ? `${verb} Selected (${props.totalSelected})` : `${verb} Selected`;
}
</script>
