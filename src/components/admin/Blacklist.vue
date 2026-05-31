<template>
	<div class="flex flex-col gap-4">
		<div class="flex items-start justify-between gap-3 flex-wrap">
			<div>
				<h2 class="text-xl font-semibold">Username & Email Blacklist</h2>
				<p class="text-sm text-muted mt-1">
					Block signups before they happen. Use a trailing
					<code class="bg-elevated px-1 rounded">*</code> for prefix matching (e.g.
					<code class="bg-elevated px-1 rounded">spam*</code>).
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

		<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
			<div class="rounded-lg border border-default p-3 flex flex-col gap-2">
				<USelect
					v-model="newKind"
					:items="[
						{ label: 'Username', value: 'username', icon: 'mdi:account-cancel' },
						{ label: 'Email', value: 'email', icon: 'mdi:email-off' }
					]"
				/>
				<UInput
					v-model="newValue"
					placeholder="e.g. badname or evilcorp*"
					:disabled="adding"
				/>
				<UInput
					v-model="newReason"
					placeholder="Reason (visible to other admins)"
					:disabled="adding"
				/>
				<UButton
					icon="mdi:plus"
					color="primary"
					:loading="adding"
					:disabled="!newValue.trim()"
					@click="add"
					>Add to Blacklist</UButton
				>
				<p
					v-if="addError"
					class="text-sm text-error"
				>
					{{ addError }}
				</p>
			</div>
			<div class="rounded-lg border border-default p-3">
				<p class="text-xs font-medium text-muted uppercase tracking-wide mb-2">Quick Stats</p>
				<div class="grid grid-cols-3 gap-2">
					<div class="text-center">
						<p class="text-2xl font-bold">{{ entries.length }}</p>
						<p class="text-xs text-muted">Total</p>
					</div>
					<div class="text-center">
						<p class="text-2xl font-bold">{{ usernameCount }}</p>
						<p class="text-xs text-muted">Usernames</p>
					</div>
					<div class="text-center">
						<p class="text-2xl font-bold">{{ emailCount }}</p>
						<p class="text-xs text-muted">Emails</p>
					</div>
				</div>
			</div>
		</div>

		<UInput
			v-model="filter"
			placeholder="Filter blacklist..."
			icon="mdi:magnify"
		/>

		<div class="rounded-lg border border-default divide-y divide-default max-h-96 overflow-y-auto">
			<div
				v-if="!loading && filtered.length === 0"
				class="p-4 text-center text-sm text-muted"
			>
				{{ entries.length === 0 ? 'No entries yet.' : 'No matches.' }}
			</div>
			<div
				v-for="entry in filtered"
				:key="`${entry.kind}-${entry.value}`"
				class="flex items-center justify-between gap-3 px-3 py-2"
			>
				<div class="flex items-center gap-2 min-w-0">
					<UBadge
						:color="entry.kind === 'username' ? 'info' : 'warning'"
						variant="subtle"
						size="sm"
					>
						{{ entry.kind }}
					</UBadge>
					<div class="min-w-0">
						<p class="font-mono text-sm truncate">{{ entry.original_value }}</p>
						<p
							v-if="entry.reason"
							class="text-xs text-muted truncate"
						>
							{{ entry.reason }}
							<span v-if="entry.added_by"> · by {{ entry.added_by }}</span>
						</p>
					</div>
				</div>
				<UButton
					icon="mdi:delete-outline"
					color="error"
					variant="ghost"
					size="xs"
					@click="remove(entry)"
				>
					Remove
				</UButton>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
type BlacklistEntry = {
	kind: 'username' | 'email';
	value: string;
	original_value: string;
	reason: string;
	added_at: number;
	added_by?: string;
};

const authStore = useAuthStore();
const toast = useToast();

const entries = ref<BlacklistEntry[]>([]);
const loading = ref(false);
const filter = ref('');

const newKind = ref<'username' | 'email'>('username');
const newValue = ref('');
const newReason = ref('');
const adding = ref(false);
const addError = ref('');

const usernameCount = computed(() => entries.value.filter((e) => e.kind === 'username').length);
const emailCount = computed(() => entries.value.filter((e) => e.kind === 'email').length);
const filtered = computed(() => {
	const f = filter.value.trim().toLowerCase();
	if (!f) return entries.value;
	return entries.value.filter(
		(e) =>
			e.value.includes(f) ||
			e.original_value.toLowerCase().includes(f) ||
			e.reason.toLowerCase().includes(f)
	);
});

async function load() {
	loading.value = true;
	try {
		const res = await makeClientAPIRequest<{ entries: BlacklistEntry[] }>(
			`/v2/admin/blacklist`,
			authStore.sessionToken
		);
		if (valid(res)) entries.value = res.data.entries || [];
	} finally {
		loading.value = false;
	}
}

async function add() {
	if (!newValue.value.trim()) return;
	adding.value = true;
	addError.value = '';
	try {
		const res = await makeClientAPIRequest<{ entry: BlacklistEntry }>(
			`/v2/admin/blacklist`,
			authStore.sessionToken,
			{
				method: 'POST',
				body: { kind: newKind.value, value: newValue.value.trim(), reason: newReason.value.trim() }
			}
		);
		if (valid(res)) {
			toast.add({
				title: 'Added to Blacklist',
				description: `${newKind.value}: ${newValue.value}`,
				color: 'success',
				icon: 'mdi:shield-check',
				duration: 3000
			});
			newValue.value = '';
			newReason.value = '';
			await load();
		} else {
			addError.value = res.message || 'Failed to add';
		}
	} catch (e: any) {
		addError.value = e?.message || 'Failed to add';
	} finally {
		adding.value = false;
	}
}

async function remove(entry: BlacklistEntry) {
	const res = await makeClientAPIRequest<void>(
		`/v2/admin/blacklist?kind=${entry.kind}&value=${encodeURIComponent(entry.original_value)}`,
		authStore.sessionToken,
		{ method: 'DELETE' }
	);
	if (res.success) {
		toast.add({
			title: 'Removed',
			description: `${entry.kind}: ${entry.original_value}`,
			color: 'success',
			icon: 'mdi:check-circle',
			duration: 2500
		});
		await load();
	} else {
		toast.add({
			title: 'Failed to Remove',
			description: res.message || 'Unknown error',
			color: 'error',
			icon: 'mdi:alert-circle',
			duration: 4000
		});
	}
}

onMounted(load);
</script>
