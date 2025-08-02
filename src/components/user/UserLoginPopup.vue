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
			Login
		</UButton>

		<template #content>
			<UserLoginForm @login-success="handleLoginSuccess" />
		</template>
	</UPopover>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const isOpen = ref(false);

function handleLoginSuccess() {
	isOpen.value = false; // Close the popup after successful login
}
</script>
