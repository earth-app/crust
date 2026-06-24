<template>
	<div class="flex flex-col gap-4">
		<div>
			<h2 class="text-xl font-semibold">Quest Management</h2>
			<p class="text-sm text-muted mt-1">
				Review a user's active quest and completed history, inspect submissions, advance steps, and
				rescind progress or points for moderation.
			</p>
		</div>

		<UInput
			v-model="search"
			placeholder="Search by username..."
			icon="mdi:magnify"
			class="max-w-md"
			@keyup.enter="loadUsers"
		/>
		<UButton
			icon="mdi:account-search"
			color="primary"
			variant="soft"
			:loading="loadingUsers"
			:disabled="loadingUsers"
			class="self-start"
			@click="loadUsers"
			>Search Users</UButton
		>

		<div
			v-if="users.length === 0 && !loadingUsers"
			class="text-sm text-muted py-4 text-center rounded border border-default border-dashed"
		>
			No users loaded. Search above to begin.
		</div>

		<div
			v-if="users.length"
			class="rounded-lg border border-default divide-y divide-default overflow-hidden"
		>
			<button
				v-for="u in users"
				:key="u.id"
				class="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-elevated transition-colors"
				:class="{ 'bg-elevated': selected?.id === u.id }"
				@click="selectUser(u)"
			>
				<UAvatar
					:src="u.account?.avatar_url || undefined"
					size="sm"
				/>
				<div class="min-w-0">
					<p class="font-semibold truncate">@{{ u.username }}</p>
					<p class="text-xs text-muted truncate">{{ u.account?.email || 'no email' }}</p>
				</div>
			</button>
		</div>

		<!-- selected user detail -->
		<div
			v-if="selected"
			class="flex flex-col gap-4 rounded-lg border border-default p-4 bg-neutral-800/30"
		>
			<div class="flex items-center justify-between gap-2 flex-wrap">
				<h3 class="font-semibold">@{{ selected.username }}</h3>
				<div class="flex gap-1.5 flex-wrap">
					<UButton
						size="xs"
						color="info"
						variant="soft"
						icon="mdi:star-off"
						@click="openPoints(null)"
						>Rescind Points</UButton
					>
				</div>
			</div>

			<!-- active quest -->
			<div class="flex flex-col gap-2">
				<div class="flex items-center justify-between gap-2 flex-wrap">
					<h4 class="text-sm font-semibold uppercase text-muted">Active Quest</h4>
					<div
						v-if="activeQuest"
						class="flex gap-1.5 flex-wrap"
					>
						<UButton
							size="xs"
							color="primary"
							variant="soft"
							icon="mdi:fast-forward"
							@click="advanceOpen = true"
							>Advance Step</UButton
						>
						<UButton
							size="xs"
							color="warning"
							variant="soft"
							icon="mdi:backspace-outline"
							@click="removeOpen = true"
							>Remove Step</UButton
						>
						<UButton
							size="xs"
							color="error"
							variant="soft"
							icon="mdi:flag-remove"
							:loading="busy === 'reset'"
							@click="askReset"
							>Reset Quest</UButton
						>
					</div>
				</div>

				<div
					v-if="loadingDetail"
					class="text-sm text-muted py-3 text-center"
				>
					Loading...
				</div>
				<div
					v-else-if="!activeQuest"
					class="text-sm text-muted py-3 text-center rounded border border-default border-dashed"
				>
					No active quest.
				</div>
				<div
					v-else
					class="flex flex-col gap-2"
				>
					<div class="flex items-center gap-2">
						<UIcon
							:name="activeQuest.quest.icon || 'mdi:flag'"
							class="size-5"
						/>
						<span class="font-medium">{{ activeQuest.quest.title }}</span>
						<UBadge
							color="neutral"
							variant="subtle"
							size="xs"
							>Step {{ activeQuest.currentStepIndex + 1 }} /
							{{ activeQuest.quest.steps.length }}</UBadge
						>
					</div>

					<!-- the step the user is currently on (not yet completed) -->
					<div
						v-if="currentStepSlot"
						class="rounded-lg border border-primary/50 bg-primary/10 p-3 flex items-center gap-2"
					>
						<UIcon
							:name="currentStepIcon"
							class="size-5 text-primary shrink-0"
						/>
						<div class="min-w-0">
							<p class="text-xs font-semibold uppercase text-primary">Current Step</p>
							<p class="text-sm font-medium truncate">
								Step {{ activeQuest.currentStepIndex + 1 }}: {{ currentStepLabel }}
							</p>
						</div>
					</div>

					<AdminQuestProgressViewer :progress="activeQuest.progress" />
				</div>
			</div>

			<!-- completed history -->
			<div class="flex flex-col gap-2">
				<div class="flex items-center justify-between gap-2 flex-wrap">
					<h4 class="text-sm font-semibold uppercase text-muted">
						Completed Quests ({{ historyList.length }})
					</h4>
					<UButton
						v-if="historyList.length"
						size="xs"
						color="error"
						variant="ghost"
						icon="mdi:delete-sweep"
						:loading="busy === 'deleteAll'"
						@click="askDeleteAll"
						>Delete All</UButton
					>
				</div>

				<div
					v-if="historyList.length === 0"
					class="text-sm text-muted py-3 text-center rounded border border-default border-dashed"
				>
					No completed quests.
				</div>

				<div
					v-for="h in historyList"
					:key="h.questId"
					class="rounded-lg border border-default"
				>
					<div class="flex items-center justify-between gap-2 px-3 py-2.5 flex-wrap">
						<button
							class="flex items-center gap-2 min-w-0 text-left"
							@click="toggleHistory(h.questId)"
						>
							<UIcon
								:name="expanded.has(h.questId) ? 'mdi:chevron-down' : 'mdi:chevron-right'"
								class="size-4 shrink-0"
							/>
							<UIcon
								:name="h.quest.icon || 'mdi:flag-checkered'"
								class="size-5 shrink-0"
							/>
							<span class="font-medium truncate">{{ h.quest.title }}</span>
						</button>
						<div class="flex gap-1.5 flex-wrap">
							<UButton
								size="xs"
								color="info"
								variant="soft"
								icon="mdi:star-off"
								@click="openPoints(h.quest)"
								>Rescind Points</UButton
							>
							<UButton
								size="xs"
								color="error"
								variant="ghost"
								icon="mdi:delete-outline"
								:loading="busy === `delete-${h.questId}`"
								@click="askDeleteHistory(h)"
								>Delete</UButton
							>
						</div>
					</div>
					<div
						v-if="expanded.has(h.questId)"
						class="border-t border-default p-3"
					>
						<div
							v-if="loadingEntry === h.questId"
							class="text-sm text-muted text-center py-2"
						>
							Loading...
						</div>
						<AdminQuestProgressViewer
							v-else
							:progress="h.progress"
						/>
					</div>
				</div>
			</div>
		</div>

		<!-- advance step modal -->
		<AdminQuestAdvanceModal
			v-if="selected && activeQuest"
			:open="advanceOpen"
			:user-id="selected.id"
			:username="selected.username"
			:step-index="activeQuest.currentStepIndex"
			:step-def="activeQuest.quest.steps[activeQuest.currentStepIndex]"
			@update:open="(v) => (advanceOpen = v)"
			@advanced="refreshActive"
		/>

		<!-- remove step modal -->
		<UModal
			:open="removeOpen"
			:dismissible="!busy"
			title="Remove Quest Step"
			@update:open="(v: boolean) => !v && (removeOpen = false)"
		>
			<template #content>
				<div class="p-6 flex flex-col gap-3 max-w-md">
					<p class="text-sm text-muted">
						Remove a completed step from the active quest. Only the last completed step (or a
						redundant alternate) can be removed; the cloud repairs the timeline.
					</p>
					<UFormField label="Step number (1-based)">
						<UInput
							v-model.number="removeStep"
							type="number"
							:disabled="!!busy"
						/>
					</UFormField>
					<UFormField label="Alternate (optional, 1-based)">
						<UInput
							v-model.number="removeAlt"
							type="number"
							placeholder="leave blank to clear all alternates"
							:disabled="!!busy"
						/>
					</UFormField>
					<UCheckbox
						v-model="removeRescind"
						label="Also rescind the points this step awarded"
						:disabled="!!busy"
					/>
					<div class="flex gap-2 justify-end">
						<UButton
							variant="ghost"
							color="neutral"
							:disabled="!!busy"
							@click="removeOpen = false"
							>Cancel</UButton
						>
						<UButton
							color="warning"
							icon="mdi:backspace-outline"
							:loading="busy === 'removeStep'"
							:disabled="!removeStep || removeStep < 1"
							@click="removeStepSubmit"
							>Remove Step</UButton
						>
					</div>
				</div>
			</template>
		</UModal>

		<!-- rescind points modal -->
		<UModal
			:open="pointsOpen"
			:dismissible="!busy"
			title="Rescind Impact Points"
			@update:open="(v: boolean) => !v && (pointsOpen = false)"
		>
			<template #content>
				<div class="p-6 flex flex-col gap-3 max-w-md">
					<p class="text-sm">
						Remove points from <span class="font-mono">@{{ selected?.username }}</span
						><span v-if="pointsQuestTitle">
							for quest "<span class="font-medium">{{ pointsQuestTitle }}</span
							>"</span
						>.
					</p>
					<UInput
						v-model.number="pointsAmount"
						type="number"
						placeholder="Points to remove"
						:disabled="!!busy"
					/>
					<UInput
						v-model="pointsReason"
						placeholder="Reason (shown in points history)"
						:disabled="!!busy"
					/>
					<div class="flex gap-2 justify-end">
						<UButton
							variant="ghost"
							color="neutral"
							:disabled="!!busy"
							@click="pointsOpen = false"
							>Cancel</UButton
						>
						<UButton
							color="primary"
							icon="mdi:check"
							:loading="busy === 'points'"
							:disabled="!pointsAmount || pointsAmount <= 0 || !pointsReason.trim()"
							@click="rescindPoints"
							>Rescind</UButton
						>
					</div>
				</div>
			</template>
		</UModal>

		<!-- shared destructive-action confirmation -->
		<UModal
			:open="confirmModal.open"
			:dismissible="!confirmBusy"
			:title="confirmModal.title"
			@update:open="(v: boolean) => !v && !confirmBusy && (confirmModal.open = false)"
		>
			<template #content>
				<div class="p-6 flex flex-col gap-3 max-w-md">
					<p class="text-sm">{{ confirmModal.body }}</p>
					<div class="flex gap-2 justify-end">
						<UButton
							variant="ghost"
							color="neutral"
							:disabled="confirmBusy"
							@click="confirmModal.open = false"
							>Cancel</UButton
						>
						<UButton
							:color="confirmModal.color"
							:icon="confirmModal.icon"
							:loading="confirmBusy"
							@click="runConfirm"
							>{{ confirmModal.confirmLabel }}</UButton
						>
					</div>
				</div>
			</template>
		</UModal>
	</div>
