<template>
	<div
		id="navbar"
		class="bg-secondary-800 border-b-primary-500 border-b-8 text-white p-4 flex items-center"
	>
		<div class="flex items-center">
			<a href="/">
				<img
					src="/favicon.png"
					alt="Earth App Logo"
					class="h-12 w-12 inline-block mr-2 shadow-lg shadow-black/50 rounded-full hover:scale-105 transition-transform duration-300"
				/>
			</a>
		</div>
		<div class="ml-auto">
			<div
				v-if="user"
				class="flex items-center justify-center space-x-1 cursor-pointer hover:opacity-80 transition-opacity duration-250"
				@click="$router.push('/profile')"
			>
				<Icon
					name="material-symbols:account-box"
					class="text-white text-4xl"
				/>
				<span class="font-title text-xl text-shadow-2xs text-shadow-black">{{ user.username }}</span>
			</div>
			<LoginPopup v-else />
		</div>
	</div>
</template>

<script setup lang="ts">
import { useAuth } from '~/compostables/useCurrentUser';
import LoginPopup from './LoginPopup.vue';

const { user } = useAuth();
</script>
