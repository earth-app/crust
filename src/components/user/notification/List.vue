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
						@click="markAllRead"
					>
						Mark All as Read
					</h2>
					<h2
						class="text-sm sm:text-md mb-4 text-gray-400 hover:cursor-pointer"
						@click="confirmOpen = true"
					>
						Clear All
					</h2>
				</div>

				<UModal
					v-model:open="confirmOpen"
					title="Clear All Notifications?"
					description="This will permanently delete every notification on your account. This action cannot be undone."
				>
					<template #footer>
						<div class="flex w-full justify-end gap-2">
							<UButton
								color="neutral"
								variant="ghost"
								:disabled="clearing"
								@click="confirmOpen = false"
								>Cancel</UButton
							>
							<UButton
								color="error"
								icon="mdi:trash-can"
								:loading="clearing"
								:disabled="clearing"
								@click="confirmClearAll"
								>Clear All</UButton
							>
						</div>
					</template>
				</UModal>
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
const props = defineProps<{
	additional?: boolean;
}>();

import { runOrQueue } from '~/composables/useNetwork';

const { notifications, markAllNotificationsRead, clearAllNotifications } = useNotifications();
const toast = useToast();

const confirmOpen = ref(false);
const clearing = ref(false);

async function markAllRead() {
	const outcome = await runOrQueue('mark-all-read', undefined, async () => {
		return await markAllNotificationsRead();
	});
	if (outcome.queued) return;
	if (outcome.executed && outcome.result && !outcome.result.success) {
		toast.add({
			title: 'Error',
			description: outcome.result.message || 'Failed to mark all notifications as read.',
			icon: 'mdi:alert-circle',
			color: 'error'
		});
	}
}

async function confirmClearAll() {
	if (clearing.value) return;
	clearing.value = true;
	try {
		const res = await clearAllNotifications();
		if (!res.success) {
			toast.add({
				title: 'Error',
				description: res.message || 'Failed to clear notifications.',
				icon: 'mdi:alert-circle',
				color: 'error'
			});
		} else {
			confirmOpen.value = false;
		}
	} finally {
		clearing.value = false;
	}
}

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
