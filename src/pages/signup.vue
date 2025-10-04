<template>
	<div class="flex flex-col w-full h-full items-center justify-center px-60">
		<h1 class="text-3xl font-semibold mb-4 mt-8">Sign Up</h1>
		<ClientOnly>
			<UserSignupForm @signup-success="handleSignupSuccess" />
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
import { useAuth } from '~/compostables/useUser';

const { user } = useAuth();

const toast = useToast();
const router = useRouter();
onMounted(() => {
	if (user.value) {
		// Redirect to home page or dashboard if already logged in
		router.push('/');
		toast.add({
			title: 'Already Logged In',
			description: 'You are already logged in.',
			icon: 'mdi:login-variant',
			color: 'info',
			duration: 3000
		});
	}
});

function handleSignupSuccess(hasEmail: boolean) {
	if (!user.value) return;

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

	refreshNuxtData(['user-current', 'avatar-current']); // Refresh user data
}
</script>
