<template>
	<UPopover
		v-model:open="isOpen"
		mode="click"
		:popper="{ placement: 'bottom-end' }"
	>
		<UButton
			color="neutral"
			variant="link"
			class="text-md md:text-lg lg:text-xl font-semibold hover:text-gray-300 mx-2 lg:mx-6 cursor-pointer"
		>
			Sign&nbsp;Up
		</UButton>

		<template #content>
			<UserSignupForm @signup-success="handleSignupSuccess" />
		</template>
	</UPopover>
</template>

<script setup lang="ts">
const isOpen = ref(false);
const router = useRouter();
const toast = useToast();

function handleSignupSuccess(_: User, hasEmail: boolean) {
	isOpen.value = false; // Close the popup after successful signup

	// Redirect to home page or verify email after successful login
	if (hasEmail) {
		router.push('/verify-email');
		toast.add({
			title: 'Verification Email Sent',
			description: 'Please check your email to verify your account.',
			icon: 'mdi:email',
			color: 'info',
			duration: 5000
		});
	} else {
		router.push('/');
	}
}
</script>
