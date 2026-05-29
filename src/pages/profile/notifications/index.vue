<template>
	<div
		v-if="user"
		class="w-full h-full px-2 sm:px-4 md:px-8 lg:px-12 py-4 mt-24 sm:mt-0"
	>
		<div class="flex items-center gap-2">
			<h1
				id="notifications-title"
				class="text-2xl font-bold text-white"
			>
				Notifications for @{{ user.username }}
			</h1>
			<UButton
				icon="mdi:progress-question"
				color="secondary"
				variant="subtle"
				@click="startTour('notifications')"
			/>
		</div>
		<h5
			id="notifications-count"
			class="text-md mb-4 text-gray-300 light:text-gray-500"
		>
			{{ unreadCount }} unread
		</h5>
		<div id="notifications-list">
			<UserNotificationList :additional="true" />
		</div>
	</div>
	<Loading v-else-if="user === undefined" />
	<!-- Only show message when user is explicitly null (not loading) -->
	<div
		v-else-if="user === null"
		class="w-full h-full flex items-center justify-center"
	>
		<p class="text-gray-400 light:text-gray-600 mb-4">
			You need to be logged in to view your notifications.
		</p>
	</div>

	<ClientOnly>
		<SiteTour
			:steps="notificationsTour"
			name="Notifications Tour"
			tour-id="notifications"
		/>
	</ClientOnly>
</template>

<script setup lang="ts">
const toast = useToast();
const { user } = useAuth();
const { unreadCount, fetch, markAllNotificationsRead } = useNotifications();
const { startTour, startTourIfNew } = useSiteTour();

onMounted(() => {
	fetch();
	// auto-show the first time a user lands on their notifications page
	startTourIfNew('notifications');
});

const notificationsTour = computed<SiteTourStep[]>(() => [
	{
		id: 'notifications-title',
		title: 'Your Notifications',
		description:
			'Everything that needs your attention lands here: friend requests, replies, quest progress, badge unlocks, event reminders, and important account messages.',
		footer: "You'll also see a count on the bell icon in the navigation bar.",
		icon: 'mdi:bell-outline',
		onEnter: () => fetch()
	},
	{
		id: 'notifications-count',
		title: 'Unread Count',
		description:
			'This is your current unread count. Opening a notification or clicking the message in the list marks it read automatically.',
		footer:
			unreadCount.value > 0
				? `You have ${unreadCount.value} unread. The bell in the navbar mirrors this number.`
				: 'The bell icon in the top bar mirrors this number across the site.',
		icon: 'mdi:counter',
		cta:
			unreadCount.value > 0
				? {
						label: 'Mark All as Read',
						icon: 'mdi:email-open-multiple-outline',
						color: 'info',
						advance: true,
						handler: async () => {
							try {
								await markAllNotificationsRead();
								toast.add({
									title: 'All Caught Up',
									description: 'Every notification has been marked as read.',
									icon: 'mdi:email-open-multiple-outline',
									color: 'success',
									duration: 3000
								});
							} catch (e: any) {
								toast.add({
									title: 'Could not mark all as read',
									description: e?.message,
									icon: 'mdi:alert-circle',
									color: 'error',
									duration: 4000
								});
							}
						}
					}
				: undefined
	},
	{
		id: 'notifications-list',
		title: 'Notification Feed',
		description:
			'Each notification has an action - visit a profile, view a quest, open an event. Notifications older than a few weeks are archived automatically.',
		footer:
			"Manage which kinds of notifications you receive from your profile's Email Notifications switch.",
		icon: 'mdi:format-list-bulleted',
		highlightPadding: 8,
		waitFor: 'notifications-list'
	}
]);
</script>
