<template>
	<UCard class="size-full">
		<UForm
			:state="{ username, password }"
			@submit="handleLogin"
			class="space-x-6 *:mb-4"
			:schema="z.object({ username: usernameSchema, password: passwordSchema })"
		>
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
				:disabled="disabled || loading"
				class="w-3/5 max-w-60"
				icon="mdi:lock"
				>Login</UButton
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
import { passwordSchema, usernameSchema } from '~/shared/utils/schemas';

const username = ref('');
const password = ref('');
const loading = ref(false);
const disabled = ref(true);

const error = ref('');
const message = ref('');

const login = useLogin();
const { fetchUser } = useAuth();

const emit = defineEmits<{
	loginSuccess: [];
}>();

async function handleLogin() {
	loading.value = true;
	error.value = '';

	const toast = useToast();

	const result = await login(username.value, password.value);

	if (result.success) {
		message.value = 'Welcome!';

		// Fetch user data and ensure state is updated before emitting
		await fetchUser(true);

		// Force refresh all cached data
		await refreshNuxtData();

		toast.add({
			title: 'Login Successful',
			description: `Welcome back, @${username.value}!`,
			icon: 'mdi:login',
			color: 'success',
			duration: 3000
		});

		// Emit after state is ready
		emit('loginSuccess');
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
