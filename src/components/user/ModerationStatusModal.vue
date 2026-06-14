<template>
	<UModal
		v-model:open="open"
		title="Moderation Status"
		description="Your account standing and any content removed by moderators."
	>
		<template #body>
			<div class="flex flex-col gap-4 w-full">
				<div
					v-if="loading"
					class="flex flex-col gap-2"
				>
					<USkeleton class="h-10 w-48 rounded-lg" />
					<USkeleton class="h-16 w-full rounded-lg" />
				</div>

				<template v-else-if="status">
					<div class="flex flex-col gap-2">
						<div class="flex items-center gap-2 flex-wrap">
							<UBadge
								:color="standingColor"
								variant="subtle"
								:icon="standingIcon"
								size="lg"
								>{{ standingLabel }}</UBadge
							>
							<span class="text-sm text-muted"> {{ status.count }} of 3 strikes used </span>
						</div>
						<p
							v-if="status.disabled_until && status.standing === 'disabled'"
							class="text-xs text-muted"
						>
							Disabled until {{ formatDate(status.disabled_until) }}
						</p>
					</div>

					<div
						v-if="status.history.length === 0"
						class="text-sm text-muted py-6 text-center rounded border border-default border-dashed"
					>
						No moderation actions on your account.
					</div>

					<div
						v-else
						class="rounded-lg border border-default divide-y divide-default overflow-hidden"
					>
						<div
							v-for="(entry, i) in status.history"
							:key="`${entry.content_id}-${entry.at}-${i}`"
							class="flex flex-col gap-1 px-3 py-3"
						>
							<div class="flex items-center gap-2 flex-wrap">
								<UBadge
									color="warning"
									variant="subtle"
									icon="mdi:flag-outline"
									>{{ reasonLabel(entry.reason) }}</UBadge
								>
								<UBadge
									color="neutral"
									variant="subtle"
									>{{ contentTypeLabel(entry.content_type) }}</UBadge
								>
								<UBadge
									:color="entry.source === 'ai' ? 'info' : 'neutral'"
									variant="subtle"
									:icon="entry.source === 'ai' ? 'mdi:robot-outline' : 'mdi:flag'"
									>{{ entry.source === 'ai' ? 'AI' : 'Report' }}</UBadge
								>
								<span class="text-xs text-muted">{{ age(entry.at) }}</span>
							</div>
							<p
								v-if="entry.preview"
								class="text-xs text-muted wrap-break-word max-w-2xl italic"
							>
								"{{ entry.preview }}"
							</p>
							<p
								v-if="entry.action_notes"
								class="text-xs text-muted wrap-break-word max-w-2xl"
							>
								Moderator note: {{ entry.action_notes }}
							</p>
						</div>
					</div>
				</template>

				<div
					v-else
					class="text-sm text-muted py-6 text-center rounded border border-default border-dashed"
				>
					No moderation actions on your account.
				</div>
			</div>
		</template>
	</UModal>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import type { ContentType, ReportReason, StrikeStanding } from 'types/report';
import { reportReasonLabel } from 'types/report';

const open = ref(false);
const loading = ref(false);

const toast = useToast();
const i18n = useI18n();
const { status, fetchModeration } = useModeration();

const standingColor = computed<'success' | 'warning' | 'error'>(() => {
	switch (status.value?.standing) {
		case 'disabled':
			return 'warning';
		case 'banned':
			return 'error';
		default:
			return 'success';
	}
});

const standingLabels: Record<StrikeStanding, string> = {
	ok: 'Good Standing',
	disabled: 'Temporarily Disabled',
	banned: 'Suspended'
};
const standingLabel = computed(() => standingLabels[status.value?.standing ?? 'ok']);

const standingIcons: Record<StrikeStanding, string> = {
	ok: 'mdi:shield-check-outline',
	disabled: 'mdi:shield-alert-outline',
	banned: 'mdi:shield-off-outline'
};
const standingIcon = computed(() => standingIcons[status.value?.standing ?? 'ok']);

const contentTypeLabels: Record<ContentType, string> = {
	prompt: 'Prompt',
	prompt_response: 'Prompt Response',
	article: 'Article',
	event: 'Event',
	event_image: 'Event Image',
	user: 'User'
};
const contentTypeLabel = (t: ContentType): string => contentTypeLabels[t] ?? t;
const reasonLabel = (r: ReportReason): string => reportReasonLabel(r);

const age = (at: number): string =>
	DateTime.fromMillis(at).toRelative({ locale: i18n.locale.value }) || 'sometime';
const formatDate = (at: number): string =>
	DateTime.fromMillis(at).toLocaleString(DateTime.DATETIME_MED, { locale: i18n.locale.value });

const load = async () => {
	loading.value = true;
	try {
		const res = await fetchModeration();
		if (!res.success) {
			toast.add({
				title: 'Failed to Load Moderation Status',
				description: res.message || 'Could not load your moderation status.',
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 5000
			});
		}
	} finally {
		loading.value = false;
	}
};

watch(open, (isOpen) => {
	if (isOpen) load();
});

export interface ModerationStatusModalRef {
	open: () => void;
	close: () => void;
}

defineExpose<ModerationStatusModalRef>({
	open: () => {
		open.value = true;
	},
	close: () => {
		open.value = false;
	}
});
</script>
