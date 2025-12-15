<template>
	<div class="flex flex-col w-full h-full items-center justify-center sm:px-10 md:px-20 lg:px-60">
		<h1
			id="signup"
			class="text-3xl font-semibold mb-4 mt-24 sm:mt-8"
		>
			Sign Up
		</h1>
		<div class="flex space-x-4 mb-6">
			<UserOAuthButton
				v-for="provider in OAUTH_PROVIDERS"
				:key="provider"
				:provider="provider"
			/>
		</div>
		<ClientOnly>
			<UserSignupForm @signup-success="handleSignupSuccess" />
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
import { type User, OAUTH_PROVIDERS } from '~/shared/types/user';

const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Sign Up');

const { user } = useAuth();

const toast = useToast();
const route = useRoute();
const router = useRouter();

const { error } = route.query;
if (error) {
	let description,
		icon = '';
	switch (error) {
		case 'no_provider':
			description = 'No OAuth provider specified.';
			icon = 'mdi:account-alert';
			break;
		case 'no_code':
			description = 'No authorization code received from provider.';
			icon = 'mdi:cancel';
			break;
		case 'invalid_provider':
			description = 'Invalid OAuth provider.';
			icon = 'mdi:account-cancel';
			break;
		case 'auth_failed':
			description = 'Authentication failed with the provider.';
			icon = 'mdi:account-off';
			break;
		default:
			description = 'An unknown error occurred during login.';
			icon = 'mdi:alert-circle';
			break;
	}

	toast.add({
		title: 'Login Error',
		description,
		icon,
		color: 'error',
		duration: -1
	});
}

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
