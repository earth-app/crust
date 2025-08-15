<template>
	<div
		id="navbar"
		class="bg-secondary-800 border-b-primary-500 border-b-8 text-white p-4 flex items-center"
	>
		<div class="flex items-center w-2/3">
			<a href="/">
				<img
					src="/favicon.png"
					alt="Earth App Logo"
					class="min-w-8 w-8 h-auto xl:w-12 inline-block mr-2 shadow-lg shadow-black/50 rounded-full hover:scale-105 transition-transform duration-300"
				/>
			</a>
			<Discover class="mx-2 sm:ml-4 md:ml-8 lg:ml-12" />
			<div class="hidden sm:flex items-center mr-12 space-x-4">
				<a
					href="/activities"
					class="text-md md:text-xl lg:text-2xl font-semibold hover:text-gray-300 mx-6"
					>Activities</a
				>
				<a
					href="/prompts"
					class="text-md md:text-xl lg:text-2xl font-semibold hover:text-gray-300 mx-6"
					>Prompts</a
				>
			</div>
		</div>
		<div class="ml-auto">
			<div
				v-if="user"
				class="flex items-center space-x-1 sm:space-x-6"
			>
				<div
					class="flex items-center justify-center space-x-1 cursor-pointer hover:opacity-80 transition-opacity duration-250"
					@click="$router.push(`/profile/@${user.username}`)"
				>
					<ClientOnly>
						<UAvatar
							:src="avatarUrl"
							class="size-6 md:size-8 lg:size-12 rounded-full shadow-lg shadow-black/50"
						/>

						<span
							class="font-title text-md sm:text-lg md:text-xl text-shadow-2xs text-shadow-black"
							>{{ user.username }}</span
						>
					</ClientOnly>
				</div>
				<UIcon
					name="material-symbols:settings-rounded"
					class="size-4 lg:size-8 text-white cursor-pointer hover:scale-105 transition-transform duration-300"
					@click="$router.push('/profile')"
				/>
			</div>
			<UserLoginPopup v-else />
		</div>
	</div>
</template>

<script setup lang="ts">
import { useAuth } from '~/compostables/useUser';

const { user, photo } = useAuth();
const avatarUrl = ref<string>('/favicon.png');
let objectUrl: string | undefined = undefined;

watch(
	photo,
	(newPhoto) => {
		if (objectUrl) {
			URL.revokeObjectURL(objectUrl);
			objectUrl = undefined;
		}

		if (newPhoto) {
			objectUrl = URL.createObjectURL(newPhoto);
			avatarUrl.value = objectUrl;
		}
	},
	{ immediate: true }
);

onBeforeUnmount(() => {
	if (objectUrl) URL.revokeObjectURL(objectUrl);
});
</script>
