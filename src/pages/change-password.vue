<template>
	<ClientOnly>
		<div
			v-if="user"
			class="flex flex-col w-full h-full justify-center p-8 space-y-4"
		>
			<h2 class="text-lg font-semibold">Change Password</h2>
			<UserPasswordChange />
		</div>
		<div
			v-else-if="user === null"
			class="flex flex-col w-full h-full items-center justify-center"
		>
			<p class="text-center text-gray-600">Please log in to change your password.</p>
		</div>
	</ClientOnly>
</template>

<script setup lang="ts">
const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Change Password');

const router = useRouter();
const toast = useToast();
const { user } = useAuth();

watch(
	() => user.value,
	(currentUser) => {
		if (currentUser === null) {
			router.push('/login');
			toast.add({
				title: 'Not Logged In',
				description: 'You must be logged in to change your password.',
				icon: 'mdi:account-alert',
				color: 'error',
				duration: 3000
			});
		}
	},
	{ immediate: true }
);
</script>
