<template>
	<ClientOnly>
		<div
			v-if="currentUser"
			class="flex flex-row items-center justify-between w-full mt-16 sm:mt-0"
		>
			<UserProfile :user="currentUser" />
		</div>
		<div
			v-if="currentUser === undefined"
			class="flex flex-col items-center justify-center h-screen"
		>
			<!-- Loading state -->
			<p class="text-gray-600">Loading profile...</p>
		</div>
		<div
			v-else-if="currentUser === null"
			class="flex flex-col items-center justify-center h-screen"
		>
			<!-- User not found -->
			<p class="text-gray-600">User doesn't exist. Maybe look at the URL again?</p>
		</div>
	</ClientOnly>
</template>

<script setup lang="ts">
const { setTitleSuffix } = useTitleSuffix();
const toast = useToast();
const route = useRoute();
const { user: currentUser } = useUser(route.params.id as string);
watch(
	() => currentUser.value,
	(user) => {
		setTitleSuffix(user ? user.username : 'Profile');

		if (user === null) {
			toast.add({
				title: 'User not found',
				description: `The user "${route.params.id}" does not exist.`,
				icon: 'mdi:account-off',
				color: 'error',
				duration: 10000
			});
		}
	}
);

useSeoMeta({
	ogTitle: currentUser.value ? currentUser.value.username : 'Profile',
	ogDescription: currentUser.value
		? `Check out ${currentUser.value.username}'s profile on The Earth App!`
		: 'Profile'
});
</script>
