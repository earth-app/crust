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

		<div ref="topBarEl">
			<AdminApprovalsBulkBar
				v-if="hasBulkBar"
				v-bind="bulkBarProps"
				position="top"
				@toggle-all="toggleAll"
				@clear="clearSelection"
				@act="bulkAct"
			/>
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
				v-for="{ staged, risk } in rows"
				:key="staged.id"
				data-testid="staged-row"
				class="flex flex-col gap-3 px-3 py-3"
			>
				<div class="flex items-start justify-between gap-3 flex-wrap">
					<div class="min-w-0 flex flex-col gap-1">
						<div class="flex items-center gap-2 flex-wrap">
							<UCheckbox
								v-if="staged.state === 'pending'"
								:model-value="selection.has(staged.id)"
								:disabled="!!bulkBusy || !!busy[staged.id]"
								@update:model-value="toggleOne(staged)"
							/>
							<UIcon
								v-if="staged.activity.fields?.icon"
								:name="staged.activity.fields.icon"
								class="size-5"
							/>
							<span class="font-semibold">{{ staged.activity.name }}</span>
							<span class="font-mono text-xs text-muted">{{ staged.activity.id }}</span>

							<UPopover
								v-if="staged.state === 'pending' && risk.meta.flag"
								arrow
								mode="hover"
							>
								<UBadge
									:color="risk.meta.color"
									:variant="risk.meta.variant"
									:icon="risk.meta.icon"
									size="sm"
									data-testid="risk-flag"
									:data-tier="risk.tier"
									:title="risk.summary"
									>{{ risk.meta.label }}</UBadge
								>

								<template #content>
									<div class="max-w-xs p-3 flex flex-col gap-2">
										<p class="text-sm font-medium">Reviewer Scan &mdash; {{ risk.meta.label }}</p>
										<ul
											v-if="risk.risks.length"
											class="flex flex-col gap-1"
										>
											<li
												v-for="signal in risk.risks"
												:key="signal.id"
												class="flex items-start gap-1.5 text-xs e-text-danger"
											>
												<UIcon
													name="mdi:alert-circle-outline"
													class="size-4 shrink-0 mt-px"
												/>
												<span>{{ signal.label }}</span>
											</li>
										</ul>
										<ul
											v-if="risk.positives.length"
											class="flex flex-col gap-1"
										>
											<li
												v-for="signal in risk.positives"
												:key="signal.id"
												class="flex items-start gap-1.5 text-xs text-muted"
											>
												<UIcon
													name="mdi:check-circle-outline"
													class="size-4 shrink-0 mt-px"
												/>
												<span>{{ signal.label }}</span>
											</li>
										</ul>
										<p class="text-xs text-dimmed">
											A quick scan of the submitted text. Guidance only, nothing is decided for you.
										</p>
									</div>
								</template>
							</UPopover>
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

		<div ref="bottomBarEl">
			<AdminApprovalsBulkBar
				v-if="showBottomBar"
				v-bind="bulkBarProps"
				position="bottom"
				@toggle-all="toggleAll"
				@clear="clearSelection"
				@act="bulkAct"
			/>
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

		<ClientOnly>
			<Teleport to="body">
				<Transition
					enter-active-class="transition duration-200 ease-out"
					enter-from-class="opacity-0 translate-y-3"
					leave-active-class="transition duration-150 ease-in"
					leave-to-class="opacity-0 translate-y-3"
				>
					<div
						v-if="showFloatingBar"
						class="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 pb-[env(safe-area-inset-bottom)] pointer-events-none"
					>
						<div class="pointer-events-auto max-w-full overflow-x-auto">
							<AdminApprovalsBulkBar
								v-bind="bulkBarProps"
								position="floating"
								@toggle-all="toggleAll"
								@clear="clearSelection"
								@act="bulkAct"
							/>
						</div>
					</div>
				</Transition>
			</Teleport>
		</ClientOnly>

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
import type { StagedRiskAssessment, StagedRiskTierMeta } from '~/shared/utils/stagedRisk';
import {
	assessStagedActivity,
	isSuspiciousTier,
	STAGED_RISK_TIERS
} from '~/shared/utils/stagedRisk';

const toast = useToast();
const { list, approve, deny } = useStagedActivities();

// below this a second toolbar is just noise; the whole list is on screen already
const BOTTOM_BAR_MIN_ROWS = 5;

