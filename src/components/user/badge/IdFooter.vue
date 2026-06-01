<template>
	<div class="flex items-center">
		<span class="text-gray-700">id:{{ badge.id }}</span>
		<span
			v-if="badge.tracker_id"
			class="text-gray-700"
		>
			&nbsp;| tracker:{{ badge.tracker_id }}</span
		>
	</div>
</template>

<script setup lang="ts">
defineProps<{ badge: Badge | UserBadge }>();
</script>
