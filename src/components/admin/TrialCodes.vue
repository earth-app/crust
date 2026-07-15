<template>
	<div class="flex flex-col gap-4">
		<div class="flex items-center justify-between gap-3 flex-wrap">
			<div>
				<h2 class="text-lg font-semibold m-0">Trial Codes</h2>
				<p class="text-xs text-muted m-0 mt-1">
					Redeemable codes that grant a temporary paid tier. Share them for promotions,
					partnerships, or support recoveries.
				</p>
			</div>
			<div class="flex items-center gap-2">
				<UButton
					color="neutral"
					variant="ghost"
					icon="mdi:refresh"
					:loading="loading"
					@click="load"
				>
					Refresh
				</UButton>
				<UButton
					color="primary"
					icon="mdi:plus"
					@click="openCreate = true"
				>
					Create Code
				</UButton>
			</div>
		</div>

		<div
			v-if="loading && codes.length === 0"
			class="flex items-center justify-center py-12"
		>
			<UIcon
				name="mdi:loading"
				class="size-6 animate-spin text-muted"
			/>
		</div>

		<div
			v-else-if="error"
			class="rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm text-danger"
		>
			{{ error }}
		</div>

		<div
			v-else-if="codes.length === 0"
			class="rounded-lg border border-default px-6 py-12 text-center text-muted text-sm"
		>
			No trial codes yet. Create one to get started.
		</div>

		<div
			v-else
			class="overflow-x-auto rounded-lg border border-default"
		>
			<table class="w-full text-sm">
				<thead class="bg-elevated/60 text-left">
					<tr>
						<th class="px-3 py-2 font-semibold">Code</th>
						<th class="px-3 py-2 font-semibold">Tier</th>
						<th class="px-3 py-2 font-semibold">Days</th>
						<th class="px-3 py-2 font-semibold">Redemptions</th>
						<th class="px-3 py-2 font-semibold">Expires</th>
						<th class="px-3 py-2 font-semibold">Status</th>
						<th class="px-3 py-2 font-semibold text-right">Actions</th>
					</tr>
				</thead>
				<tbody>
					<template
						v-for="c in codes"
						:key="c.code"
					>
						<tr class="border-t border-default">
							<td class="px-3 py-2 font-mono wrap-break-word">{{ c.code }}</td>
							<td class="px-3 py-2">{{ tierLabel(c.tier) }}</td>
							<td class="px-3 py-2">{{ c.days }}</td>
							<td class="px-3 py-2">
								{{ c.redemptions }} / {{ c.max_redemptions === 0 ? '∞' : c.max_redemptions }}
							</td>
							<td class="px-3 py-2">{{ c.expires_at ? formatDate(c.expires_at) : 'Never' }}</td>
							<td class="px-3 py-2">
								<UBadge
									:color="c.active ? 'success' : 'neutral'"
									variant="subtle"
									>{{ c.active ? 'Active' : 'Inactive' }}</UBadge
								>
							</td>
							<td class="px-3 py-2">
								<div class="flex items-center justify-end gap-1">
									<UButton
										:icon="expandedCode === c.code ? 'mdi:chevron-up' : 'mdi:account-multiple'"
										color="neutral"
										variant="ghost"
										size="xs"
										@click="toggleRedeemers(c)"
									>
										Redeemers
									</UButton>
									<UButton
										icon="mdi:pencil"
										color="primary"
										variant="ghost"
										size="xs"
										@click="openEditModal(c)"
									>
										Edit
									</UButton>
									<UButton
										:icon="c.active ? 'mdi:pause' : 'mdi:play'"
										:color="c.active ? 'warning' : 'success'"
										variant="ghost"
										size="xs"
										@click="toggleActive(c)"
									>
										{{ c.active ? 'Disable' : 'Enable' }}
									</UButton>
									<UButton
										icon="mdi:delete"
										color="error"
										variant="ghost"
										size="xs"
										@click="onDelete(c)"
									>
										Delete
									</UButton>
								</div>
							</td>
						</tr>
						<tr
							v-if="expandedCode === c.code"
							class="border-t border-default/60 bg-elevated/30"
						>
							<td
								colspan="7"
								class="px-3 py-3"
							>
								<div class="flex items-center justify-between gap-3 flex-wrap mb-3">
									<div class="text-sm">
										<span class="font-semibold">Redeemers</span>
										<span class="text-muted ml-2">
											{{ redemptionUsage(c.code) }}
										</span>
									</div>
									<UButton
										icon="mdi:bell-ring"
										color="primary"
										variant="soft"
										size="xs"
										:disabled="activeCount(c.code) === 0"
										@click="openNotifyModal(c.code)"
									>
										Notify Redeemers
									</UButton>
								</div>

								<div
									v-if="redemptionsLoading === c.code"
									class="flex items-center justify-center py-6"
								>
									<UIcon
										name="mdi:loading"
										class="size-5 animate-spin text-muted"
									/>
								</div>
								<div
									v-else-if="(redemptions[c.code]?.redemptions.length ?? 0) === 0"
									class="rounded-lg border border-default px-4 py-6 text-center text-muted text-xs"
								>
									No one has redeemed this code yet.
								</div>
								<div
									v-else
									class="overflow-x-auto rounded-lg border border-default"
								>
									<table class="w-full text-xs">
										<thead class="bg-elevated/60 text-left">
											<tr>
												<th class="px-3 py-2 font-semibold">Username</th>
												<th class="px-3 py-2 font-semibold">Redeemed On</th>
												<th class="px-3 py-2 font-semibold">Tier</th>
												<th class="px-3 py-2 font-semibold">Expires</th>
												<th class="px-3 py-2 font-semibold">Status</th>
											</tr>
										</thead>
										<tbody>
											<tr
												v-for="r in redemptions[c.code]?.redemptions ?? []"
												:key="`${c.code}-${r.uid}`"
												class="border-t border-default"
											>
												<td class="px-3 py-2 wrap-break-word">{{ r.username || `#${r.uid}` }}</td>
												<td class="px-3 py-2">{{ formatDate(r.redeemed_at) }}</td>
												<td class="px-3 py-2">{{ r.tier ? tierLabel(r.tier) : '-' }}</td>
												<td class="px-3 py-2">
													{{ r.expires_at ? formatDate(r.expires_at) : '-' }}
												</td>
												<td class="px-3 py-2">
													<UBadge
														:color="r.active ? 'success' : 'neutral'"
														variant="subtle"
														>{{ r.active ? 'Active' : 'Expired' }}</UBadge
													>
												</td>
											</tr>
										</tbody>
									</table>
								</div>
							</td>
						</tr>
					</template>
				</tbody>
			</table>
		</div>

		<UModal
			v-model:open="openCreate"
			title="Create Trial Code"
			:dismissible="!submitting"
		>
			<template #body>
				<div class="flex flex-col gap-4 p-1">
					<div class="flex flex-col gap-1">
						<label class="text-sm font-medium">Tier</label>
						<USelect
							v-model="form.tier"
							:items="tierOptions"
						/>
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div class="flex flex-col gap-1">
							<label class="text-sm font-medium">Duration (Days)</label>
							<UInput
								v-model.number="form.days"
								type="number"
								:min="1"
							/>
						</div>
						<div class="flex flex-col gap-1">
							<label class="text-sm font-medium">Max Redemptions</label>
							<UInput
								v-model.number="form.maxRedemptions"
								type="number"
								:min="0"
							/>
							<div class="text-xs opacity-70">0 = Unlimited.</div>
						</div>
					</div>

					<div class="flex flex-col gap-1">
						<label class="text-sm font-medium">Expires On (Optional)</label>
						<UInput
							v-model="form.expiresAt"
							type="date"
							:min="minDateInput"
						/>
						<div class="text-xs opacity-70">Leave blank for a code that never expires.</div>
					</div>

					<div class="flex flex-col gap-1">
						<label class="text-sm font-medium">Custom Code (Optional)</label>
						<UInput
							v-model="form.code"
							placeholder="Leave blank to auto-generate (EARTH-XXXX-XXXX)"
						/>
					</div>
				</div>
			</template>

			<template #footer>
				<div class="flex justify-end gap-2 w-full">
					<UButton
						color="neutral"
						variant="ghost"
						:disabled="submitting"
						@click="openCreate = false"
					>
						Cancel
					</UButton>
					<UButton
						color="primary"
						:loading="submitting"
						:disabled="!canSubmit"
						@click="submitCreate"
					>
						Create Code
					</UButton>
				</div>
			</template>
		</UModal>

		<UModal
			v-model:open="openEdit"
			title="Edit Trial Code"
			:dismissible="!editing"
		>
			<template #body>
				<div class="flex flex-col gap-4 p-1">
					<div class="text-xs text-muted font-mono">{{ editCode }}</div>

					<div class="flex flex-col gap-1">
						<label class="text-sm font-medium">Tier</label>
						<USelect
							v-model="editForm.tier"
							:items="tierOptions"
						/>
					</div>

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div class="flex flex-col gap-1">
							<label class="text-sm font-medium">Duration (Days)</label>
							<UInput
								v-model.number="editForm.days"
								type="number"
								:min="1"
							/>
						</div>
						<div class="flex flex-col gap-1">
							<label class="text-sm font-medium">Max Redemptions</label>
							<UInput
								v-model.number="editForm.maxRedemptions"
								type="number"
								:min="0"
							/>
							<div class="text-xs opacity-70">0 = Unlimited.</div>
						</div>
					</div>

					<div class="flex flex-col gap-1">
						<label class="text-sm font-medium">Expires On (Optional)</label>
						<UInput
							v-model="editForm.expiresAt"
							type="date"
						/>
						<div class="text-xs opacity-70">Leave blank for a code that never expires.</div>
					</div>

					<USwitch
						v-model="editForm.active"
						label="Active"
					/>
				</div>
			</template>

			<template #footer>
				<div class="flex justify-end gap-2 w-full">
					<UButton
						color="neutral"
						variant="ghost"
						:disabled="editing"
						@click="openEdit = false"
					>
						Cancel
					</UButton>
					<UButton
						color="primary"
						:loading="editing"
						:disabled="!canSubmitEdit"
						@click="submitEdit"
					>
						Save Changes
					</UButton>
				</div>
			</template>
		</UModal>

		<UModal
			v-model:open="openNotify"
			title="Notify Redeemers"
			:dismissible="!notifying"
		>
			<template #body>
				<div class="flex flex-col gap-4 p-1">
					<p class="text-xs text-muted m-0">
						Send a notification and email to everyone with an active trial from
						<span class="font-mono">{{ notifyCode }}</span
						>.
					</p>

					<div class="flex flex-col gap-1">
						<label class="text-sm font-medium">Title</label>
						<UInput
							v-model="notifyForm.title"
							placeholder="e.g. Your Trial is Ending Soon"
							:maxlength="120"
						/>
						<div class="text-xs opacity-70">{{ notifyForm.title.length }} / 120</div>
					</div>

					<div class="flex flex-col gap-1">
						<label class="text-sm font-medium">Message</label>
						<UTextarea
							v-model="notifyForm.message"
							placeholder="What you want the redeemers to know."
							:maxlength="2000"
							:rows="4"
						/>
						<div class="text-xs opacity-70">{{ notifyForm.message.length }} / 2000</div>
					</div>
				</div>
			</template>

			<template #footer>
				<div class="flex justify-end gap-2 w-full">
					<UButton
						color="neutral"
						variant="ghost"
						:disabled="notifying"
						@click="openNotify = false"
					>
						Cancel
					</UButton>
					<UButton
						color="primary"
						icon="mdi:bell-ring"
						:loading="notifying"
						:disabled="!canNotify"
						@click="submitNotify"
					>
						Send Notification
					</UButton>
				</div>
			</template>
		</UModal>
	</div>
