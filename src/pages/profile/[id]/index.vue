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
import { getUser } from '~/compostables/useUser';
import type { User } from '~/shared/types/user';

const { setTitleSuffix } = useTitleSuffix();
const route = useRoute();
const currentUser = ref<User | null>(null);

if (route.params.id) {
	const res = await getUser(route.params.id as string);

	if (res.success && res.data) {
		currentUser.value = res.data;
		setTitleSuffix(currentUser.value?.username || 'User Profile');
	} else {
		currentUser.value = null;
		setTitleSuffix('User Profile');
		console.error('Failed to fetch user:', res.message);
	}
}
</script>
