<template>
	<div
		v-if="displayOnly && scene"
		class="w-full"
	>
		<AdminMarketingPeopleUser
			v-if="scene.kind === 'user'"
			:scene="scene as MarketingScene<MockUserForm>"
			display-only
		/>
		<AdminMarketingPeopleNotification
			v-else-if="scene.kind === 'notification'"
			:scene="scene as MarketingScene<MockNotificationForm[]>"
			display-only
		/>
		<AdminMarketingPeopleMotd
			v-else-if="scene.kind === 'motd'"
			:scene="scene as MarketingScene<MockMotdForm>"
			display-only
		/>
	</div>

	<div
		v-else
		class="flex flex-col gap-4"
	>
		<div>
			<h3 class="text-lg font-semibold">People & Messages</h3>
			<p class="mt-1 text-sm text-muted">
				Author mock users, notifications, and messages of the day, then preview the real components
				with your data. Nothing here reaches real users.
			</p>
		</div>

		<UTabs
			v-model="panel"
			:items="panels"
			variant="link"
			class="w-full"
		>
			<template #content="{ item }">
				<div class="mt-3">
					<AdminMarketingPeopleUser
						v-if="item.value === 'user'"
						:scene="userScene"
					/>
					<AdminMarketingPeopleNotification
						v-else-if="item.value === 'notification'"
						:scene="notificationScene"
					/>
					<AdminMarketingPeopleMotd
						v-else-if="item.value === 'motd'"
						:scene="motdScene"
					/>
				</div>
			</template>
		</UTabs>
	</div>
</template>

<script setup lang="ts">
import type {
	MockMotdForm,
	MockNotificationForm,
	MockUserForm
} from '~/shared/utils/marketingPeople';
import type { MarketingScene, MarketingStudioProps } from '../../../shared/types/marketing';

const props = defineProps<MarketingStudioProps>();

const panels = [
	{ label: 'Mock User', icon: 'mdi:account-outline', value: 'user' },
	{ label: 'Mock Notifications', icon: 'mdi:bell-outline', value: 'notification' },
	{ label: 'Mock MOTD', icon: 'mdi:bullhorn-outline', value: 'motd' }
];

const initialPanel = ['user', 'notification', 'motd'].includes(props.scene?.kind ?? '')
	? (props.scene!.kind as string)
	: 'user';
const panel = ref(initialPanel);

const userScene = computed(() =>
	props.scene?.kind === 'user' ? (props.scene as MarketingScene<MockUserForm>) : null
);
const notificationScene = computed(() =>
	props.scene?.kind === 'notification'
		? (props.scene as MarketingScene<MockNotificationForm[]>)
		: null
);
const motdScene = computed(() =>
	props.scene?.kind === 'motd' ? (props.scene as MarketingScene<MockMotdForm>) : null
);
</script>
