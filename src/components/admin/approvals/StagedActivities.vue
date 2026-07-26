<template>
	<div class="flex flex-col gap-4">
		<div class="flex items-end gap-3 flex-wrap">
			<USelect
				v-model="state"
				:items="stateItems"
				class="w-56"
				@update:model-value="onStateChange"
			/>
			<UButton
				icon="mdi:refresh"
				color="primary"
				variant="soft"
				:loading="loading"
				:disabled="loading"
				@click="load"
				>Load Submissions</UButton
			>
		</div>

		<div
			v-if="items.length === 0 && !loading"
			class="text-sm text-muted py-4 text-center rounded border border-default border-dashed"
		>
			No {{ stateLabel }} activities.
		</div>

		<div
			v-else
			class="rounded-lg border border-default divide-y divide-default overflow-hidden"
		>
			<div
				v-for="staged in items"
				:key="staged.id"
				class="flex flex-col gap-3 px-3 py-3"
			>
				<div class="flex items-start justify-between gap-3 flex-wrap">
					<div class="min-w-0 flex flex-col gap-1">
						<div class="flex items-center gap-2 flex-wrap">
							<UIcon
								v-if="staged.activity.fields?.icon"
								:name="staged.activity.fields.icon"
								class="size-5"
							/>
							<span class="font-semibold">{{ staged.activity.name }}</span>
							<span class="font-mono text-xs text-muted">{{ staged.activity.id }}</span>
						</div>

						<div class="flex items-center gap-2 flex-wrap">
							<UBadge
								v-for="type in staged.activity.types"
								:key="type"
								color="neutral"
								variant="subtle"
								size="sm"
								>{{ typeLabel(type) }}</UBadge
							>
						</div>

						<p class="text-sm text-muted wrap-break-word max-w-2xl line-clamp-2">
							{{ staged.activity.description }}
						</p>

						<div
							v-if="staged.activity.aliases?.length"
							class="flex items-center gap-1 flex-wrap"
						>
							<UBadge
								v-for="alias in staged.activity.aliases"
								:key="alias"
								size="xs"
								variant="outline"
								color="neutral"
								>{{ alias }}</UBadge
							>
						</div>

						<p
							v-if="staged.note"
							class="text-xs text-muted italic"
						>
							&ldquo;{{ staged.note }}&rdquo;
						</p>
					</div>

					<div class="flex flex-col items-end gap-1 shrink-0">
						<UBadge
							:color="staged.source === 'cloud_discovery' ? 'info' : 'warning'"
							:icon="staged.source === 'cloud_discovery' ? 'mdi:robot-outline' : 'mdi:account-star'"
							variant="subtle"
							>{{
								staged.source === 'cloud_discovery'
									? 'Automated'
									: `@${staged.submitter?.username ?? 'unknown'}`
							}}</UBadge
						>
						<UBadge
							:color="expiryColor(staged)"
							variant="subtle"
							icon="mdi:clock-outline"
							>{{ expiryLabel(staged) }}</UBadge
						>
					</div>
				</div>

				<div
					v-if="staged.state === 'pending'"
					class="flex items-center gap-2 flex-wrap"
				>
					<UButton
						size="sm"
						color="neutral"
						variant="outline"
						icon="mdi:pencil-outline"
						:disabled="!!busy[staged.id]"
						@click="openEditor(staged)"
						>Preview &amp; Edit</UButton
					>
					<UButton
						size="sm"
						color="success"
						variant="soft"
						icon="mdi:check"
						:loading="busy[staged.id] === 'approve'"
						:disabled="!!busy[staged.id]"
						@click="act(staged, 'approve')"
						>Approve</UButton
					>
					<UButton
						size="sm"
						color="error"
						variant="soft"
						icon="mdi:close"
						:loading="busy[staged.id] === 'deny'"
						:disabled="!!busy[staged.id]"
						@click="act(staged, 'deny')"
						>Deny</UButton
					>
				</div>
				<div
					v-else
					class="text-xs text-muted"
				>
					Status: {{ stateLabelOf(staged.state) }}
					<span v-if="staged.review_notes"> &mdash; {{ staged.review_notes }}</span>
				</div>
			</div>
		</div>

		<div class="flex items-center justify-between gap-3">
			<UButton
				size="sm"
				variant="ghost"
				color="neutral"
				icon="mdi:chevron-left"
				:disabled="page <= 1 || loading"
				@click="changePage(-1)"
				>Previous</UButton
			>
			<span class="text-xs text-muted">Page {{ page }} of {{ totalPages }}</span>
			<UButton
				size="sm"
				variant="ghost"
				color="neutral"
				trailing-icon="mdi:chevron-right"
				:disabled="page >= totalPages || loading"
				@click="changePage(1)"
				>Next</UButton
			>
		</div>

		<AdminActivityEditorModal
			ref="editorModal"
			v-model:open="editorOpen"
			mode="staged"
			title="Review Staged Activity"
			description="Adjust the generated metadata before publishing it to the catalog."
			:activity="editing?.activity"
			@approve:activity="approveWithEdits"
		/>
	</div>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import type { Activity, StagedActivity, StagedActivityState } from 'types/activity';

