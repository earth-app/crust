<template>
	<div
		v-if="user"
		class="flex flex-row items-center justify-between w-full pt-24 sm:pt-0"
	>
		<UserProfileEditor :user="user" />
	</div>
	<!-- Only show "Please log in" when user is explicitly null (not loading) -->
	<div
		v-else-if="user === null"
		class="flex flex-col items-center justify-center h-screen"
	>
		<p class="text-gray-600">Please log in to view your profile.</p>
	</div>
</template>

<script setup lang="ts">
const { user } = useAuth();

const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Profile');
</script>
