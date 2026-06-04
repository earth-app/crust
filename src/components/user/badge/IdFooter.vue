<template>
	<div class="flex flex-col items-center flex-wrap">
		<span class="text-gray-700 light:text-gray-200">id:{{ badge.id }}</span>
		<span
			v-if="badge.tracker_id"
			class="text-gray-700 light:text-gray-200"
		>
			tracker:{{ badge.tracker_id }}</span
		>
	</div>
</template>

<script setup lang="ts">
defineProps<{ badge: Badge | UserBadge }>();
</script>
