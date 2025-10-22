<template>
	<ClientOnly>
		<div
			v-if="user"
			class="w-full h-full p-2"
		>
			<div class="flex flex-col items-start mb-6 p-2">
				<h1
					id="verification-title"
					class="text-2xl font-semibold mb-4"
				>
					Email Verification
				</h1>
				<p class="mb-4 text-gray-600 dark:text-gray-300">
					Please enter the 8-digit verification code sent to
					<span class="font-medium">{{ user.account.email }}</span>
				</p>
				<div class="relative w-full">
					<UPinInput
						v-model="value"
						:length="8"
						autofocus
						:disabled="loading"
						@complete="sendVerifyEmail"
						aria-labelledby="verification-title"
						aria-describedby="verification-help"
						class="mb-2"
					/>
				</div>
				<p
					id="verification-help"
					class="text-sm text-gray-500 mt-2"
				>
					Enter all 8 digits of the verification code. The code will be automatically submitted when
					complete.
				</p>
				<UButton
					variant="outline"
					size="sm"
					class="mt-2 p-2"
					trailing-icon="mdi:email-arrow-right-outline"
					:disabled="loading"
					@click="resendVerificationEmail"
				>
					Resend Code
				</UButton>
				<div
					v-if="loading"
					class="mt-4 text-center"
				>
					<p
						class="text-sm text-gray-600 dark:text-gray-300"
						aria-live="polite"
					>
						Loading...
					</p>
				</div>
				<div
					v-if="errorMessage"
					class="mt-4"
				>
					<UAlert
						:title="'Verification Error'"
						:description="errorMessage"
						color="error"
						icon="mdi:alert-circle"
						variant="subtle"
						@close="errorMessage = ''"
					/>
				</div>
			</div>
		</div>
		<div
			v-else
			class="w-full h-full flex items-center justify-center"
		>
			<UBanner
				title="Please log in to verify your email address."
				color="info"
				icon="mdi:email-check-outline"
				:ui="{ root: 'flex items-center', title: 'font-semibold' }"
				close
			>
			</UBanner>
		</div>
	</ClientOnly>
</template>

<script setup lang="ts">
const { user } = useAuth();

const value = ref<string[]>([]);
const errorMessage = ref<string>('');

const emit = defineEmits<{
	(event: 'verified'): void;
}>();

const loading = ref(false);

async function resendVerificationEmail() {
	loading.value = true;
	errorMessage.value = '';
	const toast = useToast();

	sendVerificationEmail()
		.then((res) => {
			if (res.success) {
				toast.add({
					title: 'Verification Email Sent',
					description: 'A new verification code has been sent to your email address.',
					color: 'success',
					icon: 'mdi:email-check-outline',
					duration: 5000
				});
			} else {
				errorMessage.value =
					res.message || 'Failed to resend verification email. Please try again later.';
				toast.add({
					title: 'Error',
					description: errorMessage.value,
					color: 'error',
					icon: 'mdi:alert-circle-outline',
					duration: 7000
				});
			}

			loading.value = false;
		})
		.catch((error) => {
			errorMessage.value = error.message || 'An unexpected error occurred. Please try again later.';
			toast.add({
				title: 'Error',
				description: errorMessage.value,
				color: 'error',
				icon: 'mdi:alert-circle-outline',
				duration: 7000
			});

			loading.value = false;
		});
}

async function sendVerifyEmail(inputValue: string[]) {
	loading.value = true;
	errorMessage.value = '';
	const toast = useToast();

	// Clear any previous error
	errorMessage.value = '';

	if (inputValue.length !== 8) {
		loading.value = false;
		errorMessage.value = 'Please enter the complete 8-digit verification code.';

		toast.add({
			title: 'Invalid Code',
			description: 'Please enter the complete 8-digit verification code.',
			color: 'warning',
			icon: 'mdi:alert-circle-outline',
			duration: 5000
		});

		// Reset the input for retry
		value.value = [];
		return;
	}

	const code = inputValue.join('');
	if (!/^\d{8}$/.test(code)) {
		loading.value = false;
		errorMessage.value = 'The verification code must be 8 digits long and contain only numbers.';

		toast.add({
			title: 'Invalid Code',
			description: 'The verification code must be 8 digits long and contain only numbers.',
			color: 'warning',
			icon: 'mdi:alert-circle-outline',
			duration: 5000
		});

		// Reset the input for retry
		value.value = [];
		return;
	}

	try {
		const res = await verifyEmail(code);
		if (res.success) {
			value.value = [];
			errorMessage.value = '';
			emit('verified');

			toast.add({
				title: 'Email Verified',
				description: 'Your email address has been successfully verified.',
				color: 'success',
				icon: 'mdi:email-check-outline',
				duration: 5000
			});
		} else {
			errorMessage.value =
				res.message || 'The verification code you entered is incorrect. Please try again.';

			toast.add({
				title: 'Verification Failed',
				description: errorMessage.value,
				color: 'error',
				icon: 'mdi:alert-circle-outline',
				duration: 7000
			});

			// Reset the input for retry
			value.value = [];
		}
	} catch (error) {
		errorMessage.value = 'An unexpected error occurred. Please try again.';

		toast.add({
			title: 'Error',
			description: 'An unexpected error occurred. Please try again.',
			color: 'error',
			icon: 'mdi:alert-circle-outline',
			duration: 7000
		});

		// Reset the input for retry
		value.value = [];
	} finally {
		loading.value = false;
	}
}
</script>
