<template>
	<div class="container mx-auto my-8 px-4 py-8 bg-gray-900 border-8 border-gray-950 rounded-lg">
		<h1 class="text-2xl">Users</h1>
		<span class="mt-2 text-gray-500">Manage user accounts and permissions from this panel.</span>
		<div class="mt-4">
			<UButton
				color="primary"
				@click="fetchUsers"
				:loading="loadingUsers"
				:disabled="loadingUsers"
			>
				{{ loadingUsers ? 'Loading...' : 'Fetch Users' }}
			</UButton>
			<div
				v-if="loadingUsers"
				class="mt-2 text-gray-500"
			>
				Loading users...
			</div>
			<ul class="mt-4 space-y-2 max-h-100 overflow-y-auto">
				<li
					v-for="user in users"
					:key="user.id"
					class="p-2 border hover:bg-secondary-900"
				>
					<div class="flex items-center justify-between">
						<UserDropdown
							:user="user"
							admin
							mode="hover"
						>
							<span class="text-lg font-semibold">{{ user.username }}</span>
						</UserDropdown>
					</div>
				</li>
			</ul>
		</div>
	</div>
	<div class="container mx-auto my-8 px-4 py-8 bg-gray-900 border-8 border-gray-950 rounded-lg">
		<h1 class="text-2xl">Activities</h1>
		<span class="mt-2 text-gray-500">View and manage user activities.</span>
		<div class="mt-4">
			<UInput
				v-model="activitySearch"
				placeholder="Search Activities..."
				class="mr-2"
			/>
			<UButton
				color="primary"
				@click="fetchActivities"
				:loading="loadingActivities"
				:disabled="loadingActivities"
			>
				{{ loadingActivities ? 'Loading...' : `Fetch Activities (${activityCount})` }}
			</UButton>
			<UButton
				color="primary"
				class="ml-2"
				@click="createActivityModal = true"
			>
				Create Activity
			</UButton>
			<AdminActivityEditorModal v-model:open="createActivityModal" />
			<div
				v-if="loadingActivities"
				class="mt-2 text-gray-500"
			>
				Loading activities...
			</div>
			<AdminActivityEditorModal
				:title="`Edit Activity: ${activityToEdit?.name}`"
				v-model:open="editActivityModal"
				:activity="activityToEdit"
			/>
			<ul class="mt-4 space-y-2 max-h-100 overflow-y-auto">
				<li
					v-for="activity in activities"
					:key="activity.id"
					class="p-2 border hover:bg-secondary-900"
				>
					<div
						class="flex items-center justify-start hover:cursor-pointer"
						@click="
							activityToEdit = activity;
							editActivityModal = true;
						"
					>
						<UIcon
							v-if="activityIcons[activity.id as keyof typeof activityIcons]"
							:name="activityIcons[activity.id as keyof typeof activityIcons]"
							class="mr-2"
							size="24"
						/>
						<span class="text-lg font-semibold mr-4">{{ activity.name }}</span>
						<span class="text-gray-500 ml-12"
							>{{ activity.description.substring(0, 150) }}...
						</span>
					</div>
				</li>
			</ul>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useTitleSuffix } from '~/compostables/useTitleSuffix';
import { activityIcons, getActivities } from '~/compostables/useActivity';
import type { Activity } from '~/shared/types/activity';
import { getUsers } from '~/compostables/useUser';
import type { User } from '~/shared/types/user';

const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Admin Panel');

const users = ref<User[]>([]);
const loadingUsers = ref(false);

async function fetchUsers() {
	loadingUsers.value = true;
	const res = await getUsers();
	if (res.data) {
		users.value = res.data;
	}
	loadingUsers.value = false;
}

const activities = ref<Activity[]>([]);
const activityCount = ref(0);
const loadingActivities = ref(false);

async function fetchActivities() {
	loadingActivities.value = true;
	const res = await getActivities();
	if (res.data) {
		activities.value = res.data;
		activityCount.value = res.data.length;
	}
	loadingActivities.value = false;
}

const createActivityModal = ref(false);
const editActivityModal = ref(false);
const activityToEdit = ref<Partial<Activity> | undefined>(undefined);

const activitySearch = ref('');
watch(activitySearch, (newSearch) => {
	if (newSearch.trim() === '') {
		fetchActivities();
	} else {
		activities.value = activities.value.filter((activity) =>
			activity.name.toLowerCase().includes(newSearch.toLowerCase())
		);
	}
});
</script>
