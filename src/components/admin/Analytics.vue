<template>
	<div class="flex flex-col gap-4">
		<div class="flex items-start justify-between gap-3 flex-wrap">
			<div>
				<h2 class="text-xl font-semibold">Traffic & Engagement</h2>
				<p class="text-sm text-muted mt-1">
					Cloudflare zone analytics joined with signup funnel + content metrics.
				</p>
			</div>
			<div class="flex items-center gap-2">
				<USelect
					v-model="rangeKey"
					:items="[
						{ label: 'Last 24h', value: '24h' },
						{ label: 'Last 7d', value: '7d' },
						{ label: 'Last 30d', value: '30d' }
					]"
				/>
				<UButton
					icon="mdi:refresh"
					variant="ghost"
					color="neutral"
					:loading="loading"
					@click="load"
				/>
			</div>
		</div>

		<UAlert
			v-if="snapshot && !snapshot.configured"
			color="warning"
			variant="subtle"
			icon="mdi:cloud-alert-outline"
			title="Cloudflare Analytics Not Configured"
			description="Set CF_ANALYTICS_TOKEN and CF_ZONE_TAG in the cloud worker to enable HTTP request analytics. The signup funnel below still works without it."
		/>

		<div class="rounded-lg border border-default p-4">
			<h3 class="font-semibold mb-3">Signup Funnel</h3>
			<div class="grid grid-cols-3 gap-3">
				<div class="rounded bg-elevated p-3">
					<p class="text-xs text-muted">Page views</p>
					<p class="text-2xl font-bold">{{ funnel.signup_views.toLocaleString() }}</p>
				</div>
				<div class="rounded bg-elevated p-3">
					<p class="text-xs text-muted">Signups</p>
					<p class="text-2xl font-bold">{{ funnel.signups_completed.toLocaleString() }}</p>
					<p class="text-xs text-success mt-1">{{ signupRate }}% conversion</p>
				</div>
				<div class="rounded bg-elevated p-3">
					<p class="text-xs text-muted">Email verified</p>
					<p class="text-2xl font-bold">{{ funnel.verifications_completed.toLocaleString() }}</p>
					<p class="text-xs text-success mt-1">{{ verifyRate }}% of signups</p>
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
			<!-- Top paths -->
			<div class="rounded-lg border border-default p-4">
				<h3 class="font-semibold mb-3">Top Paths</h3>
				<div
					v-if="topPaths.length === 0"
					class="text-sm text-muted py-6 text-center"
				>
					No data
				</div>
				<div
					v-else
					class="flex flex-col gap-1"
				>
					<div
						v-for="(p, i) in topPaths.slice(0, 10)"
						:key="`p-${i}`"
						class="flex items-center gap-2 text-sm"
					>
						<span class="font-mono text-xs text-muted w-6 text-right">{{ i + 1 }}</span>
						<span
							class="font-mono text-xs truncate flex-1"
							:title="p.dimensions.clientRequestPath"
						>
							{{ p.dimensions.clientRequestPath }}
						</span>
						<span class="text-xs font-medium tabular-nums">
							{{ formatRequests(p.sum.requests, p.avg?.sampleInterval) }}
						</span>
					</div>
				</div>
			</div>

			<!-- Status codes -->
			<div class="rounded-lg border border-default p-4">
				<h3 class="font-semibold mb-3">Response Status</h3>
				<div
					v-if="byStatus.length === 0"
					class="text-sm text-muted py-6 text-center"
				>
					No data
				</div>
				<div
					v-else
					class="flex flex-col gap-1"
				>
					<div
						v-for="s in byStatus.slice(0, 10)"
						:key="`s-${s.dimensions.edgeResponseStatus}`"
						class="flex items-center gap-2 text-sm"
					>
						<UBadge
							:color="statusColor(s.dimensions.edgeResponseStatus)"
							variant="subtle"
							size="sm"
							>{{ s.dimensions.edgeResponseStatus }}</UBadge
						>
						<div class="flex-1 h-1.5 bg-elevated rounded overflow-hidden">
							<div
								class="h-full bg-primary"
								:style="{ width: pctOfTotal(s.sum.requests, byStatus) + '%' }"
							></div>
						</div>
						<span class="text-xs font-medium tabular-nums w-16 text-right">
							{{ s.sum.requests.toLocaleString() }}
						</span>
					</div>
				</div>
			</div>

			<!-- Countries -->
			<div class="rounded-lg border border-default p-4 lg:col-span-2">
				<h3 class="font-semibold mb-3">Top Countries</h3>
				<div
					v-if="byCountry.length === 0"
					class="text-sm text-muted py-6 text-center"
				>
					No data
				</div>
				<div
					v-else
					class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2"
				>
					<div
						v-for="c in byCountry.slice(0, 15)"
						:key="c.dimensions.clientCountryName"
						class="rounded border border-default px-2 py-1.5"
					>
						<p
							class="text-xs font-medium truncate"
							:title="c.dimensions.clientCountryName"
						>
							{{ c.dimensions.clientCountryName || 'Unknown' }}
						</p>
						<p class="text-sm font-bold tabular-nums">
							{{ c.sum.requests.toLocaleString() }}
						</p>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
