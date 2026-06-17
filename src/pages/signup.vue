<template>
	<div class="flex flex-col w-full h-full items-center justify-center sm:px-10 md:px-20 lg:px-60">
		<div class="flex items-center gap-2 mb-4 mt-24 sm:mt-8">
			<h1
				id="signup"
				class="text-3xl font-semibold"
			>
				Sign Up
			</h1>
			<UButton
				icon="mdi:progress-question"
				color="secondary"
				variant="subtle"
				@click="startTour('signup')"
			/>
		</div>
		<div
			id="signup-oauth"
			class="flex space-x-4 mb-6"
		>
			<UserOAuthButton
				v-for="provider in OAUTH_PROVIDERS"
				:key="provider"
				:provider="provider"
			/>
		</div>
		<ClientOnly>
			<div id="signup-form">
				<UserSignupForm @signup-success="handleSignupSuccess" />
			</div>
		</ClientOnly>
	</div>

	<ClientOnly>
		<SiteTour
			:steps="signupTour"
			name="Sign Up Tour"
			tour-id="signup"
		/>
	</ClientOnly>
</template>

<script setup lang="ts">
const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Sign Up');

const { user } = useAuth();

const toast = useToast();
const route = useRoute();
const router = useRouter();
const redirectingAfterSubmit = ref(false);
const wasAuthenticatedAtMount = Boolean(user.value);

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
		if (!currentUser || redirectingAfterSubmit.value) return;
		redirectingAfterSubmit.value = true;
		router.replace('/');

		if (wasAuthenticatedAtMount) {
			toast.add({
				title: 'Already Logged In',
				description: 'You are already logged in.',
				icon: 'mdi:login-variant',
				color: 'info',
				duration: 3000
			});
			return;
		}

		const isNewAccount = Date.now() - new Date(currentUser.created_at).getTime() <= 60 * 1000;
		toast.add({
			title: isNewAccount ? 'Welcome!' : 'Welcome Back!',
			description: isNewAccount ? 'Your account is ready.' : 'Signed in to your existing account.',
			icon: isNewAccount ? 'mdi:account-check' : 'mdi:login-variant',
			color: 'success',
			duration: 3000
		});
	},
	{ immediate: true }
);

function handleSignupSuccess(_: User, hasEmail: boolean) {
	redirectingAfterSubmit.value = true;

	// Redirect to home page or verify email after successful login
	if (hasEmail) {
		router.replace('/verify-email');
		toast.add({
			title: 'Verification Email Sent',
			description: 'Please check your email to verify your account.',
			icon: 'mdi:email',
			color: 'info',
			duration: 5000
		});
	} else {
		router.replace('/');
	}
}

const { startTour } = useSiteTour();

const signupTour: SiteTourStep[] = [
	{
		id: 'signup',
		title: 'Welcome to Sign Up',
		description:
			"Create an account to unlock personalized recommendations, badges, quests, friends, and Impact Points. You'll be one of us in under a minute.",
		footer: "We'll walk through your options.",
		icon: 'mdi:account-plus-outline',
		placement: 'bottom'
	},
	{
		id: 'signup-oauth',
		title: 'Sign Up with a Provider',
		description:
			'The fastest path: sign in with Google, Microsoft, or GitHub. No password to remember, and you can link more providers later.',
		footer: 'We only request the bare minimum - your email and basic profile.',
		icon: 'mdi:link-variant',
		highlightPadding: 8
	},
	{
		id: 'signup-form',
		title: 'Or Use Email & Password',
		description:
			'Prefer the classic route? Use a username, email, and a strong password. You can always link an OAuth provider later from your profile.',
		footer:
			'A long, unique passphrase beats a complicated short one. A password manager makes it painless.',
		icon: 'mdi:form-textbox',
		highlightPadding: 8
	}
];
</script>
