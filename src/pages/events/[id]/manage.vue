<template>
	<div class="flex flex-col items-center">
		<div
			v-if="event && user"
			class="flex flex-col items-center justify-center mt-4 w-full px-8"
		>
			<div class="flex">
				<UButton
					color="info"
					:to="`/events/${event.id}`"
					class="mb-4 self-start"
				>
					<UIcon
						name="mdi:arrow-left"
						class="size-5 mr-1"
					/>
					Back to Event
				</UButton>
				<UButton
					color="primary"
					class="mb-4 self-start ml-2"
					@click="attendeesDrawerRef?.open()"
				>
					<UIcon
						name="mdi:account-multiple"
						class="size-5 mr-1"
					/>
					View Attendees ({{ comma(event.attendee_count) }})
				</UButton>
			</div>
			<UCard class="w-full">
				<EventForm
					v-if="event"
					:event="event"
					mode="edit"
					@submitted="fetch"
				/>
			</UCard>

			<ContentDrawer
				ref="attendeesDrawerRef"
				:title="`Event Attendees (${comma(event.attendee_count)})`"
				:is-loading="false"
			>
				<UserCard
					v-for="attendee in allAttendees"
					:key="attendee.id"
					:user="attendee"
				/>
			</ContentDrawer>
		</div>
		<div
			v-else-if="event === null"
			class="flex flex-col items-center justify-center h-screen w-screen"
		>
			<p class="text-gray-600">Event doesn't exist. Maybe look at the URL again?</p>
		</div>
		<Loading v-else />
	</div>
</template>

<script setup lang="ts">
import type ContentDrawer from '~/components/ContentDrawer.vue';
import { comma } from '~/shared/util';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { setTitleSuffix } = useTitleSuffix();
const { user } = useAuth();
const { event, fetch, attendees, fetchAttendees } = useEvent(route.params.id as string);

// Force fetch on mount to ensure fresh data on page refresh
onMounted(() => {
	fetch();
	fetchAttendees();
});

const attendeesDrawerRef = ref<InstanceType<typeof ContentDrawer>>();
const allAttendees = computed(() => {
	if (!event.value) return [];
	return [event.value.host, ...(attendees.value || [])];
});

watch(
	() => event.value,
	(event) => {
		setTitleSuffix(event ? event.name : 'Event');

		if (event && !event.can_edit) {
			router.replace(`/events/${event.id}`);

			toast.add({
				title: 'Access Denied',
				description: 'You do not have permission to manage this event.',
				icon: 'mdi:calendar-remove',
				color: 'error',
				duration: 5000
			});
		}
	},
	{ immediate: true }
);
</script>
