<template>
	<UAlert
		v-if="newDisabled"
		class="my-4"
		variant="subtle"
		icon="mdi:exclamation-thick"
		title="You've reached the maximum amount of prompts you can create. Upgrade to create more!"
		color="warning"
	/>
	<UCard>
		<template #header>
			<h3 class="text-lg font-semibold">Create Prompt</h3>
		</template>

		<div class="container max-w-100 px-6">
			<div class="container flex flex-col">
				<UTextarea
					autoresize
					required
					v-model="prompt"
					label="Your Prompt"
					placeholder="What is the meaning of life?"
					:rows="2"
					:maxrows="2"
					:highlight="true"
				/>

				<USelect
					v-model="visibility"
					label="Visibility"
					:items="[
						{ label: 'Public', value: com.earthapp.Visibility.PUBLIC.name },
						{ label: 'Unlisted', value: com.earthapp.Visibility.UNLISTED.name },
						{ label: 'Private', value: com.earthapp.Visibility.PRIVATE.name }
					]"
					class="mt-4 max-w-30"
				/>
			</div>

			<TurnstileWidget
				v-if="user"
				class="mt-4"
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
				v-if="user"
				class="mt-4 w-22"
				color="primary"
				icon="mdi:plus-box"
				variant="subtle"
				block
				@click="newPrompt"
				:disabled="
					disabled ||
					loading ||
					newDisabled ||
					prompt.trim().length < 10 ||
					prompt.trim().length > 100
				"
				:loading="loading"
				>Create</UButton
			>
			<UButton
				v-else
				class="mt-4 w-28"
				color="info"
				trailing-icon="mdi:account-plus"
				variant="subtle"
				block
				@click="$router.push('/sign-up')"
				>Sign Up</UButton
			>
			<div
				v-if="error"
				class="text-red-500 mt-2"
			>
				{{ error }}
			</div>
		</div>
	</UCard>
</template>

<script setup lang="ts">
import { com } from '@earth-app/ocean';
import type { Prompt } from '../../shared/types/prompts';

const emit = defineEmits<{
	(event: 'prompt-created', prompt: Prompt): void;
}>();

const toast = useToast();
const { user, fetchUser } = useAuth();
const total = ref(0);
const newDisabled = computed(() => {
	switch (user.value?.account.account_type) {
		case 'ADMINISTRATOR':
			return false;
		case 'ORGANIZER':
		case 'WRITER':
			return total.value >= 10;
		default:
			return total.value >= 1;
	}
});
onMounted(async () => {
	await fetchUser(); // ensure user is loaded
	if (!user.value) return;
	const { total: total0 } = useUserPrompts(user.value.id);
	total.value = total0.value;
});

const loading = ref(false);
const disabled = ref(true);
const prompt = ref<string>('');
const visibility = ref<typeof com.earthapp.Visibility.prototype.name>(
	com.earthapp.Visibility.PUBLIC.name
);

const error = ref('');

async function newPrompt() {
	if (!user) {
		toast.add({
			title: 'Error',
			description: 'You must be logged in to create a prompt!',
			icon: 'mdi:account-off',
			color: 'error',
			duration: 5000
		});
		return;
	}

	const text = prompt.value.trim();

	if (!text) {
		toast.add({
			title: 'Error',
			description: 'Prompt cannot be empty.',
			icon: 'mdi:pencil-off',
			color: 'error',
			duration: 5000
		});
		return;
	}

	if (text.length < 10 || text.length > 100) {
		toast.add({
			title: 'Error',
			description: 'Prompt must be between 10 and 100 characters.',
			icon: 'mdi:pencil-off',
			color: 'error',
			duration: 5000
		});
		return;
	}

	try {
		loading.value = true;

		const res = await createPrompt(text, visibility.value);
		if (res.success && res.data) {
			if ('message' in res.data) {
				toast.add({
					title: 'Error',
					description: res.data.message || 'Failed to create prompt.',
					icon: 'mdi:alert-circle',
					color: 'error',
					duration: 5000
				});
				return;
			}

			loading.value = false;
			toast.add({
				title: 'Success',
				description: 'Prompt created successfully!',
				icon: 'mdi:check-circle',
				color: 'success'
			});

			emit('prompt-created', res.data);
		} else {
			toast.add({
				title: 'Error',
				description: res.message || 'Failed to create prompt.',
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 5000
			});
		}
	} catch (error) {
		toast.add({
			title: 'Error',
			description: 'An error occurred while creating the prompt.',
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 5000
		});
	}
}
</script>
