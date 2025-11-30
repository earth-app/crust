<template>
	<UCard class="size-full">
		<UForm
			:state="{ email, username, password }"
			@submit="handleSignup"
			class="space-x-6 *:mb-4"
			:schema="
				z.object({
					email: emailSchema,
					username: usernameSchema,
					password: passwordSchema,
					fullName: fullNameSchema
				})
			"
		>
			<UFormField
				label="Email Address (optional)"
				name="email"
			>
				<UInput
					v-model="email"
					placeholder="me@example.com"
					type="email"
					class="min-w-60 w-2/5 max-w-120"
				/>
			</UFormField>

			<UFormField
				label="Name (optional)"
				name="fullName"
			>
				<UInput
					v-model="fullName"
					placeholder="John Doe"
					class="min-w-60 w-2/5 max-w-120"
				/>
			</UFormField>

			<UFormField
				label="Username"
				name="username"
				:required="true"
			>
				<UInput
					v-model="username"
					placeholder="Username"
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
				:disabled="loading || disabled"
				icon="mdi:account-plus"
				class="w-3/5 max-w-60"
				>Sign Up</UButton
			>
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
	</UCard>
</template>

<script setup lang="ts">
import z from 'zod';
import { emailSchema, fullNameSchema, passwordSchema, usernameSchema } from '~/shared/schemas';

const fullName = ref('');
const email = ref('');
const username = ref('');
const password = ref('');

const loading = ref(false);
const disabled = ref(true);
const error = ref('');
const message = ref('');

const signup = useSignup();
const { fetchUser } = useAuth();

const emit = defineEmits<{
	(event: 'signupSuccess', hasEmail: boolean): void;
}>();

async function handleSignup() {
	loading.value = true;
	error.value = '';

	const toast = useToast();

	const firstName = fullName.value.trim() ? fullName.value.trim().split(' ')[0] : '';
	const lastName = fullName.value.trim() ? fullName.value.trim().split(' ').slice(1).join(' ') : '';

	if (fullName.value.trim() && !firstName) {
		error.value = 'Please enter a valid name.';
		loading.value = false;
		return;
	}

	const result = await signup(
		username.value,
		password.value,
		email.value.trim() ? email.value : undefined,
		firstName || undefined,
		lastName || undefined
	);

	if (result.success) {
		// Fetch user data to update the auth state
		fetchUser().then(() => {
			emit('signupSuccess', !!email.value.trim());
		});
		message.value = 'Welcome!';

		toast.add({
			title: 'Sign Up Successful',
			description: 'You have successfully signed up. Welcome!',
			icon: 'mdi:account-plus',
			color: 'success',
			duration: 3000
		});

		refreshNuxtData('user-current'); // Refresh user data
	} else {
		if (result.message.includes('409')) {
			error.value = 'Username already exists. Please choose another.';
		} else if (result.message.includes('400')) {
			error.value = 'Invalid username or password.';
		} else if (result.message.includes('429')) {
			error.value = 'Too many signup attempts. Please try again later.';
		} else if (result.message.includes('500')) {
			error.value = 'Server error. Please try again later.';
		} else {
			error.value = result.message || 'Signup failed. Please try again.';
		}
	}

	loading.value = false;
}
</script>
