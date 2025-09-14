<template>
	<ClientOnly>
		<InfoCard
			:external="false"
			variant="subtle"
			:title="identifier"
			:content="response.response"
			:footer="time"
			:footer-tooltip="
				response.updated_at && response.created_at.toString() !== response.updated_at?.toString()
					? `${response.created_at} (edited ${response.updated_at})`
					: response.created_at
			"
			:secondary-footer="response.id"
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
		/>
	</ClientOnly>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import { getUser, getUserAvatar } from '~/compostables/useUser';
import type { PromptResponse } from '~/shared/types/prompts';
import type { User } from '~/shared/types/user';

const props = defineProps<{
	response: PromptResponse;
}>();

const i18n = useI18n();
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

onMounted(async () => {
	if (props.response.owner_id) {
		user.value = await getUser(props.response.owner_id).then((res) => {
			if (res.success && res.data) {
				return res.data;
			}

			return null;
		});

		userAvatar.value = await getUserAvatar(props.response.owner_id).then((res) => {
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
</script>
