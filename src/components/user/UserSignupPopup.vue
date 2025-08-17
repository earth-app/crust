<template>
	<UPopover
		v-model="isOpen"
		trigger="click"
		:popper="{ placement: 'bottom-end' }"
	>
		<UButton
			color="neutral"
			variant="link"
			class="text-xl font-semibold hover:text-gray-300 mx-6 cursor-pointer"
		>
			Sign Up
		</UButton>

		<template #content>
			<UserSignupForm @login-success="handleSignupSuccess" />
		</template>
	</UPopover>
</template>

<script setup lang="ts">
const isOpen = ref(false);
const toast = useToast();

function handleSignupSuccess() {
	isOpen.value = false; // Close the popup after successful login
	toast.add({
		title: 'Signup Successful',
		description: 'You have successfully signed up. Welcome!',
		icon: 'mdi:account-plus',
		color: 'success',
		duration: 3000
	});
}
</script>
