<template>
	<div class="flex flex-col gap-4">
		<div class="flex items-start justify-between gap-3 flex-wrap">
			<div>
				<h2 class="text-xl font-semibold">User Moderation</h2>
				<p class="text-sm text-muted mt-1">
					Adjust points, manage quest state, and disable accounts. Actions log to the audit stream
					and notify the user.
				</p>
			</div>
		</div>

		<UInput
			v-model="search"
			placeholder="Search by username..."
			icon="mdi:magnify"
			class="max-w-md"
		/>
		<UButton
			icon="mdi:account-search"
			color="primary"
			variant="soft"
			:loading="loading"
			:disabled="loading"
			class="self-start"
			@click="load"
			>Search Users</UButton
		>

		<div
			v-if="users.length === 0 && !loading"
			class="text-sm text-muted py-4 text-center rounded border border-default border-dashed"
		>
			No users loaded. Search above to begin.
		</div>

		<div class="rounded-lg border border-default divide-y divide-default overflow-hidden">
			<div
				v-for="u in users"
				:key="u.id"
				class="flex flex-col gap-2 px-3 py-3"
			>
				<div class="flex items-center justify-between gap-3 flex-wrap">
					<div class="flex items-center gap-3 min-w-0">
						<UAvatar
							:src="u.account?.avatar_url || undefined"
							size="md"
						/>
						<div class="min-w-0">
							<NuxtLink
								:to="`/profile/@${u.username}`"
								class="font-semibold hover:underline truncate"
								>@{{ u.username }}</NuxtLink
							>
							<p class="text-xs text-muted truncate">
								{{ u.account?.email || 'no email' }} ·
								{{ u.account?.account_type || 'FREE' }}
								<span
									v-if="u.disabled"
									class="text-error font-medium"
									>· DISABLED</span
								>
							</p>
						</div>
					</div>
					<div class="flex flex-wrap gap-1.5">
						<UButton
							size="xs"
							color="info"
							variant="soft"
							icon="mdi:star-plus"
							@click="openPointsModal(u)"
							>Points</UButton
						>
						<UButton
							size="xs"
							color="warning"
							variant="soft"
							icon="mdi:flag-remove"
							@click="resetQuest(u)"
							:loading="busy[u.id] === 'resetQuest'"
							>Reset Quest</UButton
						>
						<UButton
							size="xs"
							:color="u.disabled ? 'success' : 'error'"
							variant="soft"
							:icon="u.disabled ? 'mdi:account-check' : 'mdi:account-cancel'"
							@click="toggleDisabled(u)"
							:loading="busy[u.id] === 'disable'"
							>{{ u.disabled ? 'Re-enable' : 'Disable' }}</UButton
						>
						<UButton
							size="xs"
							color="error"
							variant="ghost"
							icon="mdi:account-remove"
							@click="openDeleteModal(u)"
							>Delete</UButton
						>
					</div>
				</div>
			</div>
		</div>

		<UModal
			:open="pointsTarget !== null"
			:dismissible="!pointsBusy"
			title="Adjust Impact Points"
			@update:open="(v) => !v && (pointsTarget = null)"
		>
			<template #content>
				<div
					v-if="pointsTarget"
					class="p-6 flex flex-col gap-3 max-w-md"
				>
					<p class="text-sm">
						Adjusting points for
						<span class="font-mono">@{{ pointsTarget.username }}</span>
					</p>
					<UInput
						v-model.number="pointsDelta"
						type="number"
						placeholder="Delta (positive or negative)"
						:disabled="pointsBusy"
					/>
					<UInput
						v-model="pointsReason"
						placeholder="Reason (visible in user history)"
						:disabled="pointsBusy"
					/>
					<div class="flex gap-2 justify-end">
						<UButton
							variant="ghost"
							color="neutral"
							:disabled="pointsBusy"
							@click="pointsTarget = null"
							>Cancel</UButton
						>
						<UButton
							color="primary"
							icon="mdi:check"
							:loading="pointsBusy"
							:disabled="!pointsDelta || !pointsReason.trim()"
							@click="applyPoints"
							>Apply</UButton
						>
					</div>
				</div>
			</template>
		</UModal>

		<UModal
			:open="deleteTarget !== null"
			:dismissible="!deleteBusy"
			title="Permanently Delete User"
			description="This irreversibly removes the user and all of their data."
			@update:open="(v) => !v && closeDeleteModal()"
		>
			<template #content>
				<div
					v-if="deleteTarget"
					class="p-6 flex flex-col gap-3 max-w-md"
				>
					<p class="text-sm">
						You are about to permanently delete
						<span class="font-mono">@{{ deleteTarget.username }}</span>
						. Their account, content, points, and history will all be removed. This cannot be
						undone.
					</p>
					<p class="text-xs text-muted">
						Type
						<span class="font-mono font-semibold">{{ deleteTarget.username }}</span>
						below to confirm.
					</p>
					<UInput
						v-model="deleteConfirmText"
						:placeholder="deleteTarget.username"
						autocomplete="off"
						spellcheck="false"
						:disabled="deleteBusy"
					/>
					<div class="flex gap-2 justify-end">
						<UButton
							variant="ghost"
							color="neutral"
							:disabled="deleteBusy"
							@click="closeDeleteModal"
							>Cancel</UButton
						>
						<UButton
							color="error"
							icon="mdi:account-remove"
							:loading="deleteBusy"
							:disabled="!canConfirmDelete"
							@click="performDelete"
							>Delete User</UButton
						>
					</div>
				</div>
			</template>
		</UModal>
	</div>
