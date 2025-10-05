<template>
	<ClientOnly>
		<div
			v-if="user && notification"
			class="w-full px-4 py-8"
		>
			<div class="flex flex-col items-center">
				<h2 class="text-lg font-semibold">{{ notification.title }}</h2>
				<UTooltip
					:text="relativeTime"
					arrow
				>
					<h3 class="text-md text-gray-400 mb-4">{{ time }}</h3>
				</UTooltip>
				<UChip
					:color="notification.type"
					:ui="{ base: 'size-4 lg:size-6' }"
					:title="capitalizeFully(notification.type)"
				>
					<div
						class="p-4 bg-gray-800 border-2 border-gray-200 light:border-gray-400 rounded-lg w-full max-w-3xl"
					>
						<p
							class="text-gray-300 text-sm md:text-md lg:text-lg mb-4"
							v-html="message"
						></p>
						<USeparator
							v-if="notification.link"
							class="my-4"
						/>
						<a
							v-if="notification.link"
							:href="notification.link"
							class="text-blue-400 hover:underline break-all"
						>
							{{ notification.link }}
						</a>
						<p class="text-gray-500 text-xs mt-2">
							From: {{ notification.source }} | Type: {{ capitalizeFully(notification.type) }} | ID:
							{{ notification.id }}
						</p>
					</div>
				</UChip>
			</div>
		</div>
		<div
			v-else-if="user && notification === undefined"
			class="flex flex-col items-center justify-center h-screen"
		>
			<p class="text-gray-600">Loading notification...</p>
		</div>
		<div
			v-else-if="user && notification === null"
			class="flex flex-col items-center justify-center h-screen"
		>
			<p class="text-gray-600">Notification doesn't exist. Maybe look at the URL again?</p>
		</div>
		<div
			v-else
			class="flex flex-col w-full h-full items-center justify-center"
		>
			<p class="text-center text-gray-600">Please log in to view your notifications.</p>
		</div>
	</ClientOnly>
</template>
<script setup lang="ts">
import { DateTime } from 'luxon';
import { useTitleSuffix } from '~/compostables/useTitleSuffix';
import { markNotificationRead, useAuth, useNotification } from '~/compostables/useUser';
import { capitalizeFully } from '~/shared/util';

const { user } = useAuth();
const route = useRoute();
const { setTitleSuffix } = useTitleSuffix();

const { notification } = useNotification(route.params.id as string);
watch(
	() => notification.value,
	(notification) => {
		if (notification && !notification.read) {
			markAsRead();
		}

		setTitleSuffix(notification ? notification.title : 'Notification');
	}
);

const i18n = useI18n();
const time = computed(() => {
	if (!notification.value) return '';
	const time = DateTime.fromMillis(notification.value.created_at * 1000).setLocale(
		i18n.locale.value
	);

	return time.toLocaleString(DateTime.DATETIME_FULL_WITH_SECONDS);
});

const relativeTime = computed(() => {
	if (!notification.value) return '';
	const time = DateTime.fromMillis(notification.value.created_at * 1000).setLocale(
		i18n.locale.value
	);

	return time.toRelative() || time.toLocaleString(DateTime.DATETIME_SHORT);
});

const message = computed(() => {
	if (!notification.value) return;

	return notification.value.message.replace(/\n/g, '<br />').replace(/\t/g, '');
});

async function markAsRead() {
	if (notification.value && !notification.value.read) {
		const res = await markNotificationRead(notification.value.id);
		if (res.success) {
			notification.value.read = true;
		} else {
			console.error('Failed to mark notification as read:', res.message);

			const toast = useToast();
			toast.add({
				title: 'Error',
				description: res.message || 'Failed to mark notification as read.',
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 5000
			});
		}
	}
}
</script>
