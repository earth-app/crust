<template>
	<div class="flex flex-col w-full h-full items-center justify-center sm:px-10 md:px-20 lg:px-60">
		<h1
			id="signup"
			class="text-3xl font-semibold mb-4 mt-24 sm:mt-8"
		>
			Sign Up
		</h1>
		<ClientOnly>
			<UserSignupForm @signup-success="handleSignupSuccess" />
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
import type { User } from '~/shared/types/user';

const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Sign Up');

const { user } = useAuth();

const toast = useToast();
const router = useRouter();

watch(
	() => user.value,
	(currentUser) => {
		if (currentUser) {
			router.push('/');

			// add buffer if just signed up
			if (new Date(currentUser.created_at).getTime() + 60 * 1000 <= Date.now()) {
				toast.add({
					title: 'Already Logged In',
					description: 'You are already logged in.',
					icon: 'mdi:login-variant',
					color: 'info',
					duration: 3000
				});
			}
		}
	},
	{ immediate: true }
);

function handleSignupSuccess(_: User, hasEmail: boolean) {
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
}
</script>
