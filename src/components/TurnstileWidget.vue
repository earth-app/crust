<template>
	<ClientOnly>
		<div v-if="siteKey">
			<NuxtTurnstile
				v-model="token"
				ref="turnstile"
				:options="turnstileOptions"
			/>
		</div>
	</ClientOnly>
</template>

<script setup lang="ts">
import { useTurnstile } from '~/compostables/useTurnstile';

const config = useRuntimeConfig();
const toast = useToast();
const siteKey = config.public.turnstile.siteKey;

const token = ref('');
watch(token, (newToken) => {
	if (newToken) {
		emit('received-token', newToken);
		verify();
	}
});

const turnstile = ref();
const turnstileOptions: Omit<Partial<Turnstile.RenderParameters>, 'callback'> = {
	'error-callback': onError,
	'expired-callback': onExpired,
	'timeout-callback': onTimeout
};

export interface TurnstileHandler {
	token: string;
	verify: () => Promise<boolean>;
	reset: () => void;
}

const emit = defineEmits<{
	(event: 'received-token', token: string): void;
	(event: 'verified'): void;
	(event: 'error', message: string): void;
	(event: 'expired'): void;
}>();

function onError(error: string) {
	toast.add({
		title: 'Turnstile Error',
		description: `Cloudflare Error Code: ${error}`,
		icon: 'mdi:lock-alert-outline',
		color: 'error'
	});

	emit('error', error);
}

function onExpired() {
	toast.add({
		title: 'Turnstile Expired',
		description: 'The verification has expired. Please complete it again.',
		icon: 'mdi:lock-alert-outline',
		color: 'warning'
	});

	emit('expired');
}

function onTimeout() {
	toast.add({
		title: 'Turnstile Timeout',
		description: 'The verification has timed out. Please complete it again.',
		icon: 'mdi:lock-clock',
		color: 'warning'
	});

	emit('error', 'Turnstile verification timed out');
}

async function verify() {
	if (!turnstile.value) {
		throw new Error('Turnstile widget is not initialized');
	}

	const { validate } = useTurnstile(token.value);
	const result = await validate();

	if (result.success) {
		emit('verified');
		return true;
	} else {
		turnstile.value?.reset();

		if (result['error-codes'].includes('timeout-or-duplicate3')) {
			toast.add({
				title: 'Verification Failed',
				description:
					'The turnstile token has already been used or has timed out. Please re-open and try again.',
				icon: 'mdi:lock-alert-outline',
				color: 'error'
			});

			console.error('Turnstile verification failed: Token already used or timed out');
		} else if (result['error-codes'].length > 0) {
			toast.add({
				title: 'Verification Failed',
				description: `Error Codes: ${result['error-codes'].join(', ')}`,
				icon: 'mdi:lock-alert-outline',
				color: 'error'
			});

			console.error('Turnstile verification failed:', result['error-codes']);
		} else if (result.messages && result.messages.length > 0) {
			toast.add({
				title: 'Verification Failed',
				description: result.messages.join(' '),
				icon: 'mdi:lock-alert-outline',
				color: 'error'
			});

			console.error('Turnstile verification failed:', result.messages);
		} else {
			toast.add({
				title: 'Verification Failed',
				description: 'Unknown error occurred. Please try again.',
				icon: 'mdi:lock-alert-outline',
				color: 'error'
			});

			console.error('Turnstile verification failed: Unknown error');
		}

		emit('error', result['error-codes'].join(', '));
		return false;
	}
}

defineExpose<TurnstileHandler>({
	token: token.value,
	verify: verify,
	reset: () => {
		if (turnstile.value) {
			turnstile.value.reset();
		}
	}
});
</script>
