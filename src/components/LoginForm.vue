<template>
	<UCard>
		<UForm
			:state="{ username, password }"
			@submit.prevent="handleLogin"
			class="space-x-4"
		>
			<UFormGroup
				label="Username"
				name="username"
				:required="true"
			>
				<UInput
					v-model="username"
					placeholder="Username"
				/>
			</UFormGroup>

			<UFormGroup
				label="Password"
				name="password"
				:required="true"
			>
				<UInput
					v-model="password"
					placeholder="Password"
					type="password"
				/>
			</UFormGroup>

			<UButton
				type="submit"
				:loading="loading"
				>Login</UButton
			>
			<div
				v-if="error"
				class="text-red-500 mt-2"
			>
				{{ error }}
			</div>
		</UForm>
	</UCard>
</template>

<script setup lang="ts">
import { useLogin } from '~/compostables/useLogin';
import { useAuth } from '~/compostables/useUser';

const username = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');

const login = useLogin();
const { fetchUser } = useAuth();

const emit = defineEmits<{
	loginSuccess: [];
}>();

async function handleLogin() {
	loading.value = true;
	error.value = '';

	const result = await login(username.value, password.value);

	if (result.success) {
		// Fetch user data to update the auth state
		await fetchUser();
		emit('loginSuccess');
	} else {
		error.value = 'Invalid credentials';
	}

	loading.value = false;
}
</script>
