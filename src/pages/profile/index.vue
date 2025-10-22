<template>
	<div
		v-if="user"
		class="flex flex-row items-center justify-between w-full"
	>
		<UserProfileEditor :user="user" />
	</div>
	<div
		v-else
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
