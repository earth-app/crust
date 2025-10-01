<template>
	<UCard class="size-full">
		<UForm
			:state="{ oldPassword, newPassword }"
			@submit="handlePasswordChange"
			class="space-x-6 *:mb-4"
			:schema="z.object({ oldPassword: passwordSchema, newPassword: passwordSchema })"
		>
			<UFormField
				label="Current Password"
				name="oldPassword"
				:required="true"
			>
				<UInput
					v-model="oldPassword"
					placeholder="Current Password"
					type="password"
					class="min-w-60 w-2/5 max-w-120"
				/>
			</UFormField>

			<UFormField
				label="New Password"
				name="newPassword"
				:required="true"
			>
				<UInput
					v-model="newPassword"
					placeholder="New Password"
					type="password"
					class="min-w-60 w-2/5 max-w-120"
				/>
			</UFormField>

			<UButton
				type="submit"
				:loading="loading"
				class="w-3/5 max-w-60"
				color="info"
				>Change Password</UButton
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
import { changePassword } from '~/compostables/useUser';
import { passwordSchema } from '~/shared/schemas';

const oldPassword = ref('');
const newPassword = ref('');
const loading = ref(false);

const error = ref('');
const message = ref('');

const emit = defineEmits<{
	changePasswordSuccess: [];
}>();

async function handlePasswordChange() {
	if (oldPassword.value === newPassword.value) {
		error.value = 'New password must be different from the old password.';
		return;
	}

	loading.value = true;
	const res = await changePassword(oldPassword.value, newPassword.value);
	if (res.success) {
		message.value = res.data?.message || 'Password changed successfully.';
		error.value = '';
		oldPassword.value = '';
		newPassword.value = '';
		emit('changePasswordSuccess');
	} else {
		error.value = res.message || 'Failed to change password.';
		message.value = '';
	}

	loading.value = false;
}
</script>