</template>

<script setup lang="ts">
const authStore = useAuthStore();
const toast = useToast();
const { fetchAll: fetchAllUsers } = useUsers();

const users = ref<User[]>([]);
const loading = ref(false);
const search = ref('');
const busy = reactive<Record<string, string | null>>({});

const pointsTarget = ref<User | null>(null);
const pointsDelta = ref<number | null>(null);
const pointsReason = ref('');
const pointsBusy = ref(false);

const deleteTarget = ref<User | null>(null);
const deleteConfirmText = ref('');
const deleteBusy = ref(false);
const canConfirmDelete = computed(
	() => !!deleteTarget.value && deleteConfirmText.value.trim() === deleteTarget.value.username
);

function openDeleteModal(u: User) {
	deleteTarget.value = u;
	deleteConfirmText.value = '';
}

function closeDeleteModal() {
	if (deleteBusy.value) return;
	deleteTarget.value = null;
	deleteConfirmText.value = '';
}

async function load() {
	loading.value = true;
	try {
		const res = await fetchAllUsers(100, search.value);
		if (res.data) users.value = res.data;
	} finally {
		loading.value = false;
	}
}

function openPointsModal(u: User) {
	pointsTarget.value = u;
	pointsDelta.value = null;
	pointsReason.value = '';
}

async function applyPoints() {
	if (!pointsTarget.value || !pointsDelta.value || !pointsReason.value.trim()) return;
	pointsBusy.value = true;
	try {
		const id = pointsTarget.value.id;
		const delta = pointsDelta.value;
		const path = delta > 0 ? 'add' : 'remove';
		const res = await makeClientAPIRequest<void>(
			`/v2/users/${id}/points/${path}`,
			authStore.sessionToken,
			{
				method: 'POST',
				body: { amount: Math.abs(delta), reason: pointsReason.value.trim() }
			}
		);
		if (res.success) {
			toast.add({
				title: 'Points Adjusted',
				description: `${delta > 0 ? '+' : ''}${delta} for @${pointsTarget.value.username}`,
				color: 'success',
				icon: 'mdi:star',
				duration: 3000
			});
			pointsTarget.value = null;
		} else {
			toast.add({
				title: 'Failed',
				description: res.message || 'Could not adjust points',
				color: 'error',
				icon: 'mdi:alert-circle',
				duration: 4000
			});
		}
	} finally {
		pointsBusy.value = false;
	}
}

async function resetQuest(u: User) {
	busy[u.id] = 'resetQuest';
	try {
		const res = await makeClientAPIRequest<void>(
			`/v2/users/${u.id}/quest`,
			authStore.sessionToken,
			{ method: 'DELETE', allowMessageResponse: true }
		);
		toast.add({
			title: res.success ? 'Quest reset' : 'No active quest',
			description: `@${u.username}`,
			color: res.success ? 'success' : 'info',
			icon: res.success ? 'mdi:flag-remove' : 'mdi:information',
			duration: 3000
		});
	} finally {
		busy[u.id] = null;
	}
}

async function toggleDisabled(u: User) {
	busy[u.id] = 'disable';
	try {
		const next = !u.disabled;
		if (next && !confirm(`Disable @${u.username}? They'll be locked out until re-enabled.`)) {
			return;
		}
		// mantle2 wraps disable in the standard PATCH /v2/users/{id} body
		const res = await makeClientAPIRequest<void>(`/v2/users/${u.id}`, authStore.sessionToken, {
			method: 'PATCH',
			body: { disabled: next }
		});
		if (res.success) {
			u.disabled = next;
			toast.add({
				title: next ? 'Account Disabled' : 'Account Re-enabled',
				description: `@${u.username}`,
				color: next ? 'warning' : 'success',
				icon: next ? 'mdi:account-cancel' : 'mdi:account-check',
				duration: 3000
			});
		} else {
			toast.add({
				title: 'Failed',
				description: res.message,
				color: 'error',
				icon: 'mdi:alert-circle',
				duration: 4000
			});
		}
	} finally {
		busy[u.id] = null;
	}
}

async function performDelete() {
	const target = deleteTarget.value;
	if (!target || !canConfirmDelete.value) return;

	deleteBusy.value = true;
	busy[target.id] = 'delete';
	try {
		const res = await makeClientAPIRequest<void>(`/v2/users/${target.id}`, authStore.sessionToken, {
			method: 'DELETE'
		});
		if (res.success) {
			users.value = users.value.filter((x) => x.id !== target.id);
			toast.add({
				title: 'User Deleted',
				description: `@${target.username} has been permanently removed.`,
				color: 'success',
				icon: 'mdi:account-remove',
				duration: 5000
			});
			deleteTarget.value = null;
			deleteConfirmText.value = '';
		} else {
			toast.add({
				title: 'Could Not Delete User',
				description: res.message || `Failed to delete @${target.username}.`,
				color: 'error',
				icon: 'mdi:account-alert',
				duration: 6000
			});
		}
	} catch (e: any) {
		toast.add({
			title: 'Network Error',
			description: e?.message || 'Could not reach the server.',
			color: 'error',
			icon: 'mdi:wifi-alert',
			duration: 6000
		});
	} finally {
		deleteBusy.value = false;
		busy[target.id] = null;
	}
}
</script>
