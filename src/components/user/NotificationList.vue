<template>
	<div
		class="min-w-90 w-full h-full overflow-y-auto p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-lg"
	>
		<div
			v-if="notifications.length === 0"
			class="text-gray-400 light:text-gray-600"
		>
			No notifications
		</div>
		<div v-else>
			<div class="flex justify-between">
				<h2 class="text-sm sm:text-md mb-4 text-gray-400">
					{{ notificationsCount }} Notifications
					{{ displayed.length !== notificationsCount ? `(${displayed.length} shown)` : '' }}
				</h2>
				<div class="flex space-x-8 font-medium">
					<h2
						class="text-sm sm:text-md mb-4 text-gray-400 hover:cursor-pointer"
						@click="notifications.forEach((n) => (n.read = true))"
					>
						Mark All as Read
					</h2>
					<h2
						class="text-sm sm:text-md mb-4 text-gray-400 hover:cursor-pointer"
						@click="notifications.splice(0, notifications.length)"
					>
						Clear All
					</h2>
				</div>
			</div>
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
import { type UserNotification } from '../../shared/types/user';

const props = defineProps<{
	additional?: boolean;
}>();

const { notifications } = useNotifications();

const displayed = computed(() => {
	return props.additional ? notifications.value : notifications.value.slice(0, 4);
});

const notificationsCount = computed(() => notifications.value.length);

function handleDelete(notification: UserNotification) {
	const index = notifications.value.findIndex((n) => n.id === notification.id);
	if (index !== -1) {
		notifications.value.splice(index, 1);
	}
}
</script>
