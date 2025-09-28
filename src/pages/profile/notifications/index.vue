<template>
	<ClientOnly>
		<div
			v-if="user"
			class="w-full h-full px-12 py-4"
		>
			<h1 class="text-2xl font-bold text-white">Notifications for @{{ user.username }}</h1>
			<h5 class="text-md mb-4 text-gray-300 light:text-gray-500">{{ unreadCount }} unread</h5>
			<UserNotificationList :additional="true" />
		</div>
		<div
			v-else
			class="w-full h-full flex items-center justify-center"
		>
			<p class="text-gray-400 light:text-gray-600 mb-4">
				You need to be logged in to view your notifications.
			</p>
		</div>
	</ClientOnly>
</template>

<script setup lang="ts">
import { useAuth, useNotifications } from '~/compostables/useUser';

const { user } = useAuth();
const { unreadCount } = useNotifications();
</script>