</template>

<script setup lang="ts">
const authStore = useAuthStore();
const userStore = useUserStore();
const toast = useToast();
const { fetchAll: fetchAllUsers } = useUsers();

const search = ref('');
const users = ref<User[]>([]);
const loadingUsers = ref(false);

const selected = ref<User | null>(null);
const activeQuest = ref<UserQuestProgress | null>(null);
const loadingDetail = ref(false);

const historyList = ref<QuestHistoryEntry[]>([]);
const expanded = reactive(new Set<string>());
const loadingEntry = ref<string | null>(null);

const busy = ref<string | null>(null);

const advanceOpen = ref(false);
const removeOpen = ref(false);
const removeStep = ref<number | null>(null);
const removeAlt = ref<number | null>(null);
const removeRescind = ref(false);

const pointsOpen = ref(false);
const pointsAmount = ref<number | null>(null);
const pointsReason = ref('');
const pointsQuestTitle = ref('');

const { getStepIcon } = useQuests();

// the step the user is currently on (may be an alt-group)
const currentStepSlot = computed<QuestStep | QuestStep[] | null>(() => {
	const q = activeQuest.value;
	if (!q) return null;
	return q.quest.steps[q.currentStepIndex] ?? null;
});
const currentStepLabel = computed(() => {
	const slot = currentStepSlot.value;
	if (!slot) return '';
	if (Array.isArray(slot)) return slot.map((s) => prettyStepType(s.type)).join(' / ');
	return slot.description || prettyStepType(slot.type);
});
const currentStepIcon = computed(() => {
	const slot = currentStepSlot.value;
	const type = Array.isArray(slot) ? slot[0]?.type : slot?.type;
	return getStepIcon(type || 'order_items');
});

