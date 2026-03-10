<template>
	<div class="flex flex-col">
		<UAvatar
			:src="avatar || '/cloud.png'"
			size="xl"
			class="-mb-1"
		/>
		<p class="font-medium text-lg bg-gray-100 dark:bg-gray-800 p-2 rounded-lg">
			"{{ text }}" -
			<NuxtLink
				:to="`/profile/@${username || 'cloud'}`"
				class="text-blue-600 font-semibold"
				>@${username || 'cloud'}</NuxtLink
			>
		</p>
		<p
			v-if="timestamp"
			class="opacity-80 text-sm mt-2"
		>
			{{ formatTimestamp(timestamp) }}
		</p>
	</div>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';

defineProps<{
	text: string;
	timestamp?: number;
	avatar?: string;
	username?: string;
}>();

const i18n = useI18n();
function formatTimestamp(timestamp: number) {
	return DateTime.fromMillis(timestamp).toLocaleString(DateTime.DATETIME_MED_WITH_WEEKDAY, {
		locale: i18n.locale.value
	});
}
</script>
