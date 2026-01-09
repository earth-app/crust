<template>
	<ClientOnly>
		<UDropdownMenu
			:items="items"
			:admin="admin"
			:ui="{ content: content || 'w-48' }"
		>
			<slot />

			<UserEditModal
				v-if="admin"
				v-model:open="editUserOpen"
				:user="user"
				content="min-w-1/2"
			/>
		</UDropdownMenu>
		<template #fallback>
			<slot />
		</template>
	</ClientOnly>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
import type { User } from '~/shared/types/user';

const props = defineProps<{
	user: User;
	admin?: boolean;
	mode?: 'hover' | 'click';
	content?: string;
}>();

const user = props.user;
const router = useRouter();

const { name } = useDisplayName(user);

const editUserOpen = ref(false);

let adminItems: DropdownMenuItem[] = [
	{
		label: 'Edit Profile',
		icon: 'flowbite:edit-solid',
		onSelect: () => (editUserOpen.value = true)
	},
	{
		label: 'Send Email',
		icon: 'mdi:email-outline',
		onSelect: () => navigateTo(`mailto:${user.account.email}`)
	},
	{
		label: `Email ${user.account.email_verified ? 'Verified' : 'Unverified'}`,
		icon: user.account.email_verified ? 'mdi:email-check-outline' : 'mdi:email-alert-outline'
	}
];

const items = ref<DropdownMenuItem[][]>([
	[
		{
			label: name.value,
			icon: 'flowbite:profile-card-solid'
		}
	],
	[
		{
			label: 'View Profile',
			icon: 'mdi:account',
			onSelect: () => router.push(`/profile/${user.id}`)
		}
	]
]);

if (props.admin) {
	items.value.push(adminItems as any);
}
</script>
