<template>
	<ClientOnly>
		<div
			v-if="user && !user.account.email_verified"
			id="verify-email-section"
			class="flex w-full h-full px-24"
		>
			<UserEmailVerification @verified="onEmailVerified" />
		</div>
		<div v-else-if="user && user.account.email_verified">
			<p class="text-center text-green-600">Your email is already verified.</p>
		</div>
		<div
			v-else-if="user === null"
			class="flex flex-col w-full h-full items-center justify-center"
		>
			<p class="text-center text-gray-600">Please log in to verify your email.</p>
		</div>

		<SiteTour
			:steps="verifyEmailTour"
			name="Verify Email Tour"
			tour-id="verify-email"
		/>
	</ClientOnly>
</template>

<script setup lang="ts">
const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Verify Email');

const { user, sendVerificationEmail, fetchUser } = useAuth();
const router = useRouter();
const toast = useToast();
const { startTourIfNew } = useSiteTour();

// suppress already verified toast
const justVerified = ref(false);

async function resendVerificationFromTour() {
	const res = await sendVerificationEmail();
	if (valid(res, false)) {
		toast.add({
			title: 'Verification Email Sent',
			description: res.data.message || 'A fresh verification email is on its way.',
			icon: 'mdi:email-check',
			color: 'success',
			duration: 5000
		});
	} else {
		toast.add({
			title: 'Could Not Resend',
			description: res.message || 'Wait a moment, then try again.',
			icon: 'mdi:email-off',
			color: 'error',
			duration: 5000
		});
	}
}

const verifyEmailTour: SiteTourStep[] = [
	{
		id: 'verification-title',
		title: 'Verify Your Email',
		description:
			"We've sent a verification email to the address on your account. Enter the 8-digit code below — or click the link inside the email — to confirm it's yours.",
		footer: "Can't see it? Check your spam folder - it sometimes lands there on first sign-up.",
		icon: 'mdi:email-check-outline',
		placement: 'bottom',
		dim: true,
		waitFor: 'verification-title'
	},
	{
		id: 'verification-help',
		title: 'Didn’t Get the Email?',
		description:
			"Request a fresh one with the button below. There's a small cooldown to keep things safe — wait a moment if the resend button isn't responding.",
		footer:
			'Verification codes expire after 24 hours. Use the latest code; older ones stop working.',
		icon: 'mdi:email-sync-outline',
		cta: {
			label: 'Resend Email Now',
			icon: 'mdi:email-arrow-right-outline',
			color: 'info',
			advance: true,
			handler: resendVerificationFromTour
		}
	},
	{
		title: 'What You Unlock',
		description:
			'A verified email lets you reset your password if you ever get locked out, receive important account alerts, and post in some community spaces. We never share your address.',
		footer: 'Go check your inbox - we’ll see you back here once you enter the code.',
		icon: 'mdi:shield-check-outline',
		placement: 'center'
	}
];

watch(
	() => user.value,
	(currentUser) => {
		if (currentUser === null) {
			// User is not logged in, redirect to login
			router.push('/login');
			toast.add({
				title: 'Not Logged In',
				description: 'You must be logged in to verify your email.',
				icon: 'mdi:account-alert',
				color: 'error',
				duration: 3000
			});
		} else if (currentUser && currentUser.account.email_verified && !justVerified.value) {
			// already verified on initial load — skip the toast on the self-verify flow
			router.push('/');
			toast.add({
				title: 'Email Already Verified',
				description: 'Your email is already verified.',
				icon: 'mdi:check-circle-outline',
				color: 'info',
				duration: 3000
			});
		}
	},
	{ immediate: true }
);

async function onEmailVerified() {
	justVerified.value = true;
	// refresh server-side state so other pages see the change after redirect
	await fetchUser(true);
	router.push('/');
}

onMounted(() => {
	if (user.value && !user.value.account.email_verified) {
		startTourIfNew('verify-email');
	}
});
</script>
