<template>
	<UModal
		:title="title || `Edit ${user.fullName || user.username}'s Profile`"
		:description="description"
		:close="{
			color: 'primary',
			variant: 'solid',
			icon: 'i-heroicons-x-mark-solid',
		}"
		:ui="{ content: content || 'min-w-1/3' }"
	>
		<slot />

		<template #body>
			<div class="flex flex-col gap-4 w-full">
				<UserProfileEditor :user="user" />
			</div>
		</template>
	</UModal>
</template>

<script setup lang="ts">
import type { User } from '~/shared/types/user';

const props = defineProps<{
	user: User;
	title?: string;
	description?: string;
	content?: string;
}>();

const user = props.user;
</script>
