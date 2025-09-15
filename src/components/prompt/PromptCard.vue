<template>
	<ClientOnly>
		<div class="w-full flex items-center justify-center my-8">
			<InfoCard
				:title="promptText"
				:description="author?.full_name"
				:avatar="authorAvatar || 'https://cdn.earth-app.com/earth-app.png'"
				avatar-size="xl"
				:avatar-chip="authorAvatarChipColor ? true : false"
				:avatar-chip-color="authorAvatarChipColor"
				avatar-chip-size="xl"
				:link="noLink ? undefined : `/prompts/${prompt.id}`"
				:footer="`${footer} • ${responsesCount ? withSuffix(responsesCount) + ' Responses' : 'No Responses'}`"
				:secondary-footer="secondaryFooter"
				:buttons="
					hasButtons
						? [
								{
									text: 'Edit Prompt',
									color: 'secondary',
									onClick: () => {
										editOpen = true;
									}
								},
								{
									text: 'Delete Prompt',
									color: 'error',
									onClick: () => {
										deletePrompt();
									}
								}
							]
						: undefined
				"
			/>
		</div>
		<UModal
			v-if="hasButtons"
			title="Edit Prompt"
			size="2xl"
			:closeable="true"
			v-model:open="editOpen"
			:overlay="false"
		>
			<template #body>
				<div class="flex flex-col space-y-4">
					<UInput v-model="promptText" />
					<UButton
						@click="savePrompt"
						:loading="editLoading"
						:disabled="editLoading || promptText.trim().length === 0"
						>Save</UButton
					>
				</div>
			</template>
		</UModal>
	</ClientOnly>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import { getPromptResponsesCount, removePrompt, updatePrompt } from '~/compostables/usePrompt';
import { getUser, getUserAvatar, useAuth } from '~/compostables/useUser';
import type { Prompt } from '~/shared/types/prompts';
import { type User } from '~/shared/types/user';
import { withSuffix } from '~/shared/util';

const props = defineProps<{
	prompt: Prompt;
	noLink?: boolean;
}>();

const promptText = ref(props.prompt.prompt);
const author = ref<User | null>(null);
const footer = ref<string | undefined>(undefined);
const secondaryFooter = ref<string | undefined>(undefined);
const authorAvatar = ref<string | null>(null);
const authorAvatarChipColor = ref<any | null>(null);
const responsesCount = ref<number | null>(null);

watch(
	() => props.prompt,
	(newPrompt) => {
		promptText.value = newPrompt.prompt;
	}
);

const { user } = useAuth();

const i18n = useI18n();
const time = computed(() => {
	if (!props.prompt.created_at) return 'sometime';
	const created = DateTime.fromISO(props.prompt.created_at, {
		zone: Intl.DateTimeFormat().resolvedOptions().timeZone
	});

	return created.setLocale(i18n.locale.value).toLocaleString(DateTime.DATETIME_SHORT);
});

const hasButtons = computed(() => {
	return (
		user.value &&
		(user.value.id === props.prompt.owner_id || user.value.account.account_type === 'ADMINISTRATOR')
	);
});

const updatedTime = computed(() => {
	if (!props.prompt.updated_at) return 'sometime';
	const updated = DateTime.fromISO(props.prompt.updated_at, {
		zone: Intl.DateTimeFormat().resolvedOptions().timeZone
	});

	return updated.toRelative({ locale: i18n.locale.value }) || 'sometime';
});

onMounted(async () => {
	if (props.prompt.created_at !== props.prompt.updated_at) {
		secondaryFooter.value = `Updated ${updatedTime.value}`;
	}

	if (props.prompt.owner_id) {
		const res = await getUser(props.prompt.owner_id);
		if (res.success && res.data) {
			author.value = res.data;
			switch (author.value.account.account_type) {
				case 'ORGANIZER':
					authorAvatarChipColor.value = 'warning';
					break;
				case 'ADMINISTRATOR':
					authorAvatarChipColor.value = 'error';
					break;
			}
			footer.value = `@${author.value.username} - ${time.value}`;

			const avatar = await getUserAvatar(author.value.id);
			if (avatar.success && avatar.data) {
				const blob = avatar.data;
				authorAvatar.value = URL.createObjectURL(blob);
			}
		} else {
			author.value = null;
			footer.value = `Unknown User - ${time.value}`;
		}
	}

	const resCount = await getPromptResponsesCount(props.prompt.id);
	if (resCount.success && resCount.data) {
		responsesCount.value = resCount.data.count;
	}
});

onUnmounted(() => {
	if (authorAvatar.value) {
		URL.revokeObjectURL(authorAvatar.value);
	}
});

const editOpen = ref(false);
const editLoading = ref(false);

async function savePrompt() {
	editLoading.value = true;
	const toast = useToast();
	const res = await updatePrompt(props.prompt.id, promptText.value);

	if (res.success) {
		editOpen.value = false;

		toast.add({
			title: 'Prompt Updated',
			description: 'Your prompt has been successfully updated.',
			icon: 'mdi:check',
			color: 'success',
			duration: 5000
		});
	} else {
		toast.add({
			title: 'Error',
			description: res.message || 'An unknown error occurred while updating your prompt.',
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 7000
		});
	}

	editLoading.value = false;
}

async function deletePrompt() {
	const yes = confirm('Are you sure you want to delete this prompt? This action cannot be undone.');

	const toast = useToast();
	const router = useRouter();
	if (yes) {
		const res = await removePrompt(props.prompt.id);
		if (res.success) {
			toast.add({
				title: 'Prompt Deleted',
				description: 'Your prompt has been successfully deleted.',
				icon: 'mdi:check',
				color: 'success',
				duration: 5000
			});

			refreshNuxtData(`prompt-${props.prompt.id}`);
			router.push('/prompts');
		} else {
			toast.add({
				title: 'Error',
				description: res.message || 'An unknown error occurred while deleting your prompt.',
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 7000
			});
		}
	} else {
		toast.add({
			title: 'Cancelled',
			description: 'Prompt deletion has been cancelled.',
			icon: 'mdi:cancel',
			color: 'info',
			duration: 5000
		});
	}
}
</script>
