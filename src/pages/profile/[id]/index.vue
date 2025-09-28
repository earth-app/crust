<template>
	<div
		v-if="currentUser"
		class="flex flex-row items-center justify-between w-full"
	>
		<UserProfile :user="currentUser" />
	</div>
	<div
		v-else
		class="flex flex-col items-center justify-center h-screen"
	>
		<p class="text-gray-600">User doesn't exist. Maybe look at the URL again?</p>
	</div>
</template>

<script setup lang="ts">
import { useTitleSuffix } from '~/compostables/useTitleSuffix';
import { useUser } from '~/compostables/useUser';

const { setTitleSuffix } = useTitleSuffix();
const route = useRoute();
const { user: currentUser } = useUser(route.params.id as string);
watch(
	() => currentUser.value,
	(user) => {
		setTitleSuffix(user ? user.username : 'Profile');
	}
);
</script>
