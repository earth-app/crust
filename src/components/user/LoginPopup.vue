<template>
	<UPopover
		v-model:open="isOpen"
		mode="hover"
		:popper="{ placement: 'bottom-end' }"
	>
		<NuxtLink to="/login">
			<UButton
				color="neutral"
				variant="link"
				class="text-md md:text-lg lg:text-xl font-semibold hover:text-gray-300 mx-2 lg:mx-6 cursor-pointer"
			>
				Login
			</UButton>
		</NuxtLink>

		<template #content>
			<UserLoginForm @login-success="handleLoginSuccess" />
		</template>
	</UPopover>
</template>

<script setup lang="ts">
const isOpen = ref(false);
const router = useRouter();

function handleLoginSuccess() {
	isOpen.value = false; // Close the popup after successful login
	router.push('/profile');
}
</script>
