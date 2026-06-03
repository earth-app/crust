<template>
	<UCard class="size-full">
		<UForm
			:state="{ userOrEmail, password }"
			@submit="handleLogin"
			class="space-x-6 *:mb-4"
			:schema="z.object({ userOrEmail: userOrEmailSchema, password: passwordSchema })"
		>
			<UFormField
				label="Username or Email"
				name="userOrEmail"
				:required="true"
			>
				<UInput
					v-model="userOrEmail"
					placeholder="Username or Email"
					class="min-w-60 w-2/5 max-w-120"
				/>
			</UFormField>

			<UFormField
				label="Password"
				name="password"
				:required="true"
			>
				<UInput
					v-model="password"
					placeholder="Password"
					type="password"
					class="min-w-60 w-2/5 max-w-120"
				/>
			</UFormField>

			<TurnstileWidget
				@received-token="loading = true"
				@error="
					loading = false;
					disabled = true;
					error = 'Turnstile verification failed. Please re-open and try again.';
				"
				@expired="
					loading = false;
					disabled = true;
					error = 'Turnstile verification expired. Please re-open and try again.';
				"
				@verified="
					loading = false;
					disabled = false;
				"
			/>

			<UButton
				type="submit"
				:loading="loading"
				:disabled="disabled || loading"
				class="w-3/5 max-w-60"
				icon="mdi:lock"
				>Login</UButton
			>
			<div class="text-sm! mt-2">
				<UButton
					id="forgot-password-link"
					variant="link"
					color="neutral"
					class="px-0!"
					@click="forgotOpen = true"
					>Forgot your Password?</UButton
				>
			</div>
			<div
				v-if="error"
				class="text-red-500 mt-2"
			>
				{{ error }}
			</div>
			<div
				v-if="message"
				class="text-green-500 mt-2"
			>
				{{ message }}
			</div>
		</UForm>

		<UModal
			v-model:open="forgotOpen"
			title="Reset Your Password"
			description="Enter the email tied to your account and we'll send you a reset link."
		>
			<template #body>
				<UForm
					:state="{ forgotEmail }"
					:schema="z.object({ forgotEmail: forgotEmailSchema })"
					class="space-y-4"
					@submit="handleForgot"
				>
					<UFormField
						label="Email"
						name="forgotEmail"
						:required="true"
					>
						<UInput
							v-model="forgotEmail"
							placeholder="you@example.com"
							autocomplete="email"
							type="email"
							class="w-full"
						/>
					</UFormField>
					<div class="flex justify-end gap-2">
						<UButton
							color="neutral"
							variant="ghost"
							:disabled="forgotLoading"
							@click="forgotOpen = false"
							>Cancel</UButton
						>
						<UButton
							type="submit"
							:loading="forgotLoading"
							:disabled="forgotLoading"
							icon="mdi:email-fast"
							>Send Reset Link</UButton
						>
					</div>
				</UForm>
			</template>
		</UModal>
	</UCard>
</template>

<script setup lang="ts">
import { emailSchema, passwordSchema } from 'schemas';
import z from 'zod';

const userOrEmail = ref('');
const password = ref('');
const loading = ref(false);
const disabled = ref(true);

const error = ref('');
const message = ref('');

const userOrEmailSchema = z
	.string()
	.min(3, 'Must be at least 3 characters')
	.max(100, 'Must be at most 100 characters');

const forgotOpen = ref(false);
const forgotEmail = ref('');
const forgotLoading = ref(false);
const forgotEmailSchema = emailSchema;

const login = useLogin();
const { user, fetchUser, sendResetPasswordEmail } = useAuth();
const router = useRouter();
const toast = useToast();
const pendingLogin = useState<{
	ticket: string;
	email: string;
	expiresAt: number;
	userOrEmail: string;
	password: string;
} | null>('pendingLogin2FA', () => null);

const emit = defineEmits<{
	loginSuccess: [];
}>();

async function handleForgot() {
	if (forgotLoading.value) return;
	forgotLoading.value = true;
	try {
		const res = await sendResetPasswordEmail(forgotEmail.value.trim());
		if (valid(res)) {
			// always show the same message so we don't leak whether the email exists
			toast.add({
				title: 'Check Your Email',
				description: `If an account exists for ${forgotEmail.value.trim()}, a reset link is on its way.`,
				icon: 'mdi:email-fast',
				color: 'success',
				duration: 5000
			});
			forgotOpen.value = false;
			forgotEmail.value = '';
		} else {
			toast.add({
				title: "Couldn't Send Reset Link",
				description: res.message || 'Please try again in a few moments.',
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 5000
			});
		}
	} finally {
		forgotLoading.value = false;
	}
}

async function handleLogin() {
	loading.value = true;
	error.value = '';

	const result = await login(userOrEmail.value, password.value);

	if (result.success && result.verified) {
		message.value = 'Welcome!';
		emit('loginSuccess');
		await fetchUser();

		toast.add({
			title: 'Login Successful',
			description: `Welcome back, @${user.value?.username ?? userOrEmail.value}!`,
			icon: 'mdi:login',
			color: 'success',
			duration: 3000
		});
	} else if (result.success && !result.verified) {
		pendingLogin.value = {
			ticket: result.ticket,
			email: result.email,
			expiresAt: Date.now() + result.expiresIn * 1000,
			userOrEmail: userOrEmail.value,
			password: password.value
		};

		await router.push('/login/verify');
	} else {
		if (result.message.includes('401')) {
			error.value = 'Invalid username or password.';
		} else if (result.message.includes('429')) {
			error.value = 'Too many login attempts. Please try again later.';
		} else if (result.message.includes('500')) {
			error.value = 'Internal server error. Please try again later.';
		} else {
			error.value = result.message;
		}
	}

	loading.value = false;
}
</script>
