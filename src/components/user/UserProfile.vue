<template>
	<div class="flex flex-col items-center w-full mt-6">
		<div class="flex flex-col items-center mb-8">
			<UAvatar
				:src="avatar"
				class="w-32 h-32 rounded-full shadow-lg shadow-black/50 mb-4 hover:scale-110 transition-transform duration-300"
			/>
			<div class="flex">
				<h1 class="text-3xl font-semibold">{{ props.user.fullName }}</h1>
				<UserTypeBadge
					:user="props.user"
					class="ml-3"
				/>
			</div>
			<span
				v-if="props.user.account.bio"
				class="mt-1 text-center max-w-md"
			>
				{{ props.user.account.bio }}
			</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import { com } from '@earth-app/ocean';
import { getUserAvatar } from '~/compostables/useUser';
import type { User } from '~/shared/types/user';

const props = defineProps<{
	user: User;
	title?: string;
}>();

const avatar = ref<string | undefined>(undefined);
let objectUrl: string | undefined = undefined;

onMounted(async () => {
	const res = await getUserAvatar(props.user.id);
	if (res.success && res.data) {
		if (objectUrl) URL.revokeObjectURL(objectUrl);

		objectUrl = URL.createObjectURL(res.data);
		avatar.value = objectUrl;
	}
});

onBeforeUnmount(() => {
	if (objectUrl) URL.revokeObjectURL(objectUrl);
});
</script>
