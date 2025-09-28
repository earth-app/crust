<template>
	<div
		class="w-full h-full overflow-y-auto p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-lg"
	>
		<div
			v-if="notifications.length === 0"
			class="text-gray-400 light:text-gray-600"
		>
			No notifications
		</div>
		<div v-else>
			<UserNotificationCard
				v-for="notification in notifications"
				:key="notification.id"
				:notification="notification"
				:additional="additional"
				@deleted="
					(notification) => (notifications = notifications.filter((n) => n.id !== notification.id))
				"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useNotifications } from '~/compostables/useUser';

defineProps<{
	additional?: boolean;
}>();

const { notifications } = useNotifications();
</script>
