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
				icon="mdi:shield-account-outline"
				color="primary"
				variant="soft"
				:loading="loading"
				:disabled="loading"
				@click="load"
				>Load Applications</UButton
			>
		</div>

		<div
			v-if="items.length === 0 && !loading"
			class="text-sm text-muted py-4 text-center rounded border border-default border-dashed"
		>
			No {{ state }} applications.
		</div>

		<div
			v-else
			class="rounded-lg border border-default divide-y divide-default overflow-hidden"
		>
			<div
				v-for="application in items"
				:key="application.user?.id"
				class="flex flex-col gap-3 px-3 py-3"
			>
				<div class="flex items-start justify-between gap-3 flex-wrap">
					<div class="min-w-0 flex flex-col gap-2">
						<div class="flex items-center gap-2 flex-wrap">
							<span class="font-semibold">@{{ application.user?.username }}</span>
							<UBadge
								color="neutral"
								variant="subtle"
								size="sm"
								>{{ application.user?.account_type }}</UBadge
							>
							<UBadge
								v-if="application.user?.account_type !== 'ORGANIZER'"
								color="warning"
								variant="subtle"
								icon="mdi:alert"
								size="sm"
								>No Longer an Organizer</UBadge
							>
						</div>

						<p
							v-if="application.organization"
							class="text-sm"
						>
							{{ application.organization }}
						</p>

						<p
							v-if="application.reason"
							class="text-xs text-muted italic wrap-break-word max-w-2xl"
						>
							&ldquo;{{ application.reason }}&rdquo;
						</p>

						<div
							v-if="application.links?.length"
							class="flex items-center gap-2 flex-wrap"
						>
							<ULink
								v-for="link in application.links"
								:key="link"
								:to="link"
								target="_blank"
								rel="noopener noreferrer"
								class="text-xs text-primary"
								>{{ link }}</ULink
							>
						</div>
					</div>

					<span class="text-xs text-muted shrink-0">{{ age(application.applied_at) }}</span>
				</div>

				<div
					v-if="application.state === 'pending'"
					class="flex items-end gap-2 flex-wrap"
				>
					<UInput
						v-model="notes[application.user?.id ?? '']"
						placeholder="Reviewer notes (optional)"
						size="sm"
						class="w-72"
					/>
					<UButton
						size="sm"
						color="success"
						variant="soft"
						icon="mdi:check-decagram"
						:loading="busy[application.user?.id ?? ''] === 'approve'"
						:disabled="!!busy[application.user?.id ?? '']"
						@click="act(application, 'approve')"
						>Approve</UButton
					>
					<UButton
						size="sm"
						color="error"
						variant="soft"
						icon="mdi:close"
						:loading="busy[application.user?.id ?? ''] === 'deny'"
						:disabled="!!busy[application.user?.id ?? '']"
						@click="act(application, 'deny')"
						>Deny</UButton
					>
				</div>
				<div
					v-else
					class="flex items-center gap-2 flex-wrap text-xs text-muted"
				>
					<span>Status: {{ application.state }}</span>
					<span v-if="application.notes">&mdash; {{ application.notes }}</span>
					<UButton
						v-if="application.state === 'approved'"
						size="xs"
						color="error"
						variant="ghost"
						icon="mdi:shield-off-outline"
						:loading="busy[application.user?.id ?? ''] === 'revoke'"
						@click="act(application, 'revoke')"
						>Revoke</UButton
					>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import type { VerifiedPublisher, VerifiedPublisherState } from 'types/user';

const toast = useToast();
const { listApplications, review } = useVerifiedPublisher();

const items = ref<VerifiedPublisher[]>([]);
const loading = ref(false);
const state = ref<VerifiedPublisherState>('pending');
const busy = reactive<Record<string, 'approve' | 'deny' | 'revoke' | null>>({});
const notes = reactive<Record<string, string>>({});

const emit = defineEmits<{ (event: 'count', value: number): void }>();

const stateItems = [
	{ label: 'Pending', value: 'pending' },
	{ label: 'Approved', value: 'approved' },
	{ label: 'Denied', value: 'denied' },
	{ label: 'Revoked', value: 'revoked' }
];

function age(value?: string | null): string {
	if (!value) return '';
	return `Applied ${DateTime.fromISO(value).toRelative() ?? 'recently'}`;
}

async function load() {
	loading.value = true;
	try {
		const res = await listApplications(state.value);
		if (res.success && res.data) {
			items.value = res.data.items ?? [];
		} else {
			items.value = [];
			toast.add({
				title: 'Failed to Load Applications',
				description: res.message,
				icon: 'mdi:alert-circle',
				color: 'error'
			});
		}
	} finally {
		loading.value = false;
		if (state.value === 'pending') emit('count', items.value.length);
	}
}

function onStateChange() {
	load();
}

const confirmCopy: Record<'approve' | 'deny' | 'revoke', (username: string) => string> = {
	approve: (username) =>
		`Approve @${username} as a verified publisher? They will be able to submit activities for review and receive the verified chip.`,
	deny: (username) => `Deny @${username}'s verified publisher application?`,
	revoke: (username) =>
		`Revoke @${username}'s verified publisher status? Every pending submission of theirs will be denied.`
};

async function act(
	application: VerifiedPublisher,
	action: 'approve' | 'deny' | 'revoke'
): Promise<void> {
	const id = application.user?.id;
	const username = application.user?.username ?? 'this user';
	if (!id || !confirm(confirmCopy[action](username))) return;

	busy[id] = action;
	try {
		const res = await review(id, action, notes[id] || undefined);
		if (res.success) {
			const revoked = res.data?.revoked_staged ?? 0;
			toast.add({
				title: action === 'approve' ? 'Publisher Verified' : 'Application Updated',
				description:
					action === 'revoke' && revoked > 0
						? `${revoked} pending submission(s) were withdrawn.`
						: undefined,
				icon: 'mdi:shield-check',
				color: action === 'approve' ? 'success' : 'warning',
				duration: 4000
			});
			notes[id] = '';
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
		busy[id] = null;
	}
}

onMounted(load);
defineExpose({ load });
</script>
