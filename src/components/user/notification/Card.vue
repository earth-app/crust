<template>
	<component
		:is="useGradientBorder ? UiAnimatedGradientBorder : 'div'"
		v-bind="useGradientBorder ? gradientBorderProps : undefined"
		:class="useGradientBorder ? 'mb-4 block' : ''"
	>
		<div
			ref="rootRef"
			:class="[
				'relative min-w-60 border border-gray-700 rounded-lg p-4 transition-all duration-200 bg-linear-to-tl via-gray-500/20 to-transparent hover:opacity-90',
				useGradientBorder ? '' : 'mb-4',
				readTint,
				enterAnimationClass
			]"
			:style="enterStyle"
		>
			<UiSparkleBurst
				v-if="isQuestSource && !prefersReducedMotion"
				:trigger="sparkleTrigger"
				color="warning"
				:count="22"
				:duration="900"
			/>
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
					<button
						v-if="isFriendSource && !notification.read"
						type="button"
						title="Mark as Read"
						aria-label="Mark as Read"
						class="flex items-center justify-center size-11 -my-2 bg-transparent border-0 p-0 hover:cursor-pointer"
						@click="markAsRead"
					>
						<UiPulseRing
							:active="!prefersReducedMotion"
							:color="type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info'"
							class="pointer-events-none"
						>
							<span class="inline-block size-3 bg-blue-500 rounded-full"></span>
						</UiPulseRing>
					</button>
					<button
						v-else-if="!notification.read"
						type="button"
						title="Mark as Read"
						aria-label="Mark as Read"
						class="flex items-center justify-center size-11 -my-2 bg-transparent border-0 p-0 hover:cursor-pointer"
						@click="markAsRead"
					>
						<span
							:class="['inline-block size-3 rounded-full pointer-events-none', unreadDotClass]"
						></span>
					</button>
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
	</component>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import { trimString } from 'utils';
import UiAnimatedGradientBorder from '~/components/ui/AnimatedGradientBorder.vue';
import { runOrQueue } from '~/composables/useNetwork';

const props = defineProps<{
	notification: UserNotification;
	additional?: boolean;
	index?: number;
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

// source-driven animation matrix — quest gets the heaviest weight (sparkle burst + glow)
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
const rootRef = ref<HTMLElement | null>(null);
const sparkleTrigger = ref(0);

const isQuestSource = computed(() => {
	const src = (props.notification.source || '').toLowerCase();
	return src === 'quest' || /quest/i.test(props.notification.title);
});

const isBadgeSource = computed(() => {
	const src = (props.notification.source || '').toLowerCase();
	return src === 'badge' || props.notification.title === 'New Badge Unlocked!';
});

const isFriendSource = computed(() => {
	const src = (props.notification.source || '').toLowerCase();
	return src === 'friend_request' || src === 'friend_accept' || src === 'friend';
});

const isEventSource = computed(() => (props.notification.source || '').toLowerCase() === 'event');
const isMentionSource = computed(() => {
	const src = (props.notification.source || '').toLowerCase();
	return src === 'mention' || src === 'reply';
});

// gradient border only celebrates unread badges; once read the card settles to plain
const useGradientBorder = computed(
	() => isBadgeSource.value && !props.notification.read && !prefersReducedMotion.value
);
const gradientBorderProps = computed(() => ({
	speed: 6,
	thickness: 2,
	from: '#a855f7',
	via: '#f59e0b',
	to: '#3b82f6'
}));

// enter-only animation class — fill-mode forwards keeps end state without retriggering
const enterAnimationClass = computed(() => {
	if (prefersReducedMotion.value) return '';
	if (type.value === 'error' || isMentionSource.value)
		return 'motion-preset-shake motion-duration-500';
	if (isEventSource.value) return 'notif-event-enter';
	if (isQuestSource.value) return 'notif-quest-glow';
	return 'motion-preset-fade-md motion-duration-300';
});

const enterStyle = computed(() => {
	const delay = (props.index ?? 0) * 80;
	return delay > 0 ? { animationDelay: `${delay}ms` } : undefined;
});

// read-state tint — settles cards to muted gray once acknowledged
const readTint = computed(() => (props.notification.read ? 'opacity-70 [&_p]:text-gray-500!' : ''));

const unreadDotClass = computed(() => {
	if (type.value === 'error') return 'bg-red-500 notif-pulse-error';
	if (type.value === 'warning') return 'bg-yellow-500 notif-pulse-warning';
	return 'bg-blue-500';
});

onMounted(() => {
	if (prefersReducedMotion.value) return;
	if (!isQuestSource.value) return;
	// stagger sparkle burst after list enter so cards don't all pop at once
	const delay = 200 + (props.index ?? 0) * 80;
	setTimeout(() => {
		sparkleTrigger.value++;
	}, delay);
});
</script>

<style scoped>
@keyframes notif-event-enter {
	0% {
		opacity: 0;
		transform: scale(0.95);
	}
	100% {
		opacity: 1;
		transform: scale(1);
	}
}
.notif-event-enter {
	animation: notif-event-enter 320ms ease-out both;
}

@keyframes notif-quest-glow {
	0% {
		opacity: 0;
		box-shadow: 0 0 0 0 rgba(250, 204, 21, 0);
	}
	30% {
		opacity: 1;
		box-shadow: 0 0 18px 2px rgba(250, 204, 21, 0.35);
	}
	100% {
		opacity: 1;
		box-shadow: 0 0 0 0 rgba(250, 204, 21, 0);
	}
}
.notif-quest-glow {
	animation: notif-quest-glow 1400ms ease-out both;
}

@keyframes notif-pulse-warning {
	0%,
	100% {
		opacity: 0.55;
	}
	50% {
		opacity: 1;
	}
}
.notif-pulse-warning {
	animation: notif-pulse-warning 1600ms ease-in-out infinite;
}

@keyframes notif-pulse-error {
	0%,
	100% {
		opacity: 0.5;
		transform: scale(1);
	}
	50% {
		opacity: 1;
		transform: scale(1.15);
	}
}
.notif-pulse-error {
	animation: notif-pulse-error 1100ms ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
	.notif-event-enter,
	.notif-quest-glow,
	.notif-pulse-warning,
	.notif-pulse-error {
		animation: none !important;
	}
}
</style>
