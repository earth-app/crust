<template>
	<ClientOnly>
		<div class="w-full flex items-center justify-center my-8">
			<InfoCard
				:title="prompt.prompt"
				:description="author?.full_name"
				:avatar="authorAvatar || 'https://cdn.earth-app.com/earth-app.png'"
				avatar-size="xl"
				:avatar-chip="authorAvatarChipColor ? true : false"
				:avatar-chip-color="authorAvatarChipColor"
				avatar-chip-size="xl"
				:link="noLink ? undefined : `/prompts/${prompt.id}`"
				:footer="`${footer} • ${responsesCount ? withSuffix(responsesCount) + ' Responses' : 'No Responses'}`"
				:secondary-footer="secondaryFooter"
			/>
		</div>
	</ClientOnly>
</template>

<script setup lang="ts">
import { getPromptResponsesCount } from '~/compostables/usePrompt';
import { getUser, getUserAvatar } from '~/compostables/useUser';
import type { Prompt } from '~/shared/types/prompts';
import { type User } from '~/shared/types/user';
import { withSuffix } from '~/shared/util';

const props = defineProps<{
	prompt: Prompt;
	noLink?: boolean;
}>();

const author = ref<User | null>(null);
const footer = ref<string | undefined>(undefined);
const secondaryFooter = ref<string | undefined>(undefined);
const authorAvatar = ref<string | null>(null);
const authorAvatarChipColor = ref<any | null>(null);
const responsesCount = ref<number | null>(null);

onMounted(async () => {
	secondaryFooter.value = props.prompt.id;

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
		} else {
			author.value = null;
			footer.value = `Unknown User - ${props.prompt.created_at}`;
			secondaryFooter.value = props.prompt.id;
		}
	}

	const resCount = await getPromptResponsesCount(props.prompt.id);
	if (resCount.success && resCount.data) {
		responsesCount.value = resCount.data;
	}
});

onUnmounted(() => {
	if (authorAvatar.value) {
		URL.revokeObjectURL(authorAvatar.value);
	}
});
</script>
