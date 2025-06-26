<template>
	<div
		v-if="user"
		class="flex flex-row items-center justify-between"
	>
		<div class="flex flex-col items-center w-1/2 mt-6">
			<h1 class="text-4xl font-bold mb-2">Profile</h1>
			<p class="text-gray-600">Welcome to your profile page, {{ user.username }}!</p>
		</div>
		<div class="flex flex-col items-center w-1/2"></div>
	</div>
	<div
		v-else
		class="flex flex-col items-center justify-center h-screen"
	>
		<p class="text-gray-600">Please log in to view your profile.</p>
	</div>
</template>

<script setup lang="ts">
import { useAuth } from '~/compostables/useCurrentUser';
import { useTitleSuffix } from '~/compostables/useTitleSuffix';

const { user } = useAuth();

const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Profile');
</script>
