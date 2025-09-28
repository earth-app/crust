<template>
	<div
		class="border border-gray-700 rounded-lg p-4 mb-4 bg-gray-800 hover:bg-gray-700 transition-colors"
	>
		<div class="flex justify-between items-start">
			<div>
				<NuxtLink :to="`/profile/notifications/${notification.id}`">
					<p
						v-if="!notification.read"
						class="text-blue-500 light:text-gray-600 font-semibold mb-2"
					>
						{{ notification.title }}
					</p>
					<p
						v-else
						class="text-blue-400 light:text-gray-700 mb-2"
					>
						{{ notification.title }}
					</p>
				</NuxtLink>

				<p class="text-gray-300 light:text-gray-700">
					{{ trimString(notification.message, 50) }}
				</p>
				<p class="text-gray-400 light:text-gray-800 text-sm">
					{{ timestamp }} • {{ fullTimestamp }}
				</p>
				<p class="text-gray-600 light:text-gray-300 text-sm mt-2">
					{{ notification.source }} | ID: {{ notification.id }}
				</p>
			</div>
			<div
				v-if="!notification.read"
				class="ml-4"
			>
				<span
					class="inline-block w-3 h-3 bg-blue-500 rounded-full hover:cursor-pointer"
					title="Mark as Read"
					@click="markAsRead"
				></span>
			</div>
			<UIcon
				v-if="additional"
				name="mdi:delete"
				:size="24"
				class="ml-4 text-gray-500 hover:text-red-500 hover:cursor-pointer transition-colors duration-200"
				title="Delete Notification"
				@click="deleteNotification"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import {
	markNotificationRead,
	deleteNotification as removeNotification
} from '~/compostables/useUser';
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
			icon: 'mdi:check-circle',
			color: 'success'
		});
	} else {
		console.error('Failed to delete notification:', res.message);

		toast.add({
			title: 'Error',
			description: res.message || 'Failed to delete notification.',
			icon: 'mdi:alert-circle',
			color: 'error'
		});
	}
}
</script>