function prettyStepType(type: string): string {
	return type
		.split('_')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

// shared destructive-action confirmation
const confirmModal = reactive<{
	open: boolean;
	title: string;
	body: string;
	confirmLabel: string;
	color: 'error' | 'warning';
	icon: string;
	action: (() => Promise<void>) | null;
}>({
	open: false,
	title: '',
	body: '',
	confirmLabel: 'Confirm',
	color: 'error',
	icon: 'mdi:alert',
	action: null
});
const confirmBusy = ref(false);

function askConfirm(opts: {
	title: string;
	body: string;
	confirmLabel: string;
	color: 'error' | 'warning';
	icon: string;
	action: () => Promise<void>;
}) {
	Object.assign(confirmModal, opts, { open: true });
}

async function runConfirm() {
	const action = confirmModal.action;
	if (!action) {
		confirmModal.open = false;
		return;
	}
	confirmBusy.value = true;
	try {
		await action();
	} finally {
		confirmBusy.value = false;
		confirmModal.open = false;
	}
}

async function loadUsers() {
	loadingUsers.value = true;
	try {
		const res = await fetchAllUsers(100, search.value);
		if (res.data) users.value = res.data;
	} finally {
		loadingUsers.value = false;
	}
}

async function selectUser(u: User) {
	selected.value = u;
	expanded.clear();
	await refreshActive();
	await refreshHistory();
}

async function refreshActive() {
	if (!selected.value) return;
	loadingDetail.value = true;
	try {
		activeQuest.value = await userStore.fetchUserQuest(selected.value.id, true);
	} finally {
		loadingDetail.value = false;
	}
}

async function refreshHistory() {
	if (!selected.value) return;
	const map = await userStore.fetchQuestHistory(selected.value.id, { force: true });
	historyList.value = Array.from(map.values()).sort(
		(a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)
	);
}

async function toggleHistory(questId: string) {
	if (expanded.has(questId)) {
		expanded.delete(questId);
		return;
	}
	expanded.add(questId);
	if (!selected.value) return;
	const existing = historyList.value.find((h) => h.questId === questId);
	if (existing?.progress) return;
	loadingEntry.value = questId;
	try {
		const entry = await userStore.fetchQuestHistoryEntry(selected.value.id, questId, {
			force: true
		});
		if (entry) {
			const idx = historyList.value.findIndex((h) => h.questId === questId);
			if (idx >= 0) historyList.value[idx] = entry;
		}
	} finally {
		loadingEntry.value = null;
	}
}

function askReset() {
	if (!selected.value) return;
	askConfirm({
		title: 'Reset Active Quest',
		body: `Reset @${selected.value.username}'s active quest? Their current progress will be cleared.`,
		confirmLabel: 'Reset Quest',
		color: 'error',
		icon: 'mdi:flag-remove',
		action: resetActive
	});
}

async function resetActive() {
	if (!selected.value) return;
	busy.value = 'reset';
	try {
		const res = await makeClientAPIRequest<void>(
			`/v2/users/${selected.value.id}/quest`,
			authStore.sessionToken,
			{ method: 'DELETE', allowMessageResponse: true }
		);
		toast.add({
			title: res.success ? 'Quest Reset' : 'No Active Quest',
			color: res.success ? 'success' : 'info',
			icon: res.success ? 'mdi:flag-remove' : 'mdi:information',
			duration: 3000
		});
		await refreshActive();
	} finally {
		busy.value = null;
	}
}

async function removeStepSubmit() {
	if (!selected.value || !removeStep.value) return;
	busy.value = 'removeStep';
	try {
		const params = new URLSearchParams({ step: String(removeStep.value - 1) });
		if (typeof removeAlt.value === 'number' && removeAlt.value >= 1)
			params.set('alt', String(removeAlt.value - 1));
		if (removeRescind.value) params.set('rescind_points', 'true');

		const res = await makeServerRequest<{ message: string; pointsRescinded: number }>(
			null,
			`/api/admin/quest/${selected.value.id}/step?${params.toString()}`,
			authStore.sessionToken,
			{ method: 'DELETE' }
		);
		if (res.success) {
			toast.add({
				title: 'Step Removed',
				description: res.data?.pointsRescinded
					? `${res.data.pointsRescinded} points rescinded`
					: undefined,
				color: 'success',
				icon: 'mdi:backspace-outline',
				duration: 3000
			});
			removeOpen.value = false;
			removeStep.value = null;
			removeAlt.value = null;
			removeRescind.value = false;
			await refreshActive();
		} else {
			toast.add({
				title: 'Could Not Remove Step',
				description: res.message,
				color: 'error',
				icon: 'mdi:alert-circle',
				duration: 5000
			});
		}
	} finally {
		busy.value = null;
	}
}

function openPoints(quest: Quest | null) {
	pointsAmount.value = quest?.reward ?? null;
	pointsQuestTitle.value = quest?.title ?? '';
	pointsReason.value = quest ? `Quest "${quest.title}" points rescinded` : 'Quest points rescinded';
	pointsOpen.value = true;
}

async function rescindPoints() {
	if (!selected.value || !pointsAmount.value || !pointsReason.value.trim()) return;
	busy.value = 'points';
	try {
		const res = await makeServerRequest<{ points: number }>(
			null,
			`/api/admin/points/${selected.value.id}/remove`,
			authStore.sessionToken,
			{ method: 'POST', body: { points: pointsAmount.value, reason: pointsReason.value.trim() } }
		);
		if (res.success) {
			toast.add({
				title: 'Points Rescinded',
				description: `New total: ${res.data?.points ?? '?'}`,
				color: 'success',
				icon: 'mdi:star-off',
				duration: 3000
			});
			pointsOpen.value = false;
		} else {
			toast.add({
				title: 'Failed',
				description: res.message,
				color: 'error',
				icon: 'mdi:alert-circle',
				duration: 5000
			});
		}
	} finally {
		busy.value = null;
	}
}

function askDeleteHistory(h: QuestHistoryEntry) {
	askConfirm({
		title: 'Delete Completed Quest',
		body: `Permanently delete "${h.quest.title}" from this user's history? This cannot be undone.`,
		confirmLabel: 'Delete',
		color: 'error',
		icon: 'mdi:delete-outline',
		action: () => deleteHistory(h.questId)
	});
}

async function deleteHistory(questId: string) {
	if (!selected.value) return;
	busy.value = `delete-${questId}`;
	try {
		const res = await makeServerRequest<void>(
			null,
			`/api/admin/quest/${selected.value.id}/history/${questId}`,
			authStore.sessionToken,
			{ method: 'DELETE' }
		);
		if (res.success) {
			historyList.value = historyList.value.filter((h) => h.questId !== questId);
			toast.add({
				title: 'Quest Deleted',
				color: 'success',
				icon: 'mdi:delete-outline',
				duration: 3000
			});
		} else {
			toast.add({
				title: 'Failed',
				description: res.message,
				color: 'error',
				icon: 'mdi:alert-circle',
				duration: 5000
			});
		}
	} finally {
		busy.value = null;
	}
}

function askDeleteAll() {
	if (!selected.value) return;
	askConfirm({
		title: 'Delete All Completed Quests',
		body: `Permanently delete ALL completed quests for @${selected.value.username}? This cannot be undone.`,
		confirmLabel: 'Delete All',
		color: 'error',
		icon: 'mdi:delete-sweep',
		action: deleteAllHistory
	});
}

async function deleteAllHistory() {
	if (!selected.value) return;
	busy.value = 'deleteAll';
	try {
		const res = await makeServerRequest<void>(
			null,
			`/api/admin/quest/${selected.value.id}/history`,
			authStore.sessionToken,
			{ method: 'DELETE' }
		);
		if (res.success) {
			historyList.value = [];
			userStore.questHistory.delete(selected.value.id);
			toast.add({
				title: 'History Cleared',
				color: 'success',
				icon: 'mdi:delete-sweep',
				duration: 3000
			});
		} else {
			toast.add({
				title: 'Failed',
				description: res.message,
				color: 'error',
				icon: 'mdi:alert-circle',
				duration: 5000
			});
		}
	} finally {
		busy.value = null;
	}
}
</script>