</template>

<script setup lang="ts">
import type { TrialCode, TrialCodeCreateInput, TrialRedemptionList } from 'types/subscription';
import type { AccountType } from 'types/user';

const {
	codes,
	loading,
	error,
	fetchCodes,
	createCode,
	updateCode,
	deleteCode,
	fetchRedemptions,
	notifyRedeemers
} = useTrialCodes();
const toast = useToast();

const openCreate = ref(false);
const submitting = ref(false);

const TIER_LABELS: Record<string, string> = {
	FREE: 'Free',
	PRO: 'Pro',
	WRITER: 'Writer',
	ORGANIZER: 'Organizer',
	ADMINISTRATOR: 'Administrator'
};

function tierLabel(t: AccountType | string): string {
	const key = String(t).toUpperCase();
	return TIER_LABELS[key] ?? key;
}

const tierOptions = [
	{ label: 'Pro', value: 'PRO' },
	{ label: 'Writer', value: 'WRITER' },
	{ label: 'Organizer', value: 'ORGANIZER' }
];

interface CreateForm {
	tier: AccountType;
	days: number;
	maxRedemptions: number;
	expiresAt: string;
	code: string;
}

function blankForm(): CreateForm {
	return { tier: 'PRO' as AccountType, days: 30, maxRedemptions: 0, expiresAt: '', code: '' };
}

