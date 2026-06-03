<template>
	<ClientOnly>
		<div class="flex flex-col w-full max-w-md mx-auto px-6 py-12 space-y-6">
			<div class="flex flex-col items-center gap-2 text-center">
				<UIcon
					name="mdi:lock-reset"
					class="size-12 text-primary"
				/>
				<h1
					id="reset-password-title"
					class="text-2xl font-semibold"
				>
					Reset Your Password
				</h1>
				<p
					v-if="status !== 'success'"
					class="text-sm text-muted max-w-sm"
				>
					Choose a new password for your account. After saving, you'll be redirected to log in.
				</p>
			</div>

			<!-- missing or malformed link — show a clear dead-end rather than a broken form -->
			<UAlert
				v-if="status === 'invalid-link'"
				id="reset-invalid-link"
				color="error"
				variant="subtle"
				icon="mdi:link-off"
				title="Reset Link Invalid"
				description="This reset link is missing required information. Request a new one from the login page."
				:actions="[
					{
						label: 'Back to Login',
						icon: 'mdi:login-variant',
						color: 'primary',
						variant: 'solid',
						to: '/login'
					}
				]"
			/>

			<!-- post-success state: the toast already fired, but a sticky inline confirmation -->
			<!-- gives the user something to read while the router.push lands -->
			<UAlert
				v-else-if="status === 'success'"
				id="reset-success"
				color="success"
				variant="subtle"
				icon="mdi:check-circle-outline"
				title="Password Updated"
				description="Your password has been reset. Redirecting you to log in…"
			/>

			<UForm
				v-else
				id="reset-password-form"
				:state="state"
				:schema="schema"
				class="space-y-4"
				aria-labelledby="reset-password-title"
				@submit="handleSubmit"
			>
				<UFormField
					label="New Password"
					name="newPassword"
					:required="true"
					help="At least 8 characters."
				>
					<UInput
						v-model="state.newPassword"
						type="password"
						autocomplete="new-password"
						placeholder="Enter your new password"
						class="w-full"
					/>
				</UFormField>
				<UFormField
					label="Confirm Password"
					name="confirmPassword"
					:required="true"
				>
					<UInput
						v-model="state.confirmPassword"
						type="password"
						autocomplete="new-password"
						placeholder="Type the new password again"
						class="w-full"
					/>
				</UFormField>

				<UAlert
					v-if="errorMessage"
					id="reset-error"
					color="error"
					variant="soft"
					icon="mdi:alert-circle"
					:title="errorTitle"
					:description="errorMessage"
				/>

				<UButton
					type="submit"
					block
					:loading="submitting"
					:disabled="submitting"
					icon="mdi:lock-reset"
				>
					Reset Password
				</UButton>

				<div class="text-center text-sm text-muted">
					Remembered it after all?
					<NuxtLink
						to="/login"
						class="text-primary hover:underline"
						>Back to login</NuxtLink
					>
				</div>
			</UForm>
		</div>
	</ClientOnly>
</template>

<script setup lang="ts">
import { passwordSchema } from 'schemas';
import z from 'zod';

const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Reset Password');

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { user, resetPassword } = useAuth();

watch(
	() => user.value,
	(currentUser) => {
		if (currentUser) {
			router.replace('/');

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

// uid + token are URL params handed to the user via the reset email
const uid = computed(() => {
	const raw = route.query.uid;
	return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
});
const token = computed(() => {
	const raw = route.query.token;
	return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
});

type Status = 'ready' | 'invalid-link' | 'success';
const status = ref<Status>(uid.value && token.value ? 'ready' : 'invalid-link');

const state = reactive({
	newPassword: '',
	confirmPassword: ''
});

const schema = z
	.object({
		newPassword: passwordSchema,
		confirmPassword: z.string().min(1, 'Please confirm your password.')
	})
	.refine((d) => d.newPassword === d.confirmPassword, {
		path: ['confirmPassword'],
		message: "Passwords don't match."
	});

const submitting = ref(false);
const errorTitle = ref('');
const errorMessage = ref('');

async function handleSubmit() {
	if (!uid.value || !token.value) {
		status.value = 'invalid-link';
		return;
	}
	if (submitting.value) return;

	errorTitle.value = '';
	errorMessage.value = '';
	submitting.value = true;
	try {
		const res = await resetPassword(uid.value, token.value, state.newPassword);
		if (res.success) {
			status.value = 'success';
			toast.add({
				title: 'Password Updated',
				description: 'You can now log in with your new password.',
				icon: 'mdi:check-circle',
				color: 'success',
				duration: 5000
			});
			// give the success alert a beat to register before navigation
			setTimeout(() => router.push('/login'), 1200);
			return;
		}

		const message = (res.message || '').toLowerCase();
		if (message.includes('expired') || message.includes('invalid') || message.includes('token')) {
			errorTitle.value = 'Reset Link Expired';
			errorMessage.value =
				'This reset link is no longer valid. Request a new one from the login page.';
		} else {
			errorTitle.value = 'Reset Failed';
			errorMessage.value =
				res.message || 'We could not reset your password. Please try again in a moment.';
		}
	} catch (e: any) {
		errorTitle.value = 'Reset Failed';
		errorMessage.value =
			e?.data?.message || e?.message || 'An unexpected error occurred. Please try again.';
	} finally {
		submitting.value = false;
	}
}
</script>
