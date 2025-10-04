<template>
	<UCard class="size-full">
		<UForm
			:state="{ email, username, password }"
			@submit="handleSignup"
			class="space-x-6 *:mb-4"
			:schema="z.object({ email: emailSchema, username: usernameSchema, password: passwordSchema })"
		>
			<UFormField
				label="Email"
				name="email"
			>
				<UInput
					v-model="email"
					placeholder="Email"
					type="email"
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

			<UButton
				type="submit"
				:loading="loading"
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
import { useSignup } from '~/compostables/useLogin';
import { useAuth } from '~/compostables/useUser';
import { emailSchema, passwordSchema, usernameSchema } from '~/shared/schemas';

const email = ref('');
const username = ref('');
const password = ref('');
const loading = ref(false);

const error = ref('');
const message = ref('');

const signup = useSignup();
const { fetchUser, fetchPhoto } = useAuth();

const emit = defineEmits<{
	(event: 'signupSuccess', hasEmail: boolean): void;
}>();

async function handleSignup() {
	loading.value = true;
	error.value = '';

	const toast = useToast();

	const result = await signup(
		username.value,
		password.value,
		email.value.trim() ? email.value : undefined
	);

	if (result.success) {
		// Fetch user data to update the auth state
		Promise.all([fetchUser(), fetchPhoto()]).then(() => {
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
