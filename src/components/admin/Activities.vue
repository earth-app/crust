<template>
	<div class="flex flex-col gap-3">
		<div class="flex items-start justify-between gap-3 flex-wrap">
			<div>
				<h2 class="text-xl font-semibold">Activities</h2>
				<p class="text-sm text-muted mt-1">
					Manage the activity tag catalog. Editing an activity propagates to every user who has it.
				</p>
			</div>
			<UButton
				color="secondary"
				icon="mdi:plus"
				@click="createModal = true"
				>New Activity</UButton
			>
		</div>

		<div class="flex gap-2">
			<UInput
				v-model="search"
				placeholder="Search activities..."
				icon="mdi:magnify"
				class="flex-1"
			/>
			<UButton
				color="primary"
				@click="load"
				:loading="loading"
				icon="mdi:reload"
				>Fetch</UButton
			>
		</div>

		<AdminActivityEditorModal v-model:open="createModal" />
		<AdminActivityEditorModal
			v-model:open="editModal"
			:title="`Edit Activity: ${activityToEdit?.name}`"
			:activity="activityToEdit"
		/>

		<div class="rounded-lg border border-default divide-y divide-default max-h-96 overflow-y-auto">
			<div
				v-if="!loading && activities.length === 0"
				class="p-4 text-center text-sm text-muted"
			>
				No activities loaded. Click Fetch.
			</div>
			<div
				v-for="activity in activities"
				:key="activity.id"
				class="flex items-center justify-between gap-3 px-3 py-2 hover:bg-elevated/50 cursor-pointer"
				@click="
					activityToEdit = activity;
					editModal = true;
				"
			>
				<div class="flex items-center gap-2 min-w-0">
					<UIcon
						v-if="activity.fields?.['icon']"
						:name="activity.fields['icon']"
						class="size-5 shrink-0"
					/>
					<div class="min-w-0">
						<p class="font-semibold truncate">{{ activity.name }}</p>
						<p class="text-xs text-muted truncate">
							{{ activity.description?.substring(0, 200) }}
						</p>
					</div>
				</div>
				<UIcon
					name="mdi:chevron-right"
					class="size-5 text-muted shrink-0"
				/>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
const activities = ref<Activity[]>([]);
const loading = ref(false);
const search = ref('');
const createModal = ref(false);
const editModal = ref(false);
const activityToEdit = ref<Partial<Activity> | undefined>(undefined);

async function load() {
	loading.value = true;
	const { fetchAll } = useActivities();
	const res = await fetchAll(100, search.value);
	if (res.data) activities.value = res.data;
	loading.value = false;
}

onMounted(load);
</script>
