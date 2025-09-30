<template>
	<UPopover
		v-model="isOpen"
		mode="hover"
		:popper="{ placement: 'bottom-end' }"
	>
		<NuxtLink to="/signup">
			<UButton
				color="neutral"
				variant="link"
				class="text-md md:text-lg lg:text-xl font-semibold hover:text-gray-300 mx-3 lg:mx-6 cursor-pointer"
			>
				Sign&nbsp;Up
			</UButton>
		</NuxtLink>

		<template #content>
			<UserSignupForm @signup-success="handleSignupSuccess" />
		</template>
	</UPopover>
</template>

<script setup lang="ts">
const isOpen = ref(false);

function handleSignupSuccess() {
	isOpen.value = false; // Close the popup after successful sign up
}
</script>
