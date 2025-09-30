<template>
	<div class="flex flex-col w-full h-full items-center justify-center px-60">
		<h1 class="text-3xl font-semibold mb-4 mt-8">Login</h1>
		<ClientOnly>
			<UserLoginForm @login-success="handleLoginSuccess" />
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
import { useAuth } from '~/compostables/useUser';

const { user } = useAuth();

onMounted(() => {
	if (user.value) {
		// Redirect to home page or dashboard if already logged in
		const toast = useToast();
		useRouter().push('/');

		toast.add({
			title: 'Already Logged In',
			description: 'You are already logged in.',
			icon: 'mdi:login-variant',
			color: 'info',
			duration: 3000
		});
	}
});

function handleLoginSuccess() {
	// Redirect to home page or dashboard after successful login
	useRouter().push('/');
	refreshNuxtData(['user-current', 'avatar-current']); // Refresh user data
}
</script>