const form = ref<CreateForm>(blankForm());

const minDateInput = computed(() => {
	const d = new Date();
	d.setDate(d.getDate() + 1);
	return d.toISOString().slice(0, 10);
});

const canSubmit = computed(() => form.value.days >= 1 && form.value.maxRedemptions >= 0);

watch(openCreate, (isOpen) => {
	if (isOpen) {
		form.value = blankForm();
		submitting.value = false;
	}
});

function formatDate(iso: string): string {
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

async function load() {
	const res = await fetchCodes();
	if (!res.success) {
		toast.add({
			title: 'Could Not Load Trial Codes',
			description: res.error ?? 'Try again.',
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 6000
		});
	}
}

onMounted(load);

async function submitCreate() {
	if (!canSubmit.value) return;
	submitting.value = true;
	try {
		const input: TrialCodeCreateInput = {
			tier: form.value.tier,
			days: form.value.days,
			max_redemptions: form.value.maxRedemptions
		};
		if (form.value.expiresAt) input.expires_at = new Date(form.value.expiresAt).toISOString();
		if (form.value.code.trim()) input.code = form.value.code.trim();

		const res = await createCode(input);
		if (res.success && res.data) {
			toast.add({
				title: 'Trial Code Created',
				description: `"${res.data.code}" is ready to share.`,
				icon: 'mdi:ticket-confirmation',
				color: 'success',
				duration: 6000
			});
			openCreate.value = false;
		} else {
			toast.add({
				title: 'Could Not Create Trial Code',
				description: res.error ?? 'Check the inputs and try again.',
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 6000
			});
		}
	} finally {
		submitting.value = false;
	}
}

async function toggleActive(c: TrialCode) {
	const res = await updateCode(c.code, { active: !c.active });
	if (res.success) {
		toast.add({
			title: c.active ? 'Trial Code Disabled' : 'Trial Code Enabled',
			description: `"${c.code}" is now ${c.active ? 'inactive' : 'active'}.`,
			icon: 'mdi:check-circle',
			color: 'success',
			duration: 4000
		});
	} else {
		toast.add({
			title: 'Could Not Update Trial Code',
			description: res.error ?? 'Try again.',
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 6000
		});
	}
}

async function onDelete(c: TrialCode) {
	if (!confirm(`Delete trial code "${c.code}"? This cannot be undone.`)) return;
	const res = await deleteCode(c.code);
	if (res.success) {
		if (expandedCode.value === c.code) expandedCode.value = null;
		delete redemptions.value[c.code];
		toast.add({
			title: 'Trial Code Deleted',
			description: `"${c.code}" can no longer be redeemed.`,
			icon: 'mdi:delete',
			color: 'success',
			duration: 4000
		});
	} else {
		toast.add({
			title: 'Could Not Delete Trial Code',
			description: res.error ?? 'Try again.',
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 6000
		});
	}
}

// redeemers expansion
const expandedCode = ref<string | null>(null);
const redemptions = ref<Record<string, TrialRedemptionList>>({});
const redemptionsLoading = ref<string | null>(null);

function activeCount(code: string): number {
	return redemptions.value[code]?.active_count ?? 0;
}

function redemptionUsage(code: string): string {
	const data = redemptions.value[code];
	if (!data) return '';
	return `${data.active_count} active / ${data.total_count} total`;
}

async function toggleRedeemers(c: TrialCode) {
	if (expandedCode.value === c.code) {
		expandedCode.value = null;
		return;
	}
	expandedCode.value = c.code;
	if (!redemptions.value[c.code]) await loadRedemptions(c.code);
}

async function loadRedemptions(code: string) {
	redemptionsLoading.value = code;
	try {
		const res = await fetchRedemptions(code);
		if (res.success && res.data) {
			redemptions.value[code] = res.data;
		} else {
			toast.add({
				title: 'Could Not Load Redeemers',
				description: res.error ?? 'Try again.',
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 6000
			});
		}
	} finally {
		redemptionsLoading.value = null;
	}
}

// edit modal
const openEdit = ref(false);
const editing = ref(false);
const editCode = ref<string | null>(null);

interface EditForm {
	tier: AccountType;
	days: number;
	maxRedemptions: number;
	expiresAt: string;
	active: boolean;
}

const editForm = ref<EditForm>({
	tier: 'PRO' as AccountType,
	days: 30,
	maxRedemptions: 0,
	expiresAt: '',
	active: true
});

const canSubmitEdit = computed(
	() => editForm.value.days >= 1 && editForm.value.maxRedemptions >= 0
);

function openEditModal(c: TrialCode) {
	editCode.value = c.code;
	editForm.value = {
		tier: String(c.tier).toUpperCase() as AccountType,
		days: c.days,
		maxRedemptions: c.max_redemptions,
		expiresAt: c.expires_at ? new Date(c.expires_at).toISOString().slice(0, 10) : '',
		active: c.active
	};
	editing.value = false;
	openEdit.value = true;
}

async function submitEdit() {
	if (!editCode.value || !canSubmitEdit.value) return;
	editing.value = true;
	try {
		const res = await updateCode(editCode.value, {
			tier: editForm.value.tier,
			days: editForm.value.days,
			max_redemptions: editForm.value.maxRedemptions,
			expires_at: editForm.value.expiresAt
				? new Date(editForm.value.expiresAt).toISOString()
				: null,
			active: editForm.value.active
		});
		if (res.success) {
			toast.add({
				title: 'Trial Code Updated',
				description: `"${editCode.value}" has been saved.`,
				icon: 'mdi:check-circle',
				color: 'success',
				duration: 4000
			});
			openEdit.value = false;
		} else {
			toast.add({
				title: 'Could Not Update Trial Code',
				description: res.error ?? 'Try again.',
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 6000
			});
		}
	} finally {
		editing.value = false;
	}
}

// notify redeemers modal
const openNotify = ref(false);
const notifying = ref(false);
const notifyCode = ref<string | null>(null);
const notifyForm = ref<{ title: string; message: string }>({ title: '', message: '' });

const canNotify = computed(() => {
	const t = notifyForm.value.title.trim();
	const m = notifyForm.value.message.trim();
	return t.length > 0 && t.length <= 120 && m.length > 0 && m.length <= 2000;
});

function openNotifyModal(code: string) {
	notifyCode.value = code;
	notifyForm.value = { title: '', message: '' };
	notifying.value = false;
	openNotify.value = true;
}

async function submitNotify() {
	if (!notifyCode.value || !canNotify.value) return;
	notifying.value = true;
	try {
		const res = await notifyRedeemers(notifyCode.value, {
			title: notifyForm.value.title.trim(),
			message: notifyForm.value.message.trim()
		});
		if (res.success && res.data) {
			toast.add({
				title: 'Redeemers Notified',
				description: `Sent to ${res.data.notified} ${res.data.notified === 1 ? 'redeemer' : 'redeemers'}.`,
				icon: 'mdi:bell-check',
				color: 'success',
				duration: 5000
			});
			openNotify.value = false;
		} else {
			toast.add({
				title: 'Could Not Notify Redeemers',
				description: res.error ?? 'Try again.',
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 6000
			});
		}
	} finally {
		notifying.value = false;
	}
}
</script>
