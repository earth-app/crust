<template>
	<UDropdownMenu
		:items="items"
		:ui="{ content: 'w-48' }"
	>
		<template #item="{ item }">
			<button
				class="flex items-center w-full px-2 py-1.5 gap-2 text-left"
				@click="selected = item.value"
			>
				<UIcon
					name="i-heroicons-check"
					class="w-4 h-4 text-primary"
					v-show="selected === item.value"
				/>
				<div class="flex flex-col">
					<span class="font-medium text-sm">{{ item.label }}</span>
					<span
						v-if="item.description"
						class="text-xs text-gray-500"
						>{{ item.description }}</span
					>
				</div>
			</button>
		</template>
	</UDropdownMenu>
</template>

<script setup lang="ts">
import type { User } from '~/shared/types/user';
import { com } from '@earth-app/ocean';
import type { DropdownMenuItem } from '@nuxt/ui';

const props = defineProps<{
	user: User;
	field: keyof User['account']['visibility'];
}>();

const user = props.user;
const selected = ref(user.account.visibility[props.field]);

const icons = ['mdi:lock', 'mdi:circle-outline', 'mdi:account-box', 'mdi:office-building'];
const descriptions = [
	'Only you can see',
	'Your choose who can see',
	'Your mutual friends can see',
	'Everyone can see'
];

const items = ref<DropdownMenuItem[]>(
	com.earthapp.account.Privacy.values().map((value) => ({
		label: value.name.charAt(0).toUpperCase() + value.name.slice(1).toLowerCase(),
		icon: icons[value.ordinal],
		description: descriptions[value.ordinal],
		checked: selected.value === value.name
	}))
);
</script>
