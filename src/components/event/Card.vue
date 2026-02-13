<template>
	<InfoCard
		v-bind="$attrs"
		:title="reactiveEvent.name"
		:content="full ? reactiveEvent.description : trimString(reactiveEvent.description, 350)"
		:link="noLink ? undefined : `/events/${reactiveEvent.id}`"
		:avatar="authorAvatar"
		:avatar-chip="authorAvatarChipColor ? true : false"
		:avatar-chip-color="authorAvatarChipColor"
		:badges="badges"
		:image="full ? undefined : thumbnail || undefined"
		:color="0xffca20"
		:buttons="buttons"
		:footer="footer"
		:banner="banner || undefined"
	/>
	<ContentDrawer
		ref="attendeesDrawerRef"
		:title="`Event Attendees (${comma(reactiveEvent.attendee_count)})`"
		:is-loading="false"
	>
		<UserCard
			v-for="attendee in allAttendees"
			:key="attendee.id"
			:user="attendee"
		/>
	</ContentDrawer>
</template>

<script setup lang="ts">
defineOptions({
	inheritAttrs: false
});
import { DateTime } from 'luxon';
import ContentDrawer from '~/components/ContentDrawer.vue';
import type { Event } from '~/shared/types/event';
import { capitalizeFully, comma, trimString, withSuffix } from '~/shared/util';

const props = defineProps<{
	event: Event;
	noLink?: boolean;
	full?: boolean;
}>();

const toast = useToast();
const router = useRouter();
const { user } = useAuth();
const {
	event: eventState,
	thumbnail,
	unloadThumbnail,
	attendees,
	fetchAttendees,
	signUpForEvent,
	leaveEvent,
	deleteEvent
} = useEvent(props.event.id || '');

const reactiveEvent = computed(() => eventState.value || props.event);

const attendeesDrawerRef = ref<InstanceType<typeof ContentDrawer>>();

// Lazy load attendees only when drawer is opened
const openAttendeesDrawer = () => {
	if (!attendees.value) {
		fetchAttendees();
	}
	attendeesDrawerRef.value?.open();
};

const allAttendees = computed(() => {
	const filteredAttendees = (attendees.value || []).filter(
		(attendee) => attendee.id !== reactiveEvent.value.hostId
	);
	return [reactiveEvent.value.host, ...filteredAttendees];
});

const attendeeAvatars = computed(() => {
	return allAttendees.value.map((attendee) => {
		// useUser has internal caching via useState, so calling it multiple times
		// with the same ID won't cause duplicate fetches
		const { avatar128, chipColor } = useUser(attendee.id);

		return {
			src: avatar128.value || undefined,
			alt: attendee.username,
			link: `/profile/@${attendee.username}`,
			chip: chipColor.value ? { color: chipColor.value as any } : undefined
		};
	});
});

const badges = computed(() => {
	const array: {
		text: string;
		color?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral';
		size?: 'md' | 'xs' | 'sm' | 'lg' | 'xl';
		icon?: string;
		variant?: 'solid' | 'subtle' | 'outline' | 'soft';
		link?: string;
	}[] = [];

	let typeIcon: string;
	switch (reactiveEvent.value.type) {
		case 'HYBRID':
			typeIcon = 'mdi:human-greeting-variant';
			break;
		case 'IN_PERSON':
			typeIcon = 'mdi:office-building';
			break;
		case 'ONLINE':
			typeIcon = 'mdi:laptop-account';
			break;
	}
	array.push({
		text: capitalizeFully(reactiveEvent.value.type.replace('_', '')),
		color: 'info',
		icon: typeIcon,
		variant: 'soft',
		size: 'md'
	});

	reactiveEvent.value.activities.forEach((activity) => {
		if (typeof activity === 'string') {
			// legacy string format (activity type name)
			const activityStr: string = activity;
			array.push({
				text: capitalizeFully(activityStr.replace(/_/g, ' ')),
				color: 'warning',
				icon: 'mdi:tag-outline',
				variant: 'subtle',
				size: 'md'
			});
		} else if ('type' in activity && activity.type === 'activity_type' && 'value' in activity) {
			// actual activity type
			const activityType = activity as { type: 'activity_type'; value: string };
			array.push({
				text: capitalizeFully(activityType.value.replace(/_/g, ' ')),
				color: 'warning',
				icon: 'mdi:tag-outline',
				variant: 'subtle',
				size: 'md'
			});
		} else if (
			'type' in activity &&
			activity.type === 'activity' &&
			'name' in activity &&
			'id' in activity
		) {
			// actual activity
			const actualActivity = activity as {
				type: 'activity';
				id: string;
				name: string;
				fields?: Record<string, any>;
			};
			array.push({
				text: actualActivity.name,
				color: 'primary',
				icon: actualActivity.fields?.['icon'] || 'material-symbols:activity-zone',
				variant: 'outline',
				size: 'md',
				link: `/activities/${actualActivity.id}`
			});
		}
	});

	return array;
});

