<template>
	<div
		id="navbar"
		class="bg-secondary-800 border-b-primary-500 border-b-8 text-white p-4 flex items-center"
	>
		<div class="flex items-center">
			<a href="/">
				<img
					src="/favicon.png"
					alt="Earth App Logo"
					class="h-12 w-12 inline-block mr-2 shadow-lg shadow-black/50 rounded-full hover:scale-105 transition-transform duration-300"
				/>
			</a>
			<div class="flex items-center mr-12 space-x-4"></div>
		</div>
		<div class="ml-auto">
			<div
				v-if="user"
				class="flex items-center space-x-6"
			>
				<div
					class="flex items-center justify-center space-x-1 cursor-pointer hover:opacity-80 transition-opacity duration-250"
					@click="$router.push(`/profile/@${user.username}`)"
				>
					<UAvatar
						:src="avatarUrl"
						class="w-12 h-12 rounded-full shadow-lg shadow-black/50"
					/>
					<span class="font-title text-xl text-shadow-2xs text-shadow-black">{{
						user.username
					}}</span>
				</div>
				<UIcon
					name="material-symbols:settings-rounded"
					class="size-8 text-white cursor-pointer hover:scale-105 transition-transform duration-300"
					@click="$router.push('/profile')"
				/>
			</div>
			<LoginPopup v-else />
		</div>
	</div>
</template>

<script setup lang="ts">
import { useAuth, useCurrentAvatar } from '~/compostables/useUser';
import LoginPopup from './LoginPopup.vue';

const avatarUrl = ref<string | undefined>(undefined);
let objectUrl: string | undefined = undefined;

onMounted(async () => {
	const res = await useCurrentAvatar();
	if (res.success && res.data) {
		if (objectUrl) URL.revokeObjectURL(objectUrl);

		objectUrl = URL.createObjectURL(res.data);
		avatarUrl.value = objectUrl;
	}
});

onBeforeUnmount(() => {
	if (objectUrl) URL.revokeObjectURL(objectUrl);
});

const { user } = useAuth();
</script>
