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
			<h2 class="mb-4 text-gray-400">
				{{ notificationsCount }} Notifications
				{{ displayed.length !== notificationsCount ? `(${displayed.length} shown)` : '' }}
			</h2>
			<UserNotificationCard
				v-for="notification in displayed"
				:key="notification.id"
				:notification="notification"
				:additional="additional"
				@deleted="handleDelete"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { type UserNotification } from '~/shared/types/user';

const props = defineProps<{
	additional?: boolean;
}>();

const { notifications } = useNotifications();
const notificationsCount = ref(notifications.value.length);
watch(
	() => notifications.value.length,
	(newLength) => {
		notificationsCount.value = newLength;
	}
);

const displayed = ref<UserNotification[]>([]);

// Limit to 4 if not additional
if (!props.additional) {
	displayed.value = notifications.value.slice(0, 4);
} else {
	displayed.value = notifications.value;
}

function handleDelete(notification: UserNotification) {
	notifications.value = notifications.value.filter((n) => n.id !== notification.id);
	displayed.value = displayed.value.filter((n) => n.id !== notification.id);
}
</script>
