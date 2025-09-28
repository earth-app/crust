<template>
	<UPopover
		v-model="isOpen"
		trigger="click"
		:popper="{ placement: 'bottom-end' }"
	>
		<UButton
			color="neutral"
			variant="link"
			class="text-md md:text-lg lg:text-xl font-semibold hover:text-gray-300 mx-3 lg:mx-6 cursor-pointer"
		>
			Login
		</UButton>

		<template #content>
			<UserLoginForm @login-success="handleLoginSuccess" />
		</template>
	</UPopover>
</template>

<script setup lang="ts">
const isOpen = ref(false);
const toast = useToast();

function handleLoginSuccess() {
	isOpen.value = false; // Close the popup after successful login
	toast.add({
		title: 'Login Successful',
		description: 'You have successfully logged in.',
		icon: 'mdi:login',
		color: 'success',
		duration: 3000
	});

	useRouter().go(0); // Refresh the page to update user state
}
</script>