const items = ref<StagedActivity[]>([]);
const total = ref(0);
const page = ref(1);
const limit = 50;
const loading = ref(false);
const state = ref<StagedActivityState>('pending');
const busy = reactive<Record<number, 'approve' | 'deny' | null>>({});
const editing = ref<StagedActivity | null>(null);
const editorOpen = ref(false);
const bulkBusy = ref<'approve' | 'deny' | null>(null);
const bulkProgress = ref(0);

// keyed by id and holding the row itself, so a selection survives paging away from it
const selection = ref(new Map<number, StagedActivity>());

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

const pendingItems = computed(() => items.value.filter((item) => item.state === 'pending'));

// #region risk scan

type RowRisk = StagedRiskAssessment & { meta: StagedRiskTierMeta; summary: string };

const risks = computed(() => {
	const map = new Map<number, RowRisk>();
	for (const item of items.value) {
		const assessment = assessStagedActivity(item);
		const meta = STAGED_RISK_TIERS[assessment.tier];
		map.set(item.id, {
			...assessment,
			meta,
			// the popover is hover-only, so the same reasons ride along as a native tooltip
			summary: `${meta.label}: ${assessment.signals.map((signal) => signal.label).join('; ')}`
		});
	}
	return map;
});

const rows = computed(() =>
	items.value.map((staged) => ({ staged, risk: risks.value.get(staged.id)! }))
);

const flaggedSelected = computed(
	() =>
		[...selection.value.values()].filter((item) =>
			isSuspiciousTier(assessStagedActivity(item).tier)
		).length
);

// #endregion

// #region selection

const pageSelected = computed(
	() => pendingItems.value.filter((item) => selection.value.has(item.id)).length
);
const totalSelected = computed(() => selection.value.size);
const offPageSelected = computed(() => totalSelected.value - pageSelected.value);
const allSelected = computed(
	() => pendingItems.value.length > 0 && pageSelected.value === pendingItems.value.length
);
const someSelected = computed(() => pageSelected.value > 0 && !allSelected.value);

const hasBulkBar = computed(() => pendingItems.value.length > 0 || totalSelected.value > 0);
const showBottomBar = computed(() => hasBulkBar.value && items.value.length >= BOTTOM_BAR_MIN_ROWS);

const bulkBarProps = computed(() => ({
	pageSelected: pageSelected.value,
	pageTotal: pendingItems.value.length,
	totalSelected: totalSelected.value,
	offPageSelected: offPageSelected.value,
	allSelected: allSelected.value,
	someSelected: someSelected.value,
	busy: bulkBusy.value,
	progress: bulkProgress.value,
	flagged: flaggedSelected.value
}));

function toggleAll() {
	if (allSelected.value) {
		for (const item of pendingItems.value) selection.value.delete(item.id);
		return;
	}
	for (const item of pendingItems.value) selection.value.set(item.id, item);
}

function toggleOne(staged: StagedActivity) {
	if (selection.value.has(staged.id)) selection.value.delete(staged.id);
	else selection.value.set(staged.id, staged);
}

function clearSelection() {
	selection.value.clear();
}

/**
 * A selection outlives the page it was made on, so only the ids the server just reported can
 * be pruned. Anything else is sitting on a page we are not looking at and stays selected.
 */
function reconcileSelection() {
	for (const item of items.value) {
		if (!selection.value.has(item.id)) continue;
		if (item.state === 'pending') selection.value.set(item.id, item);
		else selection.value.delete(item.id);
	}
}

// #endregion

// #region floating bar visibility

const topBarEl = useTemplateRef<HTMLElement>('topBarEl');
const bottomBarEl = useTemplateRef<HTMLElement>('bottomBarEl');
const topBarPassed = ref(false);
const bottomBarVisible = ref(false);

useIntersectionObserver(topBarEl, ([entry]) => {
	// scrolled ABOVE the viewport specifically; "not intersecting" is also true for a element
	// that was never laid out, which would float the island over a page nobody scrolled
	topBarPassed.value = !!entry && !entry.isIntersecting && entry.boundingClientRect.bottom < 0;
});

useIntersectionObserver(bottomBarEl, ([entry]) => {
	bottomBarVisible.value = entry?.isIntersecting ?? false;
});

watch(showBottomBar, (shown) => {
	if (!shown) bottomBarVisible.value = false;
});

const showFloatingBar = computed(
	() => hasBulkBar.value && topBarPassed.value && !bottomBarVisible.value
);

// #endregion

function stateLabelOf(value: StagedActivityState): string {
	return stateItems.find((item) => item.value === value)?.label ?? value;
}

