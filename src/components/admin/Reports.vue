<template>
	<div class="flex flex-col gap-4">
		<div class="flex items-start justify-between gap-3 flex-wrap">
			<div>
				<h2 class="text-xl font-semibold">Content Reports</h2>
				<p class="text-sm text-muted mt-1">
					Review reported content. Dismiss false reports, remove content, or ban repeat offenders.
					Destructive actions accrue strikes and notify affected users.
				</p>
			</div>
			<UButton
				icon="mdi:refresh"
				variant="ghost"
				color="neutral"
				:loading="loading"
				@click="load"
				>Refresh</UButton
			>
		</div>

		<div class="flex items-end gap-3 flex-wrap">
			<USelect
				v-model="status"
				:items="statusItems"
				class="w-48"
				@update:model-value="onStatusChange"
			/>
			<UButton
				icon="mdi:flag-outline"
				color="primary"
				variant="soft"
				:loading="loading"
				:disabled="loading"
				@click="load"
				>Load Reports</UButton
			>
		</div>

		<div
			v-if="reports.length === 0 && !loading"
			class="text-sm text-muted py-4 text-center rounded border border-default border-dashed"
		>
			No {{ status }} reports.
		</div>

		<div class="rounded-lg border border-default divide-y divide-default overflow-hidden">
			<div
				v-for="r in reports"
				:key="r.id"
				class="flex flex-col gap-3 px-3 py-3"
			>
				<div class="flex items-start justify-between gap-3 flex-wrap">
					<div class="min-w-0 flex flex-col gap-1">
						<div class="flex items-center gap-2 flex-wrap">
							<UBadge
								color="neutral"
								variant="subtle"
								>{{ contentTypeLabel(r.content_type) }}</UBadge
							>
							<UBadge
								color="warning"
								variant="subtle"
								icon="mdi:flag-outline"
								>{{ reasonLabel(r.reason) }}</UBadge
							>
							<UBadge
								v-if="r.report_count > 1"
								color="error"
								variant="subtle"
								>{{ r.report_count }} reports</UBadge
							>
							<UBadge
								v-if="r.source === 'ai'"
								color="info"
								variant="subtle"
								icon="mdi:robot-outline"
								>AI</UBadge
							>
						</div>
						<p class="text-sm wrap-break-word max-w-2xl">
							{{ r.content_preview || '(no preview)' }}
						</p>
						<p
							v-if="r.description"
							class="text-xs text-muted wrap-break-word max-w-2xl italic"
						>
							"{{ r.description }}"
						</p>
						<p class="text-xs text-muted">
							Reporter:
							<span class="font-mono">{{
								r.reporter_username ? '@' + r.reporter_username : 'anonymous'
							}}</span>
							· Author:
							<span class="font-mono">{{
								r.author_username ? '@' + r.author_username : 'unknown'
							}}</span>
							· {{ age(r.created_at) }}
						</p>
						<div
							v-if="r.ai?.labels?.length"
							class="flex items-center gap-1 flex-wrap mt-0.5"
						>
							<UBadge
								v-for="label in r.ai.labels"
								:key="label"
								size="xs"
								color="info"
								variant="outline"
								>{{ label }}</UBadge
							>
						</div>
					</div>
				</div>

				<div
					v-if="r.status === 'pending'"
					class="flex flex-col gap-2 border-t border-default pt-2"
				>
					<div class="flex items-center gap-4 flex-wrap">
						<UCheckbox
							:model-value="notify[r.id]?.reporter || false"
							label="Notify reporter"
							:disabled="!r.reporter_username"
							@update:model-value="(v) => setNotify(r.id, 'reporter', v)"
						/>
						<UCheckbox
							:model-value="notify[r.id]?.author || false"
							label="Notify author"
							:disabled="!r.author_username"
							@update:model-value="(v) => setNotify(r.id, 'author', v)"
						/>
					</div>
					<div class="flex flex-wrap gap-1.5">
						<UButton
							size="xs"
							color="neutral"
							variant="soft"
							icon="mdi:check"
							:loading="busy[r.id] === 'dismiss'"
							:disabled="!!busy[r.id]"
							@click="act(r, 'dismiss')"
							>Dismiss</UButton
						>
						<UButton
							size="xs"
							color="warning"
							variant="soft"
							icon="mdi:delete-outline"
							:loading="busy[r.id] === 'delete_content'"
							:disabled="!!busy[r.id]"
							@click="act(r, 'delete_content')"
							>Delete Content</UButton
						>
						<UButton
							size="xs"
							color="error"
							variant="soft"
							icon="mdi:account-cancel"
							:loading="busy[r.id] === 'ban_user'"
							:disabled="!!busy[r.id]"
							@click="act(r, 'ban_user')"
							>Ban User</UButton
						>
					</div>
				</div>
				<div
					v-else
					class="text-xs text-muted border-t border-default pt-2"
				>
					Status: {{ r.status }}{{ r.reviewed_by ? ` · reviewed by ${r.reviewed_by}` : '' }}
				</div>
			</div>
		</div>

		<div
			v-if="reports.length > 0"
			class="flex items-center justify-between gap-2"
		>
			<UButton
				variant="ghost"
				color="neutral"
				icon="mdi:chevron-left"
				:disabled="page <= 1 || loading"
				@click="changePage(page - 1)"
				>Previous</UButton
			>
			<span class="text-sm text-muted">Page {{ page }}</span>
			<UButton
				variant="ghost"
				color="neutral"
				trailing-icon="mdi:chevron-right"
				:disabled="!hasMore || loading"
				@click="changePage(page + 1)"
				>Next</UButton
			>
		</div>
	</div>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import type { ContentType, ReportListItem, ReportReason, ReportStatus } from 'types/report';
