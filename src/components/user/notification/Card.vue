<template>
	<div
		class="min-w-60 border border-gray-700 rounded-lg p-4 mb-4 transition-opacity bg-linear-to-tl via-gray-500/20 to-transparent hover:opacity-90"
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
					class="text-xs sm:text-sm md:text-md text-gray-300 light:text-gray-700 whitespace-pre-line"
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
					v-if="type === 'error'"
					name="mdi:alert-circle-outline"
					class="text-red-400 size-3 sm:size-6"
					title="Error Notification"
				/>
				<UIcon
					v-else-if="type === 'warning'"
					name="mdi:alert-outline"
					class="text-yellow-400 size-3 sm:size-6"
					size="20"
					title="Warning Notification"
				/>
				<UIcon
					v-else-if="type === 'success' && additional"
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
					@click="confirmDeleteOpen = true"
				/>
			</div>
		</div>

		<UModal
			v-if="additional"
			v-model:open="confirmDeleteOpen"
			title="Delete Notification?"
			description="This notification will be permanently removed."
		>
			<template #footer>
				<div class="flex w-full justify-end gap-2">
					<UButton
						color="neutral"
						variant="ghost"
						:disabled="deleting"
						@click="confirmDeleteOpen = false"
						>Cancel</UButton
					>
					<UButton
						color="error"
						icon="mdi:trash-can"
						:loading="deleting"
						:disabled="deleting"
						@click="confirmRemove"
						>Delete</UButton
					>
				</div>
			</template>
		</UModal>
	</div>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import { trimString } from 'utils';
import { runOrQueue } from '~/composables/useNetwork';

const props = defineProps<{
	notification: UserNotification;
	additional?: boolean;
}>();

const type = computed(() => props.notification.type || 'info');

const emit = defineEmits<{
	(event: 'deleted', notification: UserNotification): void;
}>();
const { markNotificationRead } = useNotifications();

const timestamp = computed(() => {
	const time = DateTime.fromMillis(props.notification.created_at * 1000);
	return time.toRelative() || time.toLocaleString(DateTime.DATETIME_SHORT);
});

const fullTimestamp = computed(() => {
	const time = DateTime.fromMillis(props.notification.created_at * 1000);
	return time.toLocaleString(DateTime.DATETIME_MED_WITH_WEEKDAY);
});

async function markAsRead() {
	if (props.notification.read) return;
	// If offline (or the call fails with a network error), queue the mutation
	// rather than surfacing an error. mark-as-read is idempotent so replay is safe.
	const outcome = await runOrQueue(
		'mark-read',
		{ id: props.notification.id },
		async () => await markNotificationRead(props.notification.id)
	);
	if (outcome.queued) return;
	if (outcome.executed && outcome.result && !outcome.result.success) {
		console.error('Failed to mark notification as read:', outcome.result.message);
		const toast = useToast();
		toast.add({
			title: 'Error',
			description: outcome.result.message || 'Failed to mark notification as read.',
			icon: 'mdi:alert-circle',
			color: 'error'
		});
	}
}

const confirmDeleteOpen = ref(false);
const deleting = ref(false);

async function confirmRemove() {
	if (deleting.value) return;
	deleting.value = true;
	const toast = useToast();
	try {
		const res = await deleteNotification(props.notification.id);
		if (res.success) {
			emit('deleted', props.notification);
			confirmDeleteOpen.value = false;
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
	} finally {
		deleting.value = false;
	}
}
</script>
