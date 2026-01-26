<template>
	<InfoCard
		v-bind="$attrs"
		:title="event.name"
		:content="full ? event.description : trimString(event.description, 350)"
		:link="noLink ? undefined : `/events/${event.id}`"
		:avatar="authorAvatar"
		:avatar-chip="authorAvatarChipColor ? true : false"
		:avatar-chip-color="authorAvatarChipColor"
		:badges="badges"
		:image="full ? undefined : thumbnail || undefined"
		:color="0xffca20"
		:buttons="buttons"
		:avatar-group="{
			avatars: attendeeAvatars,
			max: 5
		}"
		:footer="footer"
	/>
	<ContentDrawer
		ref="attendeesDrawerRef"
		:title="`Event Attendees (${comma(props.event.attendee_count)})`"
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
const { thumbnail, unloadThumbnail, attendees, signUpForEvent, leaveEvent, deleteEvent } = useEvent(
	props.event.id || ''
);

const attendeesDrawerRef = ref<InstanceType<typeof ContentDrawer>>();
const allAttendees = computed(() => {
	// Filter out host from attendees to avoid duplicates
	const filteredAttendees = (attendees.value || []).filter(
		(attendee) => attendee.id !== props.event.hostId
	);
	return [props.event.host, ...filteredAttendees];
});

const attendeeAvatars = computed(() => {
	return allAttendees.value.map((attendee) => {
		const { avatar128, chipColor } = useUser(attendee.id);

		return {
			src: avatar128.value || undefined,
			alt: attendee.username,
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
	switch (props.event.type) {
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
		text: capitalizeFully(props.event.type.replace('_', '')),
		color: 'info',
		icon: typeIcon,
		variant: 'soft',
		size: 'md'
	});

	props.event.activities.forEach((activity) => {
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
		const maxInPerson = props.event.fields?.['max_in_person'] as number | undefined;
		const maxOnline = props.event.fields?.['max_online'] as number | undefined;

		if (props.event.type === 'IN_PERSON' && maxInPerson) {
			// skips undefined or 0
			return props.event.attendee_count >= maxInPerson;
		} else if (props.event.type === 'ONLINE' && maxOnline) {
			// skips undefined or 0
			return props.event.attendee_count >= maxOnline;
		} else if (props.event.type === 'HYBRID') {
			const totalMax = (maxInPerson || 0) + (maxOnline || 0);
			if (totalMax > 0) {
				return props.event.attendee_count >= totalMax;
			}
		}

		const { user: hostUser, maxEventAttendees } = useUser(props.event.hostId);
		if (hostUser.value) {
			return props.event.attendee_count >= maxEventAttendees.value;
		}

		return false;
	});

	if (props.event.hostId !== user.value?.id) {
		if (props.event.is_attending) {
			array.push({
				text: 'Leave Event',
				icon: 'mdi:calendar-remove',
				color: 'error',
				size: 'md',
				onClick: async () => {
					if (user.value === null) {
						router.push(`/login?redirect=/events/${props.event.id}`);

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
						router.push(`/login?redirect=/events/${props.event.id}`);

						toast.add({
							title: 'Login Required',
							description: 'You must be logged in to sign up for events.',
							icon: 'mdi:login',
							color: 'warning',
							duration: 5000
						});
						return;
					}

					await signUpForEvent();
				}
			});
		}
	}

	if (props.event.can_edit) {
		array.push({
			text: 'Manage Event',
			color: 'secondary',
			size: 'md',
			onClick: () => {
				navigateTo(`/events/${props.event.id}/manage`);
			}
		});

		array.push({
			text: `Attendees (${withSuffix(props.event.attendee_count)})`,
			color: 'info',
			size: 'md',
			onClick: () => {
				attendeesDrawerRef.value?.open();
			}
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

const footer = computed(() => `Created by @${props.event.host.username} - ${time.value}`);

const { avatar128: authorAvatar, chipColor: authorAvatarChipColor } = useUser(props.event.hostId);

const i18n = useI18n();
const time = computed(() => {
	if (!props.event.created_at) return 'sometime';
	const created = DateTime.fromISO(props.event.created_at, {
		zone: Intl.DateTimeFormat().resolvedOptions().timeZone
	});

	return created.setLocale(i18n.locale.value).toLocaleString(DateTime.DATETIME_MED);
});

onBeforeUnmount(() => {
	unloadThumbnail();
});
</script>
