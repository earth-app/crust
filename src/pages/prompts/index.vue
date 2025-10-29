<template>
	<div class="flex flex-col items-center justify-center mt-4">
		<h2
			class="text-2xl font-semibold mr-4"
			id="prompts-title"
		>
			Today's Prompts
		</h2>
		<div class="flex gap-x-2">
			<UButton
				title="Refresh"
				icon="i-lucide-refresh-cw"
				color="neutral"
				variant="outline"
				class="mt-2"
				:loading="promptsLoading"
				:disabled="promptsLoading"
				@click="fetchPrompts"
			/>
			<UTooltip
				arrow
				:text="
					newDisabled
						? `You've reached your prompt limit. Upgrade to create more!`
						: `Click to create a prompt`
				"
			>
				<UButton
					title="Create Prompt"
					icon="mdi:plus"
					color="neutral"
					variant="outline"
					class="mt-2"
					:disabled="newDisabled"
					@click="$router.push('/prompts/new')"
				/>
			</UTooltip>
		</div>
		<div
			id="prompts"
			class="mt-12 w-9/10 grid grid-cols-1 lg:grid-cols-2 gap-x-8"
		>
			<InfoCardSkeleton
				v-if="promptsLoading"
				v-for="n in 5"
				:key="n"
				content-size="xs"
				class="mb-4"
			/>
			<PromptCard
				v-for="prompt in prompts"
				:key="prompt.id"
				:prompt="prompt"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { Prompt } from '~/shared/types/prompts';

const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Prompts');

const toast = useToast();

const prompts = ref<Prompt[]>([]);
const promptsLoading = ref(false);

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

async function fetchPrompts() {
	promptsLoading.value = true;
	const res = await getRandomPrompts(25);
	promptsLoading.value = false;

	if (res.success && res.data) {
		if ('message' in res.data) {
			prompts.value = [];

			toast.add({
				title: 'Error',
				description: res.data.message || 'No prompts available.',
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 5000
			});
			return;
		}

		prompts.value = res.data;
	} else {
		const toast = useToast();
		toast.add({
			title: 'Error',
			description: res.message || 'Failed to load prompts.',
			color: 'error',
			duration: 5000
		});

		console.error('Failed to load prompts:', res.message);
	}

	promptsLoading.value = false;
}

onMounted(async () => {
	await fetchPrompts();
});
</script>