type AnalyticsSnapshot = {
	since: string;
	until: string;
	by_country: { dimensions: { clientCountryName: string }; sum: { requests: number } }[];
	by_status: { dimensions: { edgeResponseStatus: number }; sum: { requests: number } }[];
	top_paths: {
		dimensions: { clientRequestPath: string };
		sum: { requests: number; bytes: number };
		avg?: { sampleInterval: number };
	}[];
	signup_funnel: {
		signup_views: number;
		signups_completed: number;
		verifications_completed: number;
	};
	configured: boolean;
};

const authStore = useAuthStore();
const snapshot = ref<AnalyticsSnapshot | null>(null);
const loading = ref(false);
const rangeKey = ref<'24h' | '7d' | '30d'>('24h');

const byCountry = computed(() => snapshot.value?.by_country ?? []);
const byStatus = computed(() => snapshot.value?.by_status ?? []);
const topPaths = computed(() => snapshot.value?.top_paths ?? []);
const funnel = computed(
	() =>
		snapshot.value?.signup_funnel ?? {
			signup_views: 0,
			signups_completed: 0,
			verifications_completed: 0
		}
);

const signupRate = computed(() => {
	if (!funnel.value.signup_views) return '0.0';
	return ((funnel.value.signups_completed / funnel.value.signup_views) * 100).toFixed(1);
});
const verifyRate = computed(() => {
	if (!funnel.value.signups_completed) return '0.0';
	return ((funnel.value.verifications_completed / funnel.value.signups_completed) * 100).toFixed(1);
});

function rangeToQuery(): string {
	const now = new Date();
	let since: Date;
	if (rangeKey.value === '7d') since = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
	else if (rangeKey.value === '30d') since = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
	else since = new Date(now.getTime() - 24 * 3600 * 1000);
	return `?since=${encodeURIComponent(since.toISOString())}&until=${encodeURIComponent(now.toISOString())}`;
}

async function load() {
	loading.value = true;
	try {
		const res = await makeClientAPIRequest<AnalyticsSnapshot>(
			`/v2/admin/analytics${rangeToQuery()}`,
			authStore.sessionToken
		);
		if (valid(res)) snapshot.value = res.data;
	} finally {
		loading.value = false;
	}
}

function formatRequests(requests: number, sampleInterval?: number): string {
	const total = sampleInterval ? Math.round(requests * sampleInterval) : requests;
	return total.toLocaleString();
}

function pctOfTotal(value: number, all: AnalyticsSnapshot['by_status']): number {
	const total = all.reduce((acc, x) => acc + x.sum.requests, 0);
	if (!total) return 0;
	return Math.round((value / total) * 100);
}

function statusColor(status: number) {
	if (status >= 500) return 'error';
	if (status >= 400) return 'warning';
	if (status >= 300) return 'info';
	return 'success';
}

watch(rangeKey, () => void load());
onMounted(load);
</script>
