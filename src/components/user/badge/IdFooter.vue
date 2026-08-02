<template>
	<div class="flex flex-col items-center flex-wrap">
		<span class="text-toned light:text-muted">id:{{ badge.id }}</span>
		<span
			v-if="badge.tracker_id"
			class="text-toned light:text-muted"
		>
			tracker:{{ badge.tracker_id }}</span
		>
	</div>
</template>

<script setup lang="ts">
defineProps<{ badge: Badge | UserBadge }>();
</script>
