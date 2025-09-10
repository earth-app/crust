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

const editUserOpen = ref(false);

let adminItems: DropdownMenuItem[] = [
	{
		label: 'Edit Profile',
		icon: 'flowbite:edit-solid',
		onSelect: () => (editUserOpen.value = true)
	}
];

const items = ref<DropdownMenuItem[][]>([
	[
		{
			label: user.full_name || user.username,
			icon: 'flowbite:profile-card-solid'
		}
	],
	[]
]);

if (props.admin) {
	items.value.push(adminItems as any);
}
</script>
