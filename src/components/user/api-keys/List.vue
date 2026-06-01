<template>
	<div class="flex flex-col gap-3 w-full">
		<div
			v-if="keys.length === 0"
			class="text-center text-sm opacity-70 py-8"
		>
			No API keys yet. Click "Generate Key" to create one.
		</div>

		<div
			v-for="key in keys"
			:key="key.id"
			class="rounded border border-default p-3 flex flex-col gap-2"
			:class="{
				'opacity-60': key.revoked || key.expired
			}"
		>
			<div class="flex items-start justify-between gap-2">
				<div class="flex flex-col gap-1 min-w-0">
					<div class="flex items-center gap-2 flex-wrap">
						<div class="font-semibold truncate">{{ key.name }}</div>
						<UBadge
							v-if="key.revoked"
							color="error"
							variant="subtle"
							size="xs"
						>
							Revoked
						</UBadge>
						<UBadge
							v-else-if="key.expired"
							color="error"
							variant="subtle"
							size="xs"
						>
							Expired
						</UBadge>
						<UBadge
							v-else-if="key.never_expires"
							color="warning"
							variant="subtle"
							size="xs"
							icon="mdi:infinity"
						>
							No Expiration
						</UBadge>
						<UBadge
							v-else
							color="success"
							variant="subtle"
							size="xs"
						>
							Active
						</UBadge>
					</div>
					<code class="font-mono text-xs opacity-80">{{ key.token_prefix }}…</code>
					<div
						v-if="key.description"
						class="text-xs opacity-80"
					>
						{{ key.description }}
					</div>
				</div>
				<div class="flex items-center gap-1 shrink-0">
					<UButton
						v-if="!key.revoked && !key.expired"
						icon="mdi:pencil"
						color="neutral"
						variant="ghost"
						size="sm"
						@click="emit('edit', key)"
					>
						Edit
					</UButton>
					<UButton
						v-if="!key.revoked"
						icon="mdi:delete"
						color="error"
						variant="ghost"
						size="sm"
						:loading="revoking === key.id"
						@click="onRevoke(key)"
					>
						Revoke
					</UButton>
				</div>
			</div>

			<div class="flex flex-wrap gap-1">
				<UBadge
					v-for="scope in key.scopes"
					:key="scope"
					color="neutral"
					variant="soft"
					size="xs"
					class="font-mono"
				>
					{{ scope }}
				</UBadge>
			</div>

			<div class="text-xs opacity-70 flex flex-wrap gap-x-3 gap-y-0.5">
				<span>Created {{ relative(key.created_at) }}</span>
				<span v-if="key.last_used_at">Last used {{ relative(key.last_used_at) }}</span>
				<span
					v-else
					class="italic"
					>Never used</span
				>
				<span v-if="key.never_expires">Never expires</span>
				<span v-else-if="key.expires_at">
					{{ key.expired ? 'Expired' : 'Expires' }} {{ relative(key.expires_at) }}
				</span>
				<span v-if="key.revoked && key.revoked_at">Revoked {{ relative(key.revoked_at) }}</span>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { ApiKey } from 'types/apiKeys';

const props = defineProps<{ keys: ApiKey[] }>();
const emit = defineEmits<{
	(e: 'revoke', key: ApiKey): void;
	(e: 'edit', key: ApiKey): void;
}>();

const revoking = ref<string | null>(null);

async function onRevoke(key: ApiKey) {
	if (!confirm(`Revoke "${key.name}"? This cannot be undone.`)) return;
	revoking.value = key.id;
	try {
		emit('revoke', key);
	} finally {
		revoking.value = null;
	}
}

function relative(iso: string | null): string {
	if (!iso) return '-';
	const t = new Date(iso).getTime();
	if (Number.isNaN(t)) return iso;
	const diffMs = t - Date.now();
	const absSec = Math.abs(diffMs) / 1000;
	const past = diffMs < 0;

	const fmt = (n: number, unit: string) =>
		`${past ? '' : 'in '}${Math.round(n)} ${unit}${Math.round(n) === 1 ? '' : 's'}${past ? ' ago' : ''}`;

	if (absSec < 60) return past ? 'just now' : 'in <1 min';
	if (absSec < 3600) return fmt(absSec / 60, 'min');
	if (absSec < 86400) return fmt(absSec / 3600, 'hour');
	if (absSec < 86400 * 30) return fmt(absSec / 86400, 'day');
	if (absSec < 86400 * 365) return fmt(absSec / (86400 * 30), 'month');
	return fmt(absSec / (86400 * 365), 'year');
}
</script>
