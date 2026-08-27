<template>
	<div class="flex flex-col gap-3">
		<div class="flex items-start justify-between gap-3 flex-wrap">
			<div>
				<h3 class="text-lg font-semibold">Catalog Audit</h3>
				<p class="text-sm text-muted mt-1">
					Screens every live activity against its Wikipedia short description and reports the ones
					that name a thing, a place, or a person rather than something to do. Report only, nothing
					is changed.
				</p>
			</div>
			<UButton
				color="primary"
				icon="mdi:clipboard-search"
				:loading="loading"
				@click="run"
				>Run Audit</UButton
			>
		</div>

		<UAlert
			v-if="error"
			color="error"
			variant="soft"
			icon="mdi:alert"
			:description="error"
		/>

		<div
			v-if="audit"
			class="flex flex-wrap items-center gap-2"
		>
			<UBadge
				color="neutral"
				variant="subtle"
				>{{ audit.checked }} Checked</UBadge
			>
			<UBadge
				v-for="entry in summary"
				:key="entry.nature"
				:color="entry.meta.color"
				:variant="entry.meta.variant"
				:icon="entry.meta.icon"
				>{{ entry.count }} {{ entry.meta.label }}</UBadge
			>
		</div>

		<div
			v-if="audit && audit.findings.length === 0"
			class="rounded-lg border border-default p-4 text-center text-sm text-muted"
		>
			Nothing flagged. Every screened activity reads as something a person can do.
		</div>

		<template v-if="audit && audit.findings.length > 0">
			<div class="flex gap-2 flex-wrap">
				<UInput
					v-model="filter"
					placeholder="Filter findings..."
					icon="mdi:magnify"
					class="flex-1 min-w-48"
				/>
				<USelect
					v-model="recommendationFilter"
					:items="recommendationOptions"
					class="w-48"
				/>
			</div>

			<div
				class="rounded-lg border border-default divide-y divide-default max-h-96 overflow-y-auto"
			>
				<div
					v-for="finding in visibleFindings"
					:key="finding.id"
					class="flex items-start justify-between gap-3 px-3 py-2"
				>
					<div class="min-w-0 flex flex-col gap-1">
						<div class="flex items-center gap-2 flex-wrap">
							<p class="font-semibold truncate">{{ finding.id.replace(/_/g, ' ') }}</p>
							<UBadge
								:color="natureMeta(finding.nature).color"
								:variant="natureMeta(finding.nature).variant"
								:icon="natureMeta(finding.nature).icon"
								size="sm"
								>{{ natureMeta(finding.nature).label }}</UBadge
							>
							<UBadge
								:color="recommendationMeta(finding.recommendation).color"
								:variant="recommendationMeta(finding.recommendation).variant"
								:icon="recommendationMeta(finding.recommendation).icon"
								size="sm"
								>{{ recommendationMeta(finding.recommendation).label }}</UBadge
							>
						</div>
						<p class="text-xs text-muted">{{ finding.reason }}</p>
						<p
							v-if="finding.short_description"
							class="text-xs text-toned italic truncate"
						>
							{{ finding.title }} &mdash; {{ finding.short_description }}
						</p>
					</div>
					<UButton
						color="neutral"
						variant="ghost"
						size="sm"
						icon="mdi:pencil"
						:aria-label="`Edit ${finding.id}`"
						@click="emit('edit', finding.id)"
					/>
				</div>

				<div
					v-if="visibleFindings.length === 0"
					class="p-4 text-center text-sm text-muted"
				>
					No findings match that filter.
				</div>
			</div>

			<p class="text-xs text-muted">
				Generated {{ new Date(audit.generated_at).toLocaleString() }}. Deleting an activity affects
				every user who has it on their profile, so each row is a recommendation rather than an
				action.
			</p>
		</template>
	</div>
</template>

<script setup lang="ts">
import {
	natureMeta,
	partitionFindings,
	recommendationMeta,
	summarizeCounts,
	type ActivityAudit
} from '~/shared/utils/activityAudit';

const emit = defineEmits<{ edit: [id: string] }>();

const authStore = useAuthStore();

const audit = ref<ActivityAudit | null>(null);
const loading = ref(false);
const error = ref('');
const filter = ref('');
const recommendationFilter = ref<'all' | 'delete' | 'review'>('all');

const recommendationOptions = [
	{ label: 'All Findings', value: 'all' },
	{ label: 'Recommended Deletions', value: 'delete' },
	{ label: 'Needs Review', value: 'review' }
];

const summary = computed(() => (audit.value ? summarizeCounts(audit.value.counts) : []));

const visibleFindings = computed(() => {
	if (!audit.value) return [];

	const { deletions, reviews } = partitionFindings(audit.value.findings);
	const scoped =
		recommendationFilter.value === 'delete'
			? deletions
			: recommendationFilter.value === 'review'
				? reviews
				: audit.value.findings;

	const needle = filter.value.trim().toLowerCase();
	if (!needle) return scoped;

	return scoped.filter((finding) =>
		[finding.id, finding.title, finding.short_description ?? '', finding.reason]
			.join(' ')
			.toLowerCase()
			.includes(needle)
	);
});

async function run() {
	loading.value = true;
	error.value = '';

	try {
		// the server route re-checks admin against mantle2, so the session token has to ride along
		const res = await makeServerRequest<ActivityAudit>(
			null,
			'/api/admin/activity/audit',
			authStore.sessionToken,
			{ method: 'POST', body: {} }
		);

		if (valid(res)) audit.value = res.data;
		else error.value = res.message ?? 'Failed to run the catalog audit';
	} finally {
		loading.value = false;
	}
}
</script>
