<template>
	<div class="flex flex-col w-full h-full items-center justify-center sm:px-10 md:px-20 lg:px-60">
		<h1 class="text-3xl font-semibold mb-4 mt-24 sm:mt-8">Login</h1>
		<div class="flex space-x-4 mb-6">
			<UserOAuthButton
				v-for="provider in OAUTH_PROVIDERS"
				:key="provider"
				:provider="provider"
			/>
		</div>
		<ClientOnly>
			<UserLoginForm @login-success="handleLoginSuccess" />
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
import { OAUTH_PROVIDERS } from '~/shared/types/user';

const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Login');

const { user } = useAuth();
const toast = useToast();
const route = useRoute();
const router = useRouter();

const { error } = route.query;
if (error) {
	let description,
		icon = '';
	switch (error) {
		case 'provider_error':
			description = 'An error occurred with the OAuth provider.';
			icon = 'mdi:alert-box-outline';
			break;
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
		case 'not_authenticated':
			description = 'You must be logged in to perform this action.';
			icon = 'mdi:login-variant';
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

			if (!error)
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
	refreshNuxtData('user-current'); // Refresh user data
}
</script>