const toast = useToast();
const { list, approve, deny } = useStagedActivities();

const items = ref<StagedActivity[]>([]);
const total = ref(0);
const page = ref(1);
const limit = 50;
const loading = ref(false);
const state = ref<StagedActivityState>('pending');
const busy = reactive<Record<number, 'approve' | 'deny' | null>>({});
const editing = ref<StagedActivity | null>(null);
const editorOpen = ref(false);

const emit = defineEmits<{ (event: 'count', value: number): void }>();

const stateItems = [
	{ label: 'Pending', value: 'pending' },
	{ label: 'Approved', value: 'approved' },
	{ label: 'Denied', value: 'denied' },
	{ label: 'Auto Published', value: 'expired_published' },
	{ label: 'Auto Denied', value: 'expired_denied' },
	{ label: 'Withdrawn', value: 'withdrawn' }
];

const stateLabel = computed(() => stateLabelOf(state.value).toLowerCase());
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)));

function stateLabelOf(value: StagedActivityState): string {
	return stateItems.find((item) => item.value === value)?.label ?? value;
}

function typeLabel(type: string): string {
	return type
		.replace(/_/g, ' ')
		.toLowerCase()
		.replace(/\b\w/g, (character) => character.toUpperCase());
}

// the two windows behave oppositely, so the chip has to say which one applies
function expiryLabel(staged: StagedActivity): string {
	if (staged.state !== 'pending') return 'Resolved';

	const relative = DateTime.fromISO(staged.expires_at).toRelative() ?? 'soon';
	return staged.fails_open ? `Auto-publishes ${relative}` : `Auto-denies ${relative}`;
}

function expiryColor(staged: StagedActivity): 'warning' | 'neutral' | 'error' {
	if (staged.state !== 'pending') return 'neutral';
	if (staged.expires_in_seconds < 2 * 3600) return 'error';
	return staged.fails_open ? 'warning' : 'neutral';
}

async function load() {
	loading.value = true;
	try {
		const res = await list(state.value, page.value, limit);
		if (res.success && res.data) {
			items.value = res.data.items ?? [];
			total.value = res.data.total ?? items.value.length;
		} else {
			items.value = [];
			total.value = 0;
			toast.add({
				title: 'Failed to Load Submissions',
				description: res.message,
				icon: 'mdi:alert-circle',
				color: 'error'
			});
		}
	} finally {
		loading.value = false;
		if (state.value === 'pending') emit('count', total.value);
	}
}

function onStateChange() {
	page.value = 1;
	load();
}

function changePage(delta: number) {
	page.value = Math.max(1, page.value + delta);
	load();
}

function openEditor(staged: StagedActivity) {
	editing.value = staged;
	editorOpen.value = true;
}

const confirmCopy: Record<'approve' | 'deny', (staged: StagedActivity) => string> = {
	approve: (staged) =>
		`Approve "${staged.activity.name}"? It will be published to the activity catalog immediately.`,
	deny: (staged) =>
		`Deny "${staged.activity.name}"? It will not be published, and automated discovery will not propose it again.`
};

async function act(staged: StagedActivity, action: 'approve' | 'deny') {
	if (!confirm(confirmCopy[action](staged))) return;

	busy[staged.id] = action;
	try {
		const res = action === 'approve' ? await approve(staged.id) : await deny(staged.id);
		if (res.success) {
			toast.add({
				title: action === 'approve' ? 'Activity Published' : 'Submission Denied',
				icon: action === 'approve' ? 'mdi:check-circle' : 'mdi:close-circle',
				color: action === 'approve' ? 'success' : 'warning',
				duration: 3000
			});
			await load();
		} else {
			toast.add({
				title: 'Action Failed',
				description: res.message,
				icon: 'mdi:alert-circle',
				color: 'error'
			});
		}
	} finally {
		busy[staged.id] = null;
	}
}

async function approveWithEdits(activity: Partial<Activity> | null) {
	const staged = editing.value;
	if (!staged) return;

	editorOpen.value = false;
	busy[staged.id] = 'approve';
	try {
		const res = await approve(staged.id, activity ? 'Approved with reviewer edits' : undefined);
		if (res.success) {
			toast.add({
				title: 'Activity Published',
				icon: 'mdi:check-circle',
				color: 'success',
				duration: 3000
			});
			await load();
		} else {
			toast.add({
				title: 'Action Failed',
				description: res.message,
				icon: 'mdi:alert-circle',
				color: 'error'
			});
		}
	} finally {
		busy[staged.id] = null;
		editing.value = null;
	}
}

onMounted(load);
defineExpose({ load });
</script>
