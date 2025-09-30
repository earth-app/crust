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

			<UButton
				type="submit"
				:loading="loading"
				class="w-3/5 max-w-60"
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
import { useLogin } from '~/compostables/useLogin';
import { useAuth } from '~/compostables/useUser';
import { passwordSchema, usernameSchema } from '~/shared/schemas';

const username = ref('');
const password = ref('');
const loading = ref(false);

const error = ref('');
const message = ref('');

const login = useLogin();
const { fetchUser, fetchPhoto } = useAuth();

const emit = defineEmits<{
	loginSuccess: [];
}>();

async function handleLogin() {
	loading.value = true;
	error.value = '';

	const toast = useToast();

	const result = await login(username.value, password.value);

	if (result.success) {
		// Fetch user data to update the auth state
		Promise.all([fetchUser(), fetchPhoto()]).then(() => {
			emit('loginSuccess');
		});
		message.value = 'Welcome!';

		toast.add({
			title: 'Login Successful',
			description: `Welcome back, @${username.value}!`,
			icon: 'mdi:login',
			color: 'success',
			duration: 3000
		});
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