function typeLabel(type: string): string {
	return type
		.replace(/_/g, ' ')
		.toLowerCase()
		.replace(/\b\w/g, (character) => character.toUpperCase());
}

// read from the contract field rather than derived from submitter_kind; the server owns
// which way an unreviewed row resolves
function expiryLabel(staged: StagedActivity): string {
	if (staged.state !== 'pending') return 'Resolved';

	const relative = DateTime.fromISO(staged.expires_at).toRelative() ?? 'soon';
	return staged.fails_open ? `Auto-publishes ${relative}` : `Auto-denies ${relative}`;
}

// urgency is purely how long is left; a row that will be denied unreviewed is still work lost
function expiryColor(staged: StagedActivity): 'warning' | 'neutral' | 'error' {
	if (staged.state !== 'pending') return 'neutral';
	if (staged.expires_in_seconds < 2 * 3600) return 'error';
	return staged.expires_in_seconds < 24 * 3600 ? 'warning' : 'neutral';
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
		reconcileSelection();
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

/**
 * Whether a single-row action needs a confirm.
 *
 * Skipped where the reviewer scan already agrees with the reviewer: denying something it flagged
 * suspicious, or approving something it rates `looks_safe`/`safe`. Those are the two cases where the
 * prompt only adds a keystroke to the outcome you were going to pick anyway. Everything in between
 * still confirms, and **bulk always confirms** regardless of tier - see `bulkAct`.
 */
function needsConfirm(staged: StagedActivity, action: 'approve' | 'deny'): boolean {
	const tier = risks.value.get(staged.id)?.tier;
	if (!tier) return true;
	if (action === 'deny') return !isSuspiciousTier(tier);
	return tier !== 'looks_safe' && tier !== 'safe';
}

async function act(staged: StagedActivity, action: 'approve' | 'deny') {
	if (needsConfirm(staged, action) && !confirm(confirmCopy[action](staged))) return;

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
			selection.value.delete(staged.id);
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

/**
 * Sequential on purpose: every approve creates a node on the mantle2 side, and a serial
 * loop gives an exact per-item outcome instead of an all-or-nothing failure. Targets come
 * from the selection rather than the page, so a queue built across several pages runs whole.
 *
 * **Always confirms**, whatever the tiers say. `needsConfirm` deliberately does not apply here: a
 * bulk run is irreversible across many rows at once, and the reviewer cannot have looked at each.
 */
async function bulkAct(action: 'approve' | 'deny') {
	const targets = [...selection.value.values()];
	if (targets.length === 0) return;

	const verb = action === 'approve' ? 'Approve' : 'Deny';
	const consequence =
		action === 'approve'
			? 'They will be published to the activity catalog immediately.'
			: 'They will not be published, and automated discovery will not propose them again.';
	// only worth saying on the approve path; denying a flagged submission is the expected outcome
	const flagged = action === 'approve' ? flaggedSelected.value : 0;
	const warning = flagged
		? ` ${flagged} of them ${flagged === 1 ? 'is' : 'are'} flagged as suspicious by the reviewer scan.`
		: '';

	if (
		!confirm(
			`${verb} ${targets.length} staged ${targets.length === 1 ? 'activity' : 'activities'}?${warning} ${consequence}`
		)
	)
		return;

	bulkBusy.value = action;
	bulkProgress.value = 0;
	let succeeded = 0;
	const failures: string[] = [];

	try {
		for (const target of targets) {
			const res = action === 'approve' ? await approve(target.id) : await deny(target.id);
			if (res.success) {
				succeeded++;
				// dropped as it lands, so a partial run leaves exactly the unresolved rows selected
				selection.value.delete(target.id);
			} else {
				failures.push(res.message ?? `#${target.id}`);
			}
			bulkProgress.value++;
		}
	} finally {
		bulkBusy.value = null;
		bulkProgress.value = 0;
		await load();
	}

	if (failures.length === 0) {
		toast.add({
			title:
				action === 'approve'
					? `${succeeded} ${succeeded === 1 ? 'Activity' : 'Activities'} Published`
					: `${succeeded} ${succeeded === 1 ? 'Submission' : 'Submissions'} Denied`,
			icon: action === 'approve' ? 'mdi:check-circle' : 'mdi:close-circle',
			color: action === 'approve' ? 'success' : 'warning',
			duration: 3000
		});
		return;
	}

	toast.add({
		title: 'Some Actions Failed',
		description: `${succeeded} succeeded, ${failures.length} failed. ${failures[0]}`,
		icon: 'mdi:alert-circle',
		color: 'error'
	});
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
			selection.value.delete(staged.id);
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
