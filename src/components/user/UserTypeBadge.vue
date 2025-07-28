<template>
	<UBadge
		v-if="props.user.account.account_type !== 'FREE'"
		:label="badgeLabel"
		:class="badgeStyling"
		class="px-3 py-1 rounded-full text-white text-sm font-semibold"
	/>
</template>

<script setup lang="ts">
import type { User } from '~/shared/types/user';

const props = defineProps<{
	user: User;
}>();

const badgeLabel = computed(() => {
	const type = props.user.account.account_type;
	return type.at(0)?.toUpperCase() + type.slice(1).toLowerCase();
});

const badgeStyling = computed(() => {
	switch (props.user.account.account_type) {
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
</script>
