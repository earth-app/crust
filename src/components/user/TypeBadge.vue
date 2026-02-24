<template>
	<UDropdownMenu
		v-if="props.editor"
		arrow
		:items="editorItems"
	>
		<UBadge
			:label="badgeLabel"
			:class="badgeStyling"
			:ui="{ base: 'justify-center' }"
			class="px-1 sm:px-2 md:px-3 py-1 rounded-full text-white text-sm font-semibold hover:cursor-pointer"
		/>
	</UDropdownMenu>
	<UBadge
		v-else
		v-if="props.user.account?.account_type && props.user.account.account_type !== 'FREE'"
		:label="badgeLabel"
		:class="badgeStyling"
		:ui="{ base: 'justify-center' }"
		class="px-1 sm:px-2 md:px-3 py-1 rounded-full text-white text-sm font-semibold"
	/>
</template>

<script setup lang="ts">
import { com } from '@earth-app/ocean';
import type { User } from '~/shared/types/user';
import { capitalizeFully } from '~/shared/utils/util';

const props = defineProps<{
	user: User;
	editor?: boolean;
}>();

const badgeLabel = computed(() => {
	const type = props.user.account?.account_type;
	if (!type) return '';
	return type.at(0)?.toUpperCase() + type.slice(1).toLowerCase();
});

const badgeStyling = computed(() => {
	switch (props.user.account?.account_type) {
		case 'ADMINISTRATOR':
			return 'bg-red-500 font-bold';
		case 'ORGANIZER':
			return 'bg-green-500 font-semibold';
		case 'WRITER':
			return 'bg-yellow-500 font-medium';
		case 'PRO':
			return 'bg-blue-500';
		default:
			return 'bg-gray-500';
	}
});

const editorItems = props.editor
	? com.earthapp.account.AccountType.values().map((type) => ({
			label: capitalizeFully(type.name.replace('_', ' ')),
			value: type.name,
			disabled: type.name === props.user.account?.account_type,
			onSelect: () => handleSetAccountType(type.name)
		}))
	: [];

async function handleSetAccountType(type: typeof com.earthapp.account.AccountType.prototype.name) {
	const old = props.user.account.account_type;
	const toast = useToast();

	props.user.account.account_type = type;
	const res = await setAccountType(props.user.id, type);

	if (!res.success) {
		console.error('Failed to update account type:', res.message);
		props.user.account.account_type = old; // Revert on failure

		toast.add({
			title: 'Error',
			description: res.message || 'Failed to update account type. Please try again.',
			color: 'error',
			duration: 5000
		});
		return false;
	}

	toast.add({
		title: 'Success',
		description: `Account type updated to ${type} for @${props.user.username}.`,
		icon: 'mdi:check',
		color: 'success',
		duration: 3000
	});

	return true;
}
</script>
