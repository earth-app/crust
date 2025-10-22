<template>
	<ClientOnly>
		<div
			v-if="user && !user.account.email_verified"
			class="flex w-full h-full px-24"
		>
			<UserEmailVerification @verified="onEmailVerified" />
		</div>
		<div v-else-if="user && user.account.email_verified">
			<p class="text-center text-green-600">Your email is already verified.</p>
		</div>
		<div
			v-else
			class="flex flex-col w-full h-full items-center justify-center"
		>
			<p class="text-center text-gray-600">Please log in to verify your email.</p>
		</div>
	</ClientOnly>
</template>

<script setup lang="ts">
const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Verify Email');

const { user } = useAuth();

const router = useRouter();
const toast = useToast();
onMounted(() => {
	if (!user.value) {
		router.push('/login');

		toast.add({
			title: 'Not Logged In',
			description: 'You must be logged in to verify your email.',
			icon: 'mdi:account-alert',
			color: 'error',
			duration: 3000
		});
	} else {
		if (user.value.account.email_verified) {
			router.push('/');

			toast.add({
				title: 'Email Already Verified',
				description: 'Your email is already verified.',
				icon: 'mdi:check-circle-outline',
				color: 'info',
				duration: 3000
			});
		}
	}
});

function onEmailVerified() {
	router.push('/');

	if (user.value) {
		user.value.account.email_verified = true;
	}
}
</script>
