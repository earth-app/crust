<template>
	<div class="flex flex-col w-full h-full items-center justify-center px-60">
		<h1 class="text-3xl font-semibold mb-4 mt-8">Login</h1>
		<ClientOnly>
			<UserLoginForm @login-success="$router.push('/')" />
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
import { useAuth } from '~/compostables/useUser';

const { user } = useAuth();

function handleLoginSuccess() {
	if (user.value) {
		// Redirect to home page or dashboard after successful login
		window.location.href = '/';
		refreshNuxtData(['user-current', 'avatar-current']); // Refresh user data
	}
}
</script>
