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
				<UButton
					v-if="!event.fields?.cancelled"
					color="warning"
					class="mb-4 self-start ml-2"
					:disabled="event.timing.has_passed"
					@click="cancel"
				>
					<UIcon
						name="mdi:calendar-remove"
						class="size-5 mr-1"
					/>
					Cancel Event
				</UButton>
				<UButton
					v-else
					color="warning"
					class="mb-4 self-start ml-2"
					@click="uncancel"
				>
					<UIcon
						name="mdi:calendar-check"
						class="size-5 mr-1"
					/>
					Uncancel Event
				</UButton>
				<UButton
					color="error"
					class="mb-4 self-start ml-2"
					:disabled="event.timing.is_ongoing || event.timing.has_passed"
					@click="removeEvent"
				>
					<UIcon
						name="mdi:delete"
						class="size-5 mr-1"
					/>
					Delete Event
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
const { event, fetch, attendees, fetchAttendees, cancelEvent, uncancelEvent, deleteEvent } =
	useEvent(route.params.id as string);

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

async function cancel() {
	const yes = confirm('Are you sure you want to cancel this event? This action cannot be undone.');
	if (!yes) return;

	await cancelEvent();
	fetch();
	fetchAttendees();

	toast.add({
		title: 'Event Cancelled',
		description: 'The event has been successfully cancelled.',
		icon: 'mdi:calendar-remove',
		color: 'success',
		duration: 5000
	});

	const path = event.value?.id || '';
	router.push(`/events/${path}`);
}

async function uncancel() {
	const yes = confirm('Are you sure you want to uncancel this event?');
	if (!yes) return;

	await uncancelEvent();
	fetch();
	fetchAttendees();

	toast.add({
		title: 'Event Uncancelled',
		description: 'The event has been successfully uncancelled.',
		icon: 'mdi:calendar-check',
		color: 'success',
		duration: 5000
	});

	const path = event.value?.id || '';
	router.push(`/events/${path}`);
}

async function removeEvent() {
	const yes = confirm('Are you sure you want to delete this event? This action cannot be undone.');
	if (!yes) return;

	if (!event.value) return;

	await deleteEvent();

	toast.add({
		title: 'Event Deleted',
		description: 'The event has been successfully deleted.',
		icon: 'mdi:delete',
		color: 'success',
		duration: 5000
	});

	router.push('/events');
}
</script>
