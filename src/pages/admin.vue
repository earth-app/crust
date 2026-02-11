<template>
	<div v-if="user && user.is_admin">
		<div class="container mx-auto my-8 px-4 py-8 bg-gray-900 border-8 border-gray-950 rounded-lg">
			<h1 class="text-2xl">MOTD Panel</h1>
			<span class="mt-2 text-gray-500">Manage the Message of the Day from this panel.</span>
			<div class="flex mt-4 w-full">
				<UInput
					v-model="motd.motd"
					placeholder="Set the Message of the Day..."
					class="mr-2 w-2/5"
					:disabled="motdLoading"
				/>
				<UInput
					v-model="motd.icon"
					:icon="motd.icon"
					placeholder="Icon (optional, e.g. mdi:earth)"
					class="mr-2 w-1/4"
					:disabled="motdLoading"
				/>
				<USelect
					v-model="motd.type"
					:items="[
						{ label: 'Info', value: 'info', icon: 'mdi:information' },
						{ label: 'Success', value: 'success', icon: 'mdi:check-circle' },
						{ label: 'Warning', value: 'warning', icon: 'mdi:alert' },
						{ label: 'Error', value: 'error', icon: 'mdi:close-circle' }
					]"
					placeholder="Type"
					class="mr-2 w-1/8"
					:disabled="motdLoading"
				/>
				<UInput
					v-model.number="ttl"
					type="number"
					:min="300"
					placeholder="TTL (seconds)"
					class="mr-2 w-1/12"
					:disabled="motdLoading"
				/>
			</div>
			<UButton
				color="primary"
				icon="mdi:send"
				class="mt-2"
				@click="handleMotdUpdate"
				:loading="motdLoading"
			>
				Update MOTD
			</UButton>
		</div>
		<div class="container mx-auto my-8 px-4 py-8 bg-gray-900 border-8 border-gray-950 rounded-lg">
			<h1 class="text-2xl">Users</h1>
			<span class="mt-2 text-gray-500">Manage user accounts and permissions from this panel.</span>
			<div class="mt-4">
				<UInput
					v-model="userSearch"
					placeholder="Search Users..."
					class="mr-2"
				/>
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
								v-if="activity.fields['icon']"
								:name="activity.fields['icon']"
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
		<div class="container mx-auto my-8 px-4 py-8 bg-gray-900 border-8 border-gray-950 rounded-lg">
			<h1 class="text-2xl">Prompts</h1>
			<span class="mt-2 text-gray-500">Manage prompts from this panel.</span>
			<div class="mt-4">
				<UInput
					v-model="promptSearch"
					placeholder="Search Prompts..."
					class="mr-2"
				/>
				<UButton
					color="primary"
					@click="fetchPrompts"
					:loading="loadingPrompts"
					:disabled="loadingPrompts"
				>
					{{ loadingPrompts ? 'Loading...' : 'Fetch Prompts' }}
				</UButton>
				<div
					v-if="loadingPrompts"
					class="mt-2 text-gray-500"
				>
					Loading prompts...
				</div>
				<ul class="mt-4 space-y-2 max-h-100 overflow-y-auto">
					<li
						v-for="prompt in prompts"
						:key="prompt.id"
						class="p-2 border hover:bg-secondary-900"
					>
						<div class="flex items-center justify-between">
							<NuxtLink :to="`/prompts/${prompt.id}`">
								<UAvatar
									size="sm"
									:src="prompt.owner.account.avatar_url || undefined"
									class="mr-2"
								/>
								<span class="text-lg font-semibold">{{ prompt.prompt }}</span>
							</NuxtLink>
						</div>
					</li>
				</ul>
			</div>
		</div>
	</div>
	<div
		v-else-if="user && user.account.account_type !== 'ADMINISTRATOR'"
		class="container mx-auto my-8 px-4 py-8 bg-gray-900 border-8 border-gray-950 rounded-lg"
	>
		<h1 class="text-2xl">Access Denied</h1>
		<p class="mt-2 text-gray-500">You do not have permission to access this page.</p>
	</div>
	<div
		v-else-if="user === null"
		class="container mx-auto my-8 px-4 py-8 bg-gray-900 border-8 border-gray-950 rounded-lg"
	>
		<h1 class="text-2xl">Not Logged In</h1>
		<p class="mt-2 text-gray-500">Please log in to access the admin panel.</p>
	</div>
</template>

<script setup lang="ts">
import type { Activity } from '~/shared/types/activity';
import type { Prompt } from '~/shared/types/prompts';
import type { User } from '~/shared/types/user';

const { user } = useAuth();
const { motd, ttl, fetchMotd, setMotd } = useMotd();

const toast = useToast();
const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Admin Panel');

const users = ref<User[]>([]);
const userSearch = ref<string>('');
const loadingUsers = ref(false);

async function fetchUsers() {
	loadingUsers.value = true;
	const res = await getUsers(100, userSearch.value);
	if (res.data) {
		users.value = res.data;
	}
	loadingUsers.value = false;
}

const prompts = ref<Prompt[]>([]);
const promptSearch = ref<string>('');
const loadingPrompts = ref(false);

async function fetchPrompts() {
	loadingPrompts.value = true;
	const res = await getPrompts(100, promptSearch.value);
	if (res.data) {
		prompts.value = res.data;
	}
	loadingPrompts.value = false;
}

const activities = ref<Activity[]>([]);
const activityCount = ref(0);
const loadingActivities = ref(false);

async function fetchActivities() {
	loadingActivities.value = true;
	const res = await getAllActivities(100, activitySearch.value);
	if (res.data) {
		activities.value = res.data;
		activityCount.value = res.data.length;
	}
	loadingActivities.value = false;
}

const activitySearch = ref<string>('');
const createActivityModal = ref(false);
const editActivityModal = ref(false);
const activityToEdit = ref<Partial<Activity> | undefined>(undefined);

const motdLoading = ref(false);
async function handleMotdUpdate() {
	motdLoading.value = true;
	await setMotd(motd.value.motd, motd.value.icon, motd.value.type, ttl.value);
	await fetchMotd();

	toast.add({
		title: 'MOTD Updated',
		description: 'The Message of the Day has been updated successfully.',
		icon: 'mdi:check-circle',
		color: 'success'
	});

	motdLoading.value = false;
}
</script>
