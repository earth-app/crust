<template>
	<div class="flex flex-col w-full h-full items-center justify-center sm:px-10 md:px-20 lg:px-60">
		<h1 class="text-3xl font-semibold mb-4 mt-24 sm:mt-8">Login</h1>
		<ClientOnly>
			<UserLoginForm @login-success="handleLoginSuccess" />
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
const { user } = useAuth();
const toast = useToast();
const router = useRouter();

watch(
	() => user.value,
	(currentUser) => {
		if (currentUser) {
			router.push('/');
			toast.add({
				title: 'Already Logged In',
				description: 'You are already logged in.',
				icon: 'mdi:login-variant',
				color: 'info',
				duration: 3000
			});
		}
	},
	{ immediate: true }
);

function handleLoginSuccess() {
	// Redirect to home page or dashboard after successful login
	router.push('/');
	refreshNuxtData(['user-current', 'avatar-current']); // Refresh user data
}
</script>
