<template>
	<UModal
		:open="open"
		:dismissible="!sending"
		title="Verify Your Email to Continue"
		@update:open="onOpenChange"
	>
		<template #content>
			<div class="p-6 flex flex-col gap-4 max-w-md">
				<div class="flex items-start gap-3">
					<UIcon
						:name="hasEmail ? 'mdi:email-alert-outline' : 'mdi:email-plus-outline'"
						class="size-8 text-warning shrink-0"
					/>
					<div>
						<h2 class="text-lg font-semibold">
							{{ hasEmail ? 'Verify Your Email' : 'Add an Email to Your Account' }}
						</h2>
						<p class="text-sm text-muted mt-1">
							{{ promptText }}
						</p>
					</div>
				</div>

				<UAlert
					v-if="hasEmail && currentEmail"
					color="info"
					variant="subtle"
					icon="mdi:email-outline"
					:title="currentEmail"
					description="A 6-8 digit code will be sent to this address."
				/>

				<UAlert
					v-if="error"
					color="error"
					variant="subtle"
					icon="mdi:alert-circle"
					:title="error"
				/>

				<UAlert
					v-if="sentMessage"
					color="success"
					variant="subtle"
					icon="mdi:check-circle"
					:title="sentMessage"
					description="Check your inbox (and spam folder) for the code, then enter it on the verification page."
				/>

				<div class="flex gap-2 flex-wrap mt-2">
					<UButton
						v-if="hasEmail"
						color="primary"
						icon="mdi:email-fast-outline"
						:loading="sending"
						:disabled="sending"
						@click="sendCode"
					>
						{{ sentMessage ? 'Resend Code' : 'Send Verification Code' }}
					</UButton>
					<UButton
						color="secondary"
						variant="subtle"
						:icon="hasEmail ? 'mdi:shield-check-outline' : 'mdi:account-edit-outline'"
						@click="goToVerify"
					>
						{{ hasEmail ? 'Go to Verification Page' : 'Add an Email' }}
					</UButton>
					<UButton
						variant="ghost"
						color="neutral"
						@click="close"
						:disabled="sending"
						>Not Now</UButton
					>
				</div>
			</div>
		</template>
	</UModal>
</template>

<script setup lang="ts">
const gate = useEmailGate();
const router = useRouter();
const toast = useToast();
const { user, sendVerificationEmail } = useAuth();

const open = computed(() => gate.open.value);
const sending = ref(false);
const sentMessage = ref<string | null>(null);
const error = ref<string | null>(null);

const hasEmail = computed(() => gate.hasEmail.value);
const currentEmail = computed(() => user.value?.account?.email ?? '');

const promptText = computed(() => {
	const action = gate.action.value || 'continue';
	if (hasEmail.value) {
		return `You need a verified email before you can ${action}. We'll send a one-time code to your address - verifying takes about a minute.`;
	}
	return `You don't have an email on file yet. Add one in your profile to ${action} and unlock account recovery, login alerts, and notifications.`;
});

function onOpenChange(value: boolean) {
	if (!value && !sending.value) close();
}

function close() {
	sentMessage.value = null;
	error.value = null;
	gate.close();
}

async function sendCode() {
	if (sending.value) return;
	sending.value = true;
	error.value = null;

	try {
		const res = await sendVerificationEmail();
		if (res.success) {
			sentMessage.value = res.data?.message || 'Verification code sent.';
			toast.add({
				title: 'Code Sent',
				description: 'Check your email for the verification code.',
				icon: 'mdi:email-fast-outline',
				color: 'success',
				duration: 4000
			});
		} else {
			error.value = res.message || 'Failed to send verification code.';
		}
	} catch (e: any) {
		error.value = e?.data?.message || e?.message || 'Failed to send verification code.';
	} finally {
		sending.value = false;
	}
}

function goToVerify() {
	gate.close();
	if (hasEmail.value) {
		router.push('/verify-email');
	} else {
		// no email on file → profile editor handles email add
		router.push('/profile');
	}
}
</script>
