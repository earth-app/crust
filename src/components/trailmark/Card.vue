<template>
	<div
		class="flex flex-col gap-3 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-default"
	>
		<div class="flex items-start justify-between gap-2">
			<div class="flex items-center gap-2 min-w-0">
				<UIcon
					name="mdi:map-marker-radius-outline"
					class="size-5 text-primary shrink-0"
				/>
				<div class="flex flex-col min-w-0">
					<span class="text-sm font-medium truncate">{{ placeLabel }}</span>
					<span class="text-xs opacity-60">{{ relativeTime }}</span>
				</div>
			</div>
			<div class="flex items-center gap-1 shrink-0">
				<UBadge
					v-if="mark.shared_activity"
					color="primary"
					variant="subtle"
					size="xs"
					icon="mdi:handshake-outline"
					>Also Yours</UBadge
				>
				<UBadge
					v-if="distanceLabel"
					color="neutral"
					variant="soft"
					size="xs"
					>{{ distanceLabel }} Away</UBadge
				>
			</div>
		</div>

		<p
			v-if="activityLabel"
			class="text-xs opacity-70"
		>
			Left while {{ activityLabel }}
		</p>

		<p class="text-sm opacity-90 whitespace-pre-line wrap-break-word">{{ mark.note }}</p>

		<div class="flex items-center justify-between gap-2 pt-1">
			<span class="text-xs opacity-60">by {{ mark.author_username }}</span>

			<div
				v-if="isMine"
				class="flex items-center gap-1 text-xs text-success"
			>
				<UIcon
					name="mdi:hand-heart"
					class="size-3.5"
				/>
				<span v-if="typeof mark.thanks_for_author === 'number'"
					>{{ mark.thanks_for_author }} Quiet Thanks</span
				>
				<span v-else>Your Note</span>
			</div>
			<TrailmarkThankButton
				v-else
				:id="mark.id"
				:thanked="mark.thanked_by_me"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';

const props = defineProps<{
	mark: Trailmark;
	distanceMeters?: number;
}>();

const { user } = useAuth();

const isMine = computed(() => !!user.value?.id && user.value.id === props.mark.author_uid);

const placeLabel = computed(() => props.mark.geo.place_label?.trim() || 'A Spot Nearby');

const relativeTime = computed(() => {
	const dt = DateTime.fromISO(props.mark.created_at);
	return dt.isValid ? dt.toRelative() : '';
});

// activity ids are catalog slugs; the label is the id made readable, no extra fetch
const activityLabel = computed(() => {
	const id = props.mark.activity_id?.trim();
	return id ? id.replace(/_/g, ' ') : '';
});

const distanceLabel = computed(() => {
	const d = props.distanceMeters;
	if (typeof d !== 'number' || !Number.isFinite(d)) return '';
	if (d < 1000) return `${d} m`;
	return `${(d / 1000).toFixed(1)} km`;
});
</script>
