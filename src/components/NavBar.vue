<template>
	<div
		id="navbar"
		class="bg-gray-800 text-white p-4 flex items-center"
	>
		<div class="flex items-center">
			<a href="/">
				<img
					src="/favicon.png"
					alt="Earth App Logo"
					class="h-16 w-16 inline-block mr-2"
				/>
			</a>
		</div>
		<div class="ml-auto">
			<div
				v-if="hasSessionToken"
				class="text-white"
			>
				Account
			</div>
			<LoginPopup v-else />
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import LoginPopup from './LoginPopup.vue';

const hasSessionToken = ref(false);

const checkSessionToken = () => {
	const cookies = document.cookie.split(';');
	hasSessionToken.value = cookies.some((cookie) => cookie.trim().startsWith('session_token='));
};

onMounted(() => {
	checkSessionToken();
});
</script>
