<template>
	<ClientOnly>
		<div class="w-full flex items-center justify-center my-2 sm:my-4 md:my-6 lg:my-8">
			<InfoCard
				:title="promptText"
				:description="prompt.owner.full_name || `@${prompt.owner.username}`"
				:avatar="authorAvatar"
				avatar-size="xl"
				:avatar-chip="authorAvatarChipColor ? true : false"
				:avatar-chip-color="authorAvatarChipColor"
				avatar-chip-size="xl"
				:link="noLink ? undefined : `/prompts/${prompt.id}`"
				:footer="`${footer} • ${prompt.responses_count ? withSuffix(prompt.responses_count) + ' Responses' : 'No Responses'}`"
				:secondary-footer="secondaryFooter"
				:buttons="
					hasButtons
						? [
								{
									text: 'Edit',
									color: 'secondary',
									onClick: () => {
										editOpen = true;
									}
								},
								{
									text: 'Delete',
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
import { removePrompt, updatePrompt } from '~/compostables/usePrompt';
import { useAuth, useUser } from '~/compostables/useUser';
import type { Prompt } from '~/shared/types/prompts';
import { withSuffix } from '~/shared/util';

const props = defineProps<{
	prompt: Prompt;
	noLink?: boolean;
}>();

const promptText = ref(props.prompt.prompt);
watch(
	() => props.prompt,
	(newPrompt) => {
		promptText.value = newPrompt.prompt;
	}
);

const footer = ref<string | undefined>(undefined);
const secondaryFooter = ref<string | undefined>(undefined);

const authorAvatar = ref<string>('https://cdn.earth-app.com/earth-app.png');
const { photo } = useUser(props.prompt.owner_id);
watch(
	() => photo.value,
	(photo) => {
		if (photo) {
			if (authorAvatar.value && authorAvatar.value.startsWith('blob:'))
				URL.revokeObjectURL(authorAvatar.value);

			const blob = URL.createObjectURL(photo);
			authorAvatar.value = blob;
		}
	},
	{ immediate: true }
);

onBeforeUnmount(() => {
	if (authorAvatar.value && authorAvatar.value.startsWith('blob:'))
		URL.revokeObjectURL(authorAvatar.value);
});

const authorAvatarChipColor = ref<any | null>(null);
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

	const author = props.prompt.owner;
	switch (author.account.account_type) {
		case 'ORGANIZER':
			authorAvatarChipColor.value = 'warning';
			break;
		case 'ADMINISTRATOR':
			authorAvatarChipColor.value = 'error';
			break;
	}
	footer.value = `@${author.username} - ${time.value}`;
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
