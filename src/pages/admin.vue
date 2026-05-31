<template>
	<div
		v-if="user && user.is_admin"
		class="container mx-auto px-4 py-6 max-w-6xl"
	>
		<div class="flex items-center justify-between mb-4">
			<div>
				<h1 class="text-2xl font-bold">Admin Console</h1>
				<p class="text-sm text-muted">Operational tools for @{{ user.username }}</p>
			</div>
			<UBadge
				color="error"
				variant="subtle"
				icon="mdi:shield-crown"
				>Administrator</UBadge
			>
		</div>

		<UTabs
			v-model="activeTab"
			:items="tabs"
			variant="link"
			class="w-full"
		>
			<template #content="{ item }">
				<div class="rounded-lg border border-default bg-default p-5 mt-2">
					<AdminAnalytics v-if="item.value === 'analytics'" />
					<AdminUserModeration v-else-if="item.value === 'users'" />
					<AdminBlacklist v-else-if="item.value === 'blacklist'" />
					<AdminContentSection
						v-else-if="item.value === 'content'"
						kind="prompts"
					/>
					<AdminActivities v-else-if="item.value === 'activities'" />
					<AdminMotd v-else-if="item.value === 'motd'" />
				</div>
			</template>
		</UTabs>
	</div>
	<div
		v-else-if="user && !user.is_admin"
		class="container mx-auto my-8 px-4 py-8 rounded-lg border border-default"
	>
		<h1 class="text-2xl">Access Denied</h1>
		<p class="mt-2 text-muted">You do not have permission to access this page.</p>
	</div>
	<div
		v-else-if="user === null"
		class="container mx-auto my-8 px-4 py-8 rounded-lg border border-default"
	>
		<h1 class="text-2xl">Not Logged In</h1>
		<p class="mt-2 text-muted">Please log in to access the admin panel.</p>
	</div>
</template>

<script setup lang="ts">
const { user } = useAuth();
const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Admin Console');

const activeTab = ref('analytics');

const tabs = [
	{ label: 'Analytics', icon: 'mdi:chart-line', value: 'analytics' },
	{ label: 'Users', icon: 'mdi:account-group', value: 'users' },
	{ label: 'Blacklist', icon: 'mdi:shield-off', value: 'blacklist' },
	{ label: 'Content', icon: 'mdi:file-document-multiple', value: 'content' },
	{ label: 'Activities', icon: 'mdi:tag-multiple', value: 'activities' },
	{ label: 'MOTD', icon: 'mdi:bullhorn', value: 'motd' }
];
</script>
