<template>
	<ClientOnly>
		<div
			v-if="user"
			class="flex flex-col w-full min-w-120 px-8"
		>
			<div class="flex flex-col w-full mb-4">
				<strong class="text-md mb-2">@{{ user.username }}</strong>
				<p>
					Deleting your account is irreversible. Please make sure that this is something you want to
					do before you proceed.
				</p>
				<p>To delete your account, please enter your password and confirm your choice.</p>
			</div>
			<div class="flex flex-col w-1/2">
				<UInput
					v-model="password"
					type="password"
					:disabled="loading"
					:ui="{ base: 'peer' }"
				>
					<label
						class="pointer-events-none absolute left-0 -top-2.5 text-highlighted text-xs font-medium px-1.5 transition-all peer-focus:-top-2.5 peer-focus:text-highlighted peer-focus:text-xs peer-focus:font-medium peer-placeholder-shown:text-sm peer-placeholder-shown:text-dimmed peer-placeholder-shown:top-1.5 peer-placeholder-shown:font-normal"
					>
						<span class="inline-flex bg-default px-1">Password</span>
					</label>
				</UInput>
				<UButton
					color="error"
					class="mt-4 w-full"
					variant="solid"
					icon="mdi:account-cancel"
					:loading="loading"
					:disabled="!password || loading"
					@click="confirmDelete"
					>Delete Account</UButton
				>
			</div>
		</div>
		<div
			v-else
			class="flex flex-col w-full h-full items-center justify-center"
		>
			<p class="text-center text-gray-600">Please log in.</p>
		</div>
	</ClientOnly>
</template>

<script setup lang="ts">
import { deleteAccount, useAuth } from '~/compostables/useUser';

const { user } = useAuth();
const toast = useToast();

const loading = ref(false);
const password = ref('');

const emit = defineEmits<{
	(event: 'deleted'): void;
}>();

async function confirmDelete() {
	if (!user.value) return;
	if (!password.value) return;
	loading.value = true;

	const res = await deleteAccount(password.value);
	console.log(res);
	if (res.success) {
		emit('deleted');
	} else {
		if (res.data && 'message' in res.data) {
			toast.add({
				title: 'Error',
				description: res.data.message,
				color: 'error',
				icon: 'mdi:account-alert',
				duration: 5000
			});

			loading.value = false;
			return;
		}

		console.error(res.message || 'Failed to delete account.');
		toast.add({
			title: 'Error',
			description: res.message || 'Failed to delete account.',
			color: 'error',
			icon: 'mdi:account-alert',
			duration: 5000
		});
	}

	loading.value = false;
}
</script>
