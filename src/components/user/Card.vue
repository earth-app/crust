<template>
	<div
		class="flex flex-col p-4 bg-gray-800 light:bg-gray-100 rounded-lg shadow-md border-2 border-gray-700 light:border-gray-300"
	>
		<div class="flex">
			<UUser
				:to="`/profile/@${user.username}`"
				:name="user.full_name"
				:description="`@${user.username}`"
				:avatar="
					user.account?.avatar_url
						? { src: `${user.account.avatar_url}?size=128`, loading: 'lazy', alt: user.username }
						: undefined
				"
				size="xl"
				class="mr-2"
			/>

			<UBadge
				v-if="user.is_in_my_circle"
				variant="soft"
				color="warning"
				icon="mdi:account-group"
				label="In Your Circle"
				class="ml-4 self-center"
				size="lg"
			/>

			<UBadge
				v-if="user.id === currentUser?.id"
				variant="soft"
				color="primary"
				icon="mdi:account-check"
				label="You"
				class="ml-4 self-center"
				size="lg"
			/>

			<UserTypeBadge
				:user="user"
				class="ml-4 self-center"
			/>
		</div>
		<div
			v-if="user.activities && user.activities.length > 0"
			class="flex gap-2 mt-4 flex-wrap"
		>
			<NuxtLink
				v-for="(activity, i) in user.activities"
				:key="activity.id"
				:to="`/activities/${activity.id}`"
				target="_blank"
			>
				<UBadge
					:label="activity.name"
					:icon="activity.fields['icon'] || 'mdi:earth'"
					:variant="badgeVariants[i] || 'subtle'"
					@mouseenter="badgeVariants[i] = 'solid'"
					@mouseleave="badgeVariants[i] = 'subtle'"
					class="hover:cursor-pointer transition-all duration-500"
				/>
			</NuxtLink>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { User } from '~/shared/types/user';

const badgeVariants = ref<('subtle' | 'solid')[]>([]);

const props = defineProps<{
	user: User;
}>();

const { user: currentUser } = useAuth();
const { chipColor } = useUser(props.user.id);
</script>
