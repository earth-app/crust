<template>
	<div class="w-full flex items-center justify-center my-8">
		<InfoCard
			:title="prompt.prompt"
			:description="author?.fullName"
			:avatar="authorAvatar || 'https://cdn.earth-app.com/earth-app.png'"
			avatar-size="xl"
			:avatar-chip="authorAvatarChipColor ? true : false"
			:avatar-chip-color="authorAvatarChipColor"
			avatar-chip-size="xl"
			:footer="footer"
		/>
	</div>
</template>

<script setup lang="ts">
import { getUser, getUserAvatar } from '~/compostables/useUser';
import type { Prompt } from '~/shared/types/prompts';
import { type User } from '~/shared/types/user';

const props = defineProps<{
	prompt: Prompt;
}>();

const author = ref<User | null>(null);
const footer = ref<string | undefined>(undefined);
const authorAvatar = ref<string | null>(null);
const authorAvatarChipColor = ref<any | null>(null);

onMounted(async () => {
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
			footer.value = `@${author.value.username} - ${props.prompt.created_at}`;

			const avatar = await getUserAvatar(author.value.id);
			if (avatar.success && avatar.data) {
				const blob = avatar.data;
				authorAvatar.value = URL.createObjectURL(blob);
			}
		}
	}
});

onUnmounted(() => {
	if (authorAvatar.value) {
		URL.revokeObjectURL(authorAvatar.value);
	}
});
</script>
