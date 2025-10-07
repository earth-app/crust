<template>
	<div class="flex flex-col items-center w-full mt-6">
		<div class="flex flex-col items-center mb-8">
			<UAvatar
				:src="avatar"
				class="size-20 sm:size-24 md:size-28 lg:size-32 rounded-full shadow-lg shadow-black/50 mb-4 hover:scale-110 transition-transform duration-300"
			/>
			<div class="flex flex-col md:flex-row">
				<h1 class="text-3xl font-semibold">
					{{ props.user.full_name || `@${props.user.username}` }}
				</h1>
				<UserTypeBadge
					:user="props.user"
					:editor="user?.account.account_type === 'ADMINISTRATOR'"
					class="ml-3 mt-1 mb-2"
				/>
			</div>
			<h2
				v-if="props.user.full_name"
				class="text-xl ml-2 text-gray-400"
			>
				@{{ props.user.username }}
			</h2>
			<span
				v-if="props.user.account.bio"
				class="mt-1 text-center max-w-md"
			>
				{{ props.user.account.bio }}
			</span>
		</div>
		<div class="flex mb-4">
			<UBadge
				v-if="props.user.account.email && props.user.account.email_verified"
				:label="props.user.account.email"
				variant="subtle"
				icon="mdi:mail-ru"
				class="mr-2 hover:cursor-pointer"
				@click="openEmail"
			/>
			<UBadge
				v-if="props.user.account.address"
				:label="props.user.account.address"
				variant="subtle"
				icon="mdi:map-marker"
				color="warning"
				class="mr-2"
			/>
			<UBadge
				v-if="props.user.account.country"
				:label="props.user.account.country"
				variant="subtle"
				icon="mdi:flag"
				color="info"
				class="mr-2"
			/>
		</div>
		<div class="flex items-center justify-center flex-wrap max-w-200">
			<UBadge
				v-for="(activity, i) in props.user.activities"
				:label="activity.name"
				:color="i <= 2 ? 'primary' : 'secondary'"
				:icon="activity.fields['icon']"
				:variant="badgeVariants[i] || 'outline'"
				@mouseenter="badgeVariants[i] = 'solid'"
				@mouseleave="badgeVariants[i] = 'outline'"
				@click="$router.push(`/activities/${activity.id}`)"
				:ui="{
					base: 'text-xs sm:text-sm md:text-md lg:text-base px-1 sm:px-1.5 md:px-2.5 py-1 gap-1 md:gap-1.5 rounded-sm sm:rounded-md',
					leadingIcon: 'size-4 sm:size-5 md:size-6'
				}"
				class="hover:cursor-pointer transition-all duration-500 ml-2 mb-2 sm:mb-3"
			/>
		</div>
		<div class="max-w-3xl mt-4">
			<UserJourneys :user="props.user" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { useAuth, useUser } from '~/compostables/useUser';
import type { User } from '~/shared/types/user';

const props = defineProps<{
	user: User;
	title?: string;
}>();

const { user } = useAuth();
const { photo } = useUser(props.user.id);

const avatar = ref<string>('https://cdn.earth-app.com/earth-app.png');
watch(
	() => photo.value,
	(photo) => {
		if (photo) {
			if (avatar.value && avatar.value.startsWith('blob:')) URL.revokeObjectURL(avatar.value);

			const blob = URL.createObjectURL(photo);
			avatar.value = blob;
		}
	},
	{ immediate: true }
);

onBeforeUnmount(() => {
	if (avatar.value && avatar.value.startsWith('blob:')) URL.revokeObjectURL(avatar.value);
});

const badgeVariants = ref<('outline' | 'solid')[]>([]);

function openEmail() {
	if (!props.user.account.email && !props.user.account.email_verified) return;
	window.location.href = `mailto:${props.user.account.email}`;
}
</script>
