<template>
	<ClientOnly>
		<div class="w-full flex items-center justify-center my-8">
			<InfoCard
				:external="false"
				variant="subtle"
				:title="identifier"
				:content="responseText"
				:footer="time"
				:footer-tooltip="tooltip"
				:avatar="userAvatar || 'https://cdn.earth-app.com/earth-app.png'"
				avatar-size="md"
				:avatar-chip="user?.account.account_type ? true : false"
				:avatar-chip-color="
					user?.account.account_type === 'ORGANIZER'
						? 'warning'
						: user?.account.account_type === 'ADMINISTRATOR'
							? 'error'
							: undefined
				"
				:buttons="
					hasButtons
						? [
								{
									text: 'Edit Response',
									color: 'secondary',
									onClick: () => {
										editOpen = true;
									}
								},
								{
									text: 'Delete Response',
									color: 'error',
									onClick: () => {
										deleteResponse();
									}
								}
							]
						: undefined
				"
			/>
		</div>
		<UModal
			v-if="hasButtons"
			title="Edit Prompt Response"
			size="2xl"
			:closeable="true"
			v-model:open="editOpen"
			:overlay="false"
		>
			<template #body>
				<div class="flex flex-col space-y-4">
					<h2 class="font-medium">New Response:</h2>
					<UInput v-model="responseText" />
					<UButton
						@click="saveResponse"
						:loading="editLoading"
						:disabled="editLoading || responseText.trim().length === 0"
						>Save</UButton
					>
				</div>
			</template>
		</UModal>
	</ClientOnly>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import { removePromptResponse, updatePromptResponse } from '~/compostables/usePrompt';
import { getUserAvatar } from '~/compostables/useUser';
import { type PromptResponse } from '~/shared/types/prompts';
import type { User } from '~/shared/types/user';

const props = defineProps<{
	response: PromptResponse;
}>();

const emit = defineEmits<{
	(event: 'deleted'): void;
}>();

const i18n = useI18n();
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const user = ref<User | null>(null);
const identifier = computed(
	() => user.value?.full_name || `@${user.value?.username || 'anonymous'}`
);
const userAvatar = ref<string | null>(null);

const time = computed(() => {
	const created = DateTime.fromISO(props.response.created_at, {
		zone: 'utc'
	});

	let str = created.toRelative({
		locale: i18n.locale.value,
		round: true
	});
	if (props.response.updated_at && props.response.created_at !== props.response.updated_at) {
		const updated = DateTime.fromISO(props.response.updated_at, {
			zone: 'utc'
		});
		str += ` (edited ${updated.toRelative({ locale: i18n.locale.value, round: true }) || 'at some point'})`;
	}

	return str || 'Whenever';
});

const tooltip = computed(() => {
	const created = DateTime.fromISO(props.response.created_at, {
		zone: timezone
	}).toLocaleString(DateTime.DATETIME_FULL_WITH_SECONDS);

	if (props.response.updated_at && props.response.created_at !== props.response.updated_at) {
		const updated = DateTime.fromISO(props.response.updated_at, {
			zone: timezone
		}).toLocaleString(DateTime.DATETIME_FULL_WITH_SECONDS);
		return `${created} (edited ${updated})`;
	}

	return created;
});

onMounted(async () => {
	if (props.response.owner) {
		user.value = props.response.owner;
		userAvatar.value = await getUserAvatar(props.response.owner.id).then((res) => {
			if (res.success && res.data) {
				const blob = res.data;
				return URL.createObjectURL(blob);
			}
			return null;
		});
	}
});

onUnmounted(() => {
	if (userAvatar.value) {
		URL.revokeObjectURL(userAvatar.value);
	}
});

const hasButtons = computed(() => {
	return (
		user.value &&
		(user.value.id === props.response.owner.id ||
			user.value.account.account_type === 'ADMINISTRATOR')
	);
});

const responseText = ref(props.response.response);
watch(
	() => props.response,
	(newResponse) => {
		responseText.value = newResponse.response;
	}
);

const editOpen = ref(false);
const editLoading = ref(false);

async function saveResponse() {
	editLoading.value = true;
	const toast = useToast();
	const res = await updatePromptResponse(
		props.response.prompt_id,
		props.response.id,
		responseText.value
	);

	if (res.success) {
		editOpen.value = false;

		toast.add({
			title: 'Prompt Response Updated',
			description: 'Your prompt response has been successfully updated.',
			icon: 'mdi:check',
			color: 'success',
			duration: 5000
		});
	} else {
		toast.add({
			title: 'Error',
			description: res.message || 'An unknown error occurred while updating your prompt response.',
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 7000
		});
	}

	editLoading.value = false;
}

async function deleteResponse() {
	const yes = confirm(
		'Are you sure you want to delete this response? This action cannot be undone.'
	);

	const toast = useToast();
	if (yes) {
		const res = await removePromptResponse(props.response.prompt_id, props.response.id);
		if (res.success) {
			toast.add({
				title: 'Prompt Response Deleted',
				description: 'Your prompt response has been successfully deleted.',
				icon: 'mdi:check',
				color: 'success',
				duration: 5000
			});

			emit('deleted');
		} else {
			toast.add({
				title: 'Error',
				description:
					res.message || 'An unknown error occurred while deleting your prompt response.',
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