import { reportReasonLabel } from 'types/report';

type AdminAction = 'dismiss' | 'delete_content' | 'ban_user';

const { listReports, patchReport } = useReport();
const toast = useToast();
const i18n = useI18n();

const reports = ref<ReportListItem[]>([]);
const loading = ref(false);
const status = ref<ReportStatus>('pending');
const page = ref(1);
const limit = 50;
const hasMore = ref(false);
const busy = reactive<Record<string, AdminAction | null>>({});
const notify = reactive<Record<string, { reporter: boolean; author: boolean }>>({});

const statusItems: { label: string; value: ReportStatus }[] = [
	{ label: 'Pending', value: 'pending' },
	{ label: 'Actioned', value: 'actioned' },
	{ label: 'Auto-removed', value: 'auto_removed' },
	{ label: 'Dismissed', value: 'dismissed' },
	{ label: 'Expired', value: 'expired' }
];

const contentTypeLabels: Record<ContentType, string> = {
	prompt: 'Prompt',
	prompt_response: 'Prompt Response',
	article: 'Article',
	event: 'Event',
	event_image: 'Event Image',
	user: 'User'
};

function contentTypeLabel(t: ContentType): string {
	return contentTypeLabels[t] ?? t;
}

function reasonLabel(r: ReportReason): string {
	return reportReasonLabel(r);
}

function age(createdAt: number): string {
	return DateTime.fromMillis(createdAt).toRelative({ locale: i18n.locale.value }) || 'sometime';
}

function setNotify(id: string, key: 'reporter' | 'author', value: string | boolean) {
	if (!notify[id]) notify[id] = { reporter: false, author: false };
	notify[id][key] = Boolean(value);
}

async function load() {
	loading.value = true;
	try {
		const res = await listReports(status.value, page.value, limit);
		if (res.success && res.data) {
			reports.value = res.data.reports || [];
			hasMore.value = reports.value.length >= limit;
		} else {
			reports.value = [];
			toast.add({
				title: 'Failed to Load Reports',
				description: res.message || 'Could not load reports.',
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 5000
			});
		}
	} finally {
		loading.value = false;
	}
}

function onStatusChange() {
	page.value = 1;
	load();
}

function changePage(next: number) {
	if (next < 1) return;
	page.value = next;
	load();
}

const confirmCopy: Record<AdminAction, string> = {
	dismiss: 'Dismiss this report? No action will be taken against the content or author.',
	delete_content:
		'Delete this content? This removes it permanently and adds a strike to the author.',
	ban_user: 'Ban this user? Their account will be disabled or permanently banned.'
};

async function act(report: ReportListItem, action: AdminAction) {
	// destructive actions are confirmed; dismiss too for safety
	if (!confirm(confirmCopy[action])) return;

	busy[report.id] = action;
	try {
		const res = await patchReport(report.id, {
			action,
			notify_reporter: notify[report.id]?.reporter || false,
			notify_author: notify[report.id]?.author || false
		});
		if (res.success) {
			const enforced = res.data?.enforced_action;
			toast.add({
				title:
					action === 'dismiss'
						? 'Report Dismissed'
						: action === 'delete_content'
							? 'Content Removed'
							: 'User Banned',
				description:
					enforced && enforced !== 'none'
						? `Enforcement: ${enforced.replace(/_/g, ' ')}`
						: 'Report resolved.',
				icon: 'mdi:check',
				color: 'success',
				duration: 4000
			});
			await load();
		} else {
			toast.add({
				title: 'Action Failed',
				description: res.message || 'Could not update the report.',
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 6000
			});
		}
	} finally {
		busy[report.id] = null;
	}
}

onMounted(load);
</script>
