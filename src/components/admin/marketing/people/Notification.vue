<template>
	<div
		v-if="displayOnly"
		class="flex flex-col gap-2"
	>
		<div
			v-for="(notification, i) in mockNotifications"
			:key="notification.id"
			class="pointer-events-none"
		>
			<UserNotificationCard
				:notification="notification"
				:index="i"
			/>
		</div>
	</div>

	<div
		v-else
		class="grid grid-cols-1 gap-4 lg:grid-cols-2"
	>
		<div class="flex flex-col gap-3">
			<div class="flex flex-wrap gap-2">
				<UButton
					icon="mdi:playlist-star"
					color="primary"
					variant="soft"
					@click="loadPresetSet"
					>Load Preset Set</UButton
				>
				<UButton
					icon="mdi:plus"
					color="neutral"
					variant="soft"
					@click="addNotification"
					>Add Notification</UButton
				>
				<UButton
					icon="mdi:presentation"
					color="neutral"
					variant="ghost"
					@click="present = true"
					>Present</UButton
				>
			</div>

			<div class="flex flex-col gap-3">
				<div
					v-for="(item, i) in forms"
					:key="i"
					class="flex flex-col gap-2 rounded-lg border border-gray-700 light:border-gray-300 p-3"
				>
					<div class="flex items-center justify-between gap-2">
						<span class="text-xs font-semibold text-muted">Notification {{ i + 1 }}</span>
						<UButton
							icon="mdi:close"
							color="neutral"
							variant="ghost"
							size="xs"
							aria-label="Remove Notification"
							@click="removeNotification(i)"
						/>
					</div>
					<UInput
						v-model="item.title"
						placeholder="Quest Complete: Morning Trail"
					/>
					<UTextarea
						v-model="item.message"
						:rows="2"
						placeholder="You finished all 3 steps and earned 120 impact points."
						class="w-full"
					/>
					<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
						<UFormField label="Type">
							<USelect
								v-model="item.type"
								:items="typeItems"
								class="w-full"
							/>
						</UFormField>
						<UFormField label="Source">
							<UInput
								v-model="item.source"
								placeholder="quest, badge, @username"
							/>
						</UFormField>
					</div>
					<div class="flex items-center justify-between gap-2">
						<USwitch
							v-model="item.read"
							label="Read"
						/>
						<UButton
							icon="mdi:bullhorn-outline"
							color="primary"
							variant="soft"
							size="sm"
							@click="fireToast(i)"
							>Fire Toast</UButton
						>
					</div>
				</div>
			</div>

			<div class="flex flex-col gap-2 rounded-lg border border-gray-700 light:border-gray-300 p-3">
				<div class="flex items-center gap-2 text-sm font-semibold text-muted">
					<UIcon
						name="mdi:medal-outline"
						class="size-4"
					/>
					<span>Badge Unlock Ribbon</span>
				</div>
				<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
					<UFormField label="Badge Name">
						<UInput
							v-model="ribbon.name"
							placeholder="Trailblazer"
						/>
					</UFormField>
					<UFormField label="Badge Icon">
						<UInput
							v-model="ribbon.icon"
							:icon="ribbon.icon || 'mdi:medal-outline'"
							placeholder="mdi:map-marker-path"
						/>
					</UFormField>
				</div>
				<UButton
					icon="mdi:party-popper"
					color="warning"
					variant="soft"
					class="self-start"
					:disabled="!ribbon.name.trim()"
					@click="previewBadgeRibbon"
					>Preview Badge Unlock Ribbon</UButton
				>
			</div>

			<AdminMarketingPeopleSceneBar
				kind="notification"
				:payload="forms"
				:source="source"
				@load="onSceneLoad"
			/>
		</div>

		<div class="flex flex-col gap-3">
			<div class="text-sm font-semibold text-muted">Live Preview</div>
			<div
				v-for="(notification, i) in mockNotifications"
				:key="notification.id"
				class="flex items-start gap-2"
			>
				<div class="pointer-events-none flex-1">
					<UserNotificationCard
						:notification="notification"
						:index="i"
					/>
				</div>
				<UButton
					icon="mdi:bullhorn-outline"
					color="primary"
					variant="soft"
					size="sm"
					class="mt-1 shrink-0"
					aria-label="Fire Toast"
					@click="fireToast(i)"
					>Fire Toast</UButton
				>
			</div>
			<p
				v-if="!mockNotifications.length"
				class="text-sm text-muted"
			>
				Add a notification or load the preset set to preview.
			</p>
		</div>

		<AdminMarketingPeoplePresent
			v-model="present"
			label="Mock Notifications"
		>
			<div class="flex flex-col gap-2">
				<div
					v-for="(notification, i) in mockNotifications"
					:key="notification.id"
					class="pointer-events-none"
				>
					<UserNotificationCard
						:notification="notification"
						:index="i"
					/>
				</div>
			</div>
		</AdminMarketingPeoplePresent>
	</div>
