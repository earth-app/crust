<template>
	<div class="flex flex-col w-full h-full items-center justify-center sm:px-10 md:px-20 lg:px-60">
		<div class="flex items-center gap-2 mb-4 mt-24 sm:mt-8">
			<h1
				id="login"
				class="text-3xl font-semibold"
			>
				Login
			</h1>
			<UButton
				icon="mdi:progress-question"
				color="secondary"
				variant="subtle"
				@click="startTour('login')"
			/>
		</div>
		<div
			id="login-oauth"
			class="flex space-x-4 mb-6"
		>
			<UserOAuthButton
				v-for="provider in OAUTH_PROVIDERS"
				:key="provider"
				:provider="provider"
			/>
		</div>
		<ClientOnly>
			<div id="login-form">
				<UserLoginForm @login-success="handleLoginSuccess" />
			</div>
		</ClientOnly>
	</div>

	<ClientOnly>
		<SiteTour
			:steps="loginTour"
			name="Login Tour"
			tour-id="login"
		/>
	</ClientOnly>
</template>

<script setup lang="ts">
const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Login');

const { user } = useAuth();
const toast = useToast();
const route = useRoute();
const router = useRouter();
const redirectingAfterSubmit = ref(false);

const { error, redirect } = route.query;
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
		case 'body_parsing_error':
			description = 'An error occurred while parsing the request body.';
			icon = 'mdi:alert-box-outline';
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
		if (currentUser && !redirectingAfterSubmit.value) {
			router.replace('/');

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
	redirectingAfterSubmit.value = true;

	let redirect0 = '/';
	if (redirect && typeof redirect === 'string') {
		if (!redirect.startsWith('/')) {
			toast.add({
				title: 'Invalid Redirect',
				description: 'The redirect URL is invalid. Redirecting to home page.',
				icon: 'mdi:alert-circle',
				color: 'warning',
				duration: 5000
			});
		} else {
			redirect0 = redirect;
		}
	}

	router.replace(redirect0);
}

const { startTour } = useSiteTour();

const loginTour: SiteTourStep[] = [
	{
		id: 'login',
		title: 'Welcome Back',
		description:
			'Glad to have you again. You can sign in with the same method you used to sign up - OAuth provider, or username + password.',
		footer: 'Forgot your password? You can reset it below the form.',
		icon: 'mdi:login-variant'
	},
	{
		id: 'login-oauth',
		title: 'OAuth Sign-In',
		description:
			'If you signed up using Google, Microsoft, or GitHub, click the matching button. You only need to authorize once per browser.',
		footer: 'Linked multiple providers? Any of them gets you in.',
		icon: 'mdi:link-variant'
	},
	{
		id: 'login-form',
		title: 'Username & Password',
		description:
			'Use the username or email you signed up with, plus your password. We never email your password - if asked to "confirm" it via email, that\'s a phishing attempt.',
		footer: 'Trouble logging in? Use the password reset link to get back in via email.',
		icon: 'mdi:form-textbox-password'
	}
];
</script>