const buttons = computed(() => {
	const array: {
		text: string;
		icon?: string;
		color?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral';
		size?: 'md' | 'xs' | 'sm' | 'lg' | 'xl';
		onClick?: () => void;
		disabled?: boolean;
	}[] = [];

	const isAtCapacity = computed(() => {
		const maxInPerson = reactiveEvent.value.fields?.['max_in_person'] as number | undefined;
		const maxOnline = reactiveEvent.value.fields?.['max_online'] as number | undefined;

		if (reactiveEvent.value.type === 'IN_PERSON' && maxInPerson) {
			// skips undefined or 0
			return reactiveEvent.value.attendee_count >= maxInPerson;
		} else if (reactiveEvent.value.type === 'ONLINE' && maxOnline) {
			// skips undefined or 0
			return reactiveEvent.value.attendee_count >= maxOnline;
		} else if (reactiveEvent.value.type === 'HYBRID') {
			const totalMax = (maxInPerson || 0) + (maxOnline || 0);
			if (totalMax > 0) {
				return reactiveEvent.value.attendee_count >= totalMax;
			}
		}

		const { user: hostUser, maxEventAttendees } = useUser(reactiveEvent.value.hostId);
		if (hostUser.value) {
			return reactiveEvent.value.attendee_count >= maxEventAttendees.value;
		}

		return false;
	});

	if (reactiveEvent.value.hostId !== user.value?.id && !reactiveEvent.value.timing.has_passed) {
		if (reactiveEvent.value.is_attending) {
			array.push({
				text: 'Leave Event',
				icon: 'mdi:calendar-remove',
				color: 'error',
				size: 'md',
				onClick: async () => {
					if (user.value === null) {
						router.push(`/login?redirect=/events/${reactiveEvent.value.id}`);

						toast.add({
							title: 'Login Required',
							description: 'You must be logged in to sign up for events.',
							icon: 'mdi:login',
							color: 'warning',
							duration: 5000
						});
					}

					await leaveEvent();
				}
			});
		} else {
			array.push({
				text: isAtCapacity.value ? 'Event Full' : 'Sign Up',
				icon: isAtCapacity.value ? 'mdi:calendar-alert' : 'mdi:calendar-plus',
				color: isAtCapacity.value ? 'neutral' : 'primary',
				size: 'md',
				disabled: isAtCapacity.value,
				onClick: async () => {
					if (isAtCapacity.value) {
						toast.add({
							title: 'Event Full',
							description: 'This event has reached its maximum capacity.',
							icon: 'mdi:alert-circle',
							color: 'warning',
							duration: 5000
						});
						return;
					}

					if (user.value === null) {
						router.push(`/login?redirect=/events/${reactiveEvent.value.id}`);

						toast.add({
							title: 'Login Required',
							description: 'You must be logged in to sign up for events.',
							icon: 'mdi:login',
							color: 'warning',
							duration: 5000
						});
						return;
					}

					if (reactiveEvent.value.fields?.cancelled) {
						toast.add({
							title: 'Event Cancelled',
							description: 'The host has cancelled this event and sign-ups are closed.',
							icon: 'mdi:cancel',
							color: 'error',
							duration: 5000
						});
						return;
					}

					await signUpForEvent();
				}
			});
		}
	}

	if (reactiveEvent.value.can_edit) {
		array.push({
			text: 'Manage Event',
			color: 'secondary',
			size: 'md',
			onClick: () => {
				navigateTo(`/events/${reactiveEvent.value.id}/manage`);
			}
		});

		array.push({
			text: `Attendees (${withSuffix(reactiveEvent.value.attendee_count)})`,
			color: 'info',
			size: 'md',
			onClick: openAttendeesDrawer
		});

		array.push({
			text: 'Delete Event',
			color: 'error',
			size: 'md',
			onClick: () => {
				const yes = confirm(
					'Are you sure you want to delete this event? This action cannot be undone.'
				);
				if (yes) {
					deleteEvent();
					navigateTo('/events');
				}
			}
		});
	}

	return array;
});

const footer = computed(() => `Created by @${reactiveEvent.value.host.username} - ${time.value}`);

const banner = computed<{
	text: string;
	icon?: string;
	color: 'primary' | 'error' | 'success' | 'neutral' | 'warning';
} | null>(() => {
	if (reactiveEvent.value.fields?.cancelled) {
		return {
			text: 'This event has been cancelled by the host.',
			icon: 'mdi:cancel',
			color: 'error'
		};
	}

	const timing = reactiveEvent.value.timing;

	if (timing.is_ongoing) {
		return {
			text: 'This event is currently ongoing.',
			icon: 'mdi:calendar-clock',
			color: 'success'
		};
	}

	if (timing.starts_in !== null && timing.starts_in > 0 && timing.starts_in <= 3600 * 12) {
		return {
			text: 'This event is starting soon!',
			icon: 'mdi:calendar-star',
			color: 'warning'
		};
	}

	if (timing.has_passed) {
		return {
			text: 'This event has concluded.',
			icon: 'mdi:calendar-check',
			color: 'neutral'
		};
	}

	return null;
});

// useUser has internal caching, so this won't cause duplicate fetches
const { avatar128: authorAvatar, chipColor: authorAvatarChipColor } = useUser(
	reactiveEvent.value.hostId
);

const i18n = useI18n();
const time = computed(() => {
	if (!reactiveEvent.value.created_at) return 'sometime';
	const created = DateTime.fromISO(reactiveEvent.value.created_at, {
		zone: Intl.DateTimeFormat().resolvedOptions().timeZone
	});

	return created.setLocale(i18n.locale.value).toLocaleString(DateTime.DATETIME_MED);
});

onBeforeUnmount(() => {
	unloadThumbnail();
});
</script>