</template>

<script setup lang="ts">
import type { MockNotificationForm } from '~/shared/utils/marketingPeople';
import {
	emptyNotificationForm,
	makeMockNotification,
	NOTIFICATION_PRESETS,
	NOTIFICATION_TYPES,
	notificationToastOptions
} from '~/shared/utils/marketingPeople';
import type { MarketingScene, MarketingSource } from '../../../../shared/types/marketing';

const props = defineProps<{
	scene?: MarketingScene | null;
	displayOnly?: boolean;
}>();

const toast = useToast();
const { push: pushBadgeUnlock } = useBadgeUnlockListener();

const clonePresets = () => NOTIFICATION_PRESETS.map((p) => ({ ...p }));

const forms = ref<MockNotificationForm[]>(clonePresets());
const source = ref<MarketingSource>('ai');
const present = ref(false);
const ribbon = reactive({ name: 'Trailblazer', icon: 'mdi:map-marker-path' });

const typeItems = NOTIFICATION_TYPES.map((t) => ({
	label: t.charAt(0).toUpperCase() + t.slice(1),
	value: t
}));

const mockNotifications = computed(() => forms.value.map((f, i) => makeMockNotification(f, i)));

function addNotification() {
	forms.value.push(emptyNotificationForm());
	source.value = 'manual';
}

function removeNotification(i: number) {
	forms.value.splice(i, 1);
}

function loadPresetSet() {
	forms.value = clonePresets();
	source.value = 'ai';
	toast.add({
		title: 'Preset Set Loaded',
		description: `${forms.value.length} sample notifications ready.`,
		icon: 'mdi:playlist-check',
		color: 'success'
	});
}

function fireToast(i: number) {
	const notification = mockNotifications.value[i];
	if (!notification) return;
	toast.add(notificationToastOptions(notification));
}

// enqueues a mock badge into the real ribbon queue via the listener's push();
// push() never touches the badges_last_seen_at watermark (only the poll snapshot
// does), so real unlock tracking stays intact
function previewBadgeRibbon() {
	if (!ribbon.name.trim()) return;
	pushBadgeUnlock({
		badgeName: ribbon.name.trim(),
		badgeIcon: ribbon.icon.trim() || 'mdi:medal-outline'
	});
	toast.add({
		title: 'Ribbon Queued',
		description: 'The Badge Unlock Ribbon will drop from the top.',
		icon: 'mdi:party-popper',
		color: 'warning'
	});
}

function onSceneLoad(payload: unknown, scene: MarketingScene) {
	const list = Array.isArray(payload) ? (payload as MockNotificationForm[]) : [];
	forms.value = list.map((f) => ({ ...emptyNotificationForm(), ...f }));
	source.value = scene.source ?? 'manual';
}

watch(
	() => props.scene,
	(scene) => {
		if (Array.isArray(scene?.payload)) {
			const list = scene.payload as MockNotificationForm[];
			forms.value = list.map((f) => ({ ...emptyNotificationForm(), ...f }));
			source.value = scene?.source ?? 'manual';
		}
	},
	{ immediate: true }
);
</script>
