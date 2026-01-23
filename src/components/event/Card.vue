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

const { user } = useAuth();
const { thumbnail, unloadThumbnail, attendees, signUpForEvent, leaveEvent, deleteEvent } = useEvent(
	props.event.id
);

const attendeesDrawerRef = ref<InstanceType<typeof ContentDrawer>>();
const allAttendees = computed(() => {
	return [props.event.host, ...(attendees.value || [])];
});

const attendeeAvatars = computed(() => {
	const array = [props.event.host].concat(attendees.value || []);

	return array.map((attendee) => {
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

	array.push(
		...(props.event.activities.map((type) => ({
			text: capitalizeFully(type.replace('_', ' ')),
			color: 'warning',
			icon: 'mdi:tag-outline',
			variant: 'subtle',
			size: 'md'
		})) as any[])
	);

	return array;
});

const buttons = computed(() => {
	const array: {
		text: string;
		icon?: string;
		color?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral';
		size?: 'md' | 'xs' | 'sm' | 'lg' | 'xl';
		onClick?: () => void;
	}[] = [];

	if (props.event.hostId !== user.value?.id) {
		if (props.event.is_attending) {
			array.push({
				text: 'Leave Event',
				icon: 'mdi:calendar-remove',
				color: 'error',
				size: 'md',
				onClick: async () => {
					await leaveEvent();
				}
			});
		} else {
			array.push({
				text: 'Sign Up',
				icon: 'mdi:calendar-plus',
				color: 'primary',
				size: 'md',
				onClick: async () => {
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
