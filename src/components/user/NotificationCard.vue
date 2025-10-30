<template>
	<div
		class="min-w-60 border border-gray-700 rounded-lg p-4 mb-4 bg-gray-800 hover:bg-gray-700 transition-colors"
	>
		<div class="flex justify-between items-start">
			<div>
				<NuxtLink :to="`/profile/notifications/${notification.id}`">
					<p
						class="text-sm sm:text-md text-blue-400 light:text-gray-700 mb-2"
						:style="{ fontWeight: notification.read ? 'normal' : 'bold' }"
					>
						{{ notification.title }}
					</p>
				</NuxtLink>

				<p
					class="text-xs sm:text-sm md:text-md text-gray-300 light:text-gray-700"
					:style="{ fontWeight: notification.read ? 'normal' : 'bold' }"
				>
					{{ trimString(notification.message, 50) }}
				</p>
				<p class="text-xs md:text-sm text-gray-400 light:text-gray-800">
					{{ timestamp }} • {{ fullTimestamp }}
				</p>
				<p class="text-xs md:text-sm text-gray-600 light:text-gray-300 mt-2">
					{{ notification.source }} | ID: {{ notification.id }}
				</p>
			</div>
			<div class="flex items-center">
				<UIcon
					v-if="notification.type === 'error'"
					name="mdi:alert-circle-outline"
					class="text-red-400 size-3 sm:size-6"
					title="Error Notification"
				/>
				<UIcon
					v-else-if="notification.type === 'warning'"
					name="mdi:alert-outline"
					class="text-yellow-400 size-3 sm:size-6"
					size="20"
					title="Warning Notification"
				/>
				<UIcon
					v-else-if="notification.type === 'success' && additional"
					name="mdi:check-circle-outline"
					class="text-green-400 size-3 sm:size-6"
					title="Success Notification"
					size="20"
				/>
				<div
					v-if="!notification.read"
					class="mx-2"
				>
					<span
						class="inline-block size-3 bg-blue-500 rounded-full hover:cursor-pointer"
						title="Mark as Read"
						@click="markAsRead"
					></span>
				</div>
				<UIcon
					v-if="additional"
					name="mdi:delete"
					class="size-4 sm:size-5 md:size-6 text-gray-500 hover:text-red-500 hover:cursor-pointer transition-colors duration-200"
					title="Delete Notification"
					@click="deleteNotification"
				/>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import {
	markNotificationRead,
	deleteNotification as removeNotification
} from '~/composables/useUser';
import type { UserNotification } from '~/shared/types/user';
import { trimString } from '~/shared/util';

const props = defineProps<{
	notification: UserNotification;
	additional?: boolean;
}>();

const emit = defineEmits<{
	(event: 'deleted', notification: UserNotification): void;
}>();

const timestamp = computed(() => {
	const time = DateTime.fromMillis(props.notification.created_at * 1000);
	return time.toRelative() || time.toLocaleString(DateTime.DATETIME_SHORT);
});

const fullTimestamp = computed(() => {
	const time = DateTime.fromMillis(props.notification.created_at * 1000);
	return time.toLocaleString(DateTime.DATETIME_MED_WITH_WEEKDAY);
});

async function markAsRead() {
	if (!props.notification.read) {
		const res = await markNotificationRead(props.notification.id);
		if (res.success) {
			props.notification.read = true;
		} else {
			console.error('Failed to mark notification as read:', res.message);

			const toast = useToast();
			toast.add({
				title: 'Error',
				description: res.message || 'Failed to mark notification as read.',
				icon: 'mdi:alert-circle',
				color: 'error'
			});
		}
	}
}

async function deleteNotification() {
	const res = await removeNotification(props.notification.id);
	const toast = useToast();

	if (res.success) {
		emit('deleted', props.notification);

		toast.add({
			title: 'Success',
			description: 'Notification deleted successfully.',
			icon: 'mdi:trash-can-outline',
			color: 'success'
		});
	} else {
		console.error('Failed to delete notification:', res.message);

		toast.add({
			title: 'Error',
			description: res.message || 'Failed to delete notification.',
			icon: 'mdi:delete-alert-outline',
			color: 'error'
		});
	}
}
</script>
