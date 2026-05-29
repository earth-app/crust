<template>
	<div class="flex flex-col w-full h-full items-center justify-center sm:px-10 md:px-20 lg:px-60">
		<ClientOnly>
			<div
				v-if="pendingLogin"
				class="w-full max-w-2xl p-4"
			>
				<div class="flex flex-col items-start mb-6 p-2">
					<h1
						id="login-verification-title"
						class="text-2xl font-semibold mb-4"
					>
						Verify it's you
					</h1>
					<p class="mb-4 text-gray-600 dark:text-gray-300">
						We sent an 8-digit code to
						<span class="font-medium">{{ pendingLogin.email }}</span
						>. Enter it below to finish signing in.
					</p>
					<div class="relative w-full">
						<UPinInput
							v-model="value"
							:length="8"
							autofocus
							:disabled="loading"
							@complete="submit"
							aria-labelledby="login-verification-title"
							aria-describedby="login-verification-help"
							class="mb-2"
						/>
					</div>
					<p
						id="login-verification-help"
						class="text-sm text-gray-500 mt-2"
					>
						Enter all 8 digits of the verification code. The code will be automatically submitted
						when complete.
					</p>
					<p
						class="text-sm text-gray-500 mt-2"
						aria-live="polite"
					>
						<template v-if="secondsRemaining > 0">
							Code expires in {{ formattedRemaining }}.
						</template>
						<template v-else> Code expired. Request a new one to continue. </template>
					</p>
					<div class="flex flex-row items-center gap-2 mt-2 flex-wrap">
						<UButton
							variant="outline"
							size="sm"
							class="p-2"
							trailing-icon="mdi:email-arrow-right-outline"
							:disabled="loading || resendCooldown > 0 || !pendingLogin.password"
							@click="resend"
						>
							<template v-if="resendCooldown > 0"> Resend in {{ resendCooldown }}s </template>
							<template v-else> Resend code </template>
						</UButton>
						<UButton
							variant="soft"
							color="neutral"
							size="sm"
							class="p-2"
							trailing-icon="mdi:arrow-left"
							:disabled="loading"
							@click="backToLogin"
						>
							Back to Login
						</UButton>
					</div>
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
						class="mt-4 w-full"
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
				<LazyUBanner
					title="No pending login verification. Please log in again."
					color="info"
					icon="mdi:login-variant"
					:ui="{ root: 'flex items-center', title: 'font-semibold' }"
					:actions="[{ label: 'Back to login', to: '/login' }]"
					close
				/>
			</div>
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Verify Login');

const router = useRouter();
const route = useRoute();
const toast = useToast();
const verifyNewIPLogin = useVerifyNewIPLogin();
const login = useLogin();

const pendingLogin = useState<{
	ticket: string;
	email: string;
	expiresAt: number;
	userOrEmail: string;
	password: string;
} | null>('pendingLogin2FA', () => null);

const value = ref<string[]>([]);
const errorMessage = ref('');
const loading = ref(false);
const now = ref(Date.now());
const resendCooldown = ref(0);

let tickHandle: ReturnType<typeof setInterval> | null = null;
let cooldownHandle: ReturnType<typeof setInterval> | null = null;

const secondsRemaining = computed(() => {
	if (!pendingLogin.value) return 0;
	return Math.max(0, Math.floor((pendingLogin.value.expiresAt - now.value) / 1000));
});

const formattedRemaining = computed(() => {
	const total = secondsRemaining.value;
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${s.toString().padStart(2, '0')}`;
});

onMounted(() => {
	if (!pendingLogin.value) return;
	tickHandle = setInterval(() => {
		now.value = Date.now();
	}, 1000);
});

onBeforeUnmount(() => {
	if (tickHandle) clearInterval(tickHandle);
	if (cooldownHandle) clearInterval(cooldownHandle);
});

function clearPending() {
	pendingLogin.value = null;
}

function backToLogin() {
	clearPending();
	router.replace('/login');
}

function startResendCooldown(seconds: number) {
	resendCooldown.value = Math.max(0, Math.floor(seconds));
	if (cooldownHandle) clearInterval(cooldownHandle);
	cooldownHandle = setInterval(() => {
		resendCooldown.value -= 1;
		if (resendCooldown.value <= 0 && cooldownHandle) {
			clearInterval(cooldownHandle);
			cooldownHandle = null;
		}
	}, 1000);
}

async function submit(inputValue: string[]) {
	if (!pendingLogin.value) return;

	errorMessage.value = '';

	if (inputValue.length !== 8) {
		errorMessage.value = 'Please enter the complete 8-digit verification code.';
		value.value = [];
		return;
	}

	const code = inputValue.join('');
	if (!/^\d{8}$/.test(code)) {
		errorMessage.value = 'The verification code must be 8 digits long and contain only numbers.';
		value.value = [];
		return;
	}

	loading.value = true;
	try {
		const res = await verifyNewIPLogin(pendingLogin.value.ticket, code);
		if (res.success) {
			toast.add({
				title: 'Login Verified',
				description: 'Welcome back!',
				icon: 'mdi:login',
				color: 'success',
				duration: 3000
			});

			clearPending();

			const redirect = route.query.redirect;
			let target = '/';
			if (typeof redirect === 'string' && redirect.startsWith('/')) target = redirect;
			await router.replace(target);
			return;
		}

		errorMessage.value = res.message;
		value.value = [];
		toast.add({
			title: 'Verification Failed',
			description: res.message,
			icon: 'mdi:alert-circle-outline',
			color: 'error',
			duration: 7000
		});

		if (!res.retryAllowed) {
			// Ticket is dead - get the user back to login.
			clearPending();
			setTimeout(() => router.replace('/login'), 1500);
		}
	} finally {
		loading.value = false;
	}
}

async function resend() {
	if (!pendingLogin.value || !pendingLogin.value.password) return;
	loading.value = true;
	errorMessage.value = '';

	try {
		const result = await login(pendingLogin.value.userOrEmail, pendingLogin.value.password);

		if (result.success && !result.verified) {
			pendingLogin.value = {
				...pendingLogin.value,
				ticket: result.ticket,
				email: result.email,
				expiresAt: Date.now() + result.expiresIn * 1000
			};
			value.value = [];
			toast.add({
				title: 'Code Resent',
				description: 'A new verification code has been emailed to you.',
				icon: 'mdi:email-check-outline',
				color: 'success',
				duration: 4000
			});
		} else if (result.success && result.verified) {
			// IP became known between attempts; user is now logged in.
			clearPending();
			await router.replace('/');
		} else {
			// 429 with retry_after is the expected rate-limit branch.
			if (result.retryAfter && result.retryAfter > 0) {
				startResendCooldown(result.retryAfter);
			}
			errorMessage.value = result.message;
			toast.add({
				title: 'Could not resend',
				description: result.message,
				icon: 'mdi:alert-circle-outline',
				color: 'error',
				duration: 7000
			});
		}
	} finally {
		loading.value = false;
	}
}
</script>
