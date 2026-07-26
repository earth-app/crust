<template>
	<UCard
		id="verified-publisher"
		class="w-full"
	>
		<template #header>
			<div class="flex items-center justify-between gap-3 flex-wrap">
				<div class="flex items-center gap-2">
					<UIcon
						name="mdi:shield-check"
						class="size-5 text-info"
					/>
					<h3 class="text-lg font-semibold">Verified Publisher</h3>
				</div>
				<UBadge
					v-if="badge"
					:color="badge.color"
					:icon="badge.icon"
					variant="subtle"
					>{{ badge.label }}</UBadge
				>
			</div>
		</template>

		<div
			v-if="loading"
			class="flex justify-center py-6"
		>
			<UIcon
				name="mdi:loading"
				class="size-6 animate-spin text-muted"
			/>
		</div>

		<!-- none: the pitch plus the application form -->
		<div
			v-else-if="state === 'none' || state === 'revoked'"
			class="flex flex-col gap-4"
		>
			<p class="text-sm text-muted">
				Verified publishers can submit activities to the public catalog. Submissions are reviewed by
				our team before they go live, and published activities carry your verified badge.
			</p>

			<UForm
				:state="form"
				:schema="verifiedPublisherApplicationSchema"
				class="flex flex-col gap-4"
				@submit="submit"
			>
				<UFormField
					label="Organization"
					name="organization"
					help="Optional. The group or business you publish on behalf of."
				>
					<UInput
						v-model="form.organization"
						placeholder="Bay Area Climbing Collective"
						class="w-full"
					/>
				</UFormField>

				<UFormField
					label="Website"
					name="website"
					help="Optional. A public page reviewers can check."
				>
					<UInput
						v-model="form.website"
						type="url"
						placeholder="https://example.org"
						class="w-full"
					/>
				</UFormField>

				<UFormField
					label="Why Should You Be Verified"
					name="reason"
					:required="true"
				>
					<UTextarea
						v-model="form.reason"
						:rows="4"
						:maxlength="1000"
						placeholder="Tell us about the community you organize for and the activities you want to publish."
						class="w-full"
					/>
				</UFormField>

				<UFormField
					label="Example Activities"
					name="activity_examples"
					:required="true"
				>
					<UInput
						v-model="form.activity_examples"
						placeholder="bouldering, via ferrata, trail running"
						class="w-full"
					/>
				</UFormField>

				<UFormField name="agrees_to_guidelines">
					<UCheckbox
						v-model="form.agrees_to_guidelines"
						label="I agree to the publishing guidelines and confirm these activities are real and appropriate."
					/>
				</UFormField>

				<UButton
					type="submit"
					color="primary"
					icon="mdi:shield-check"
					class="self-start"
					:loading="submitting"
					:disabled="submitting"
					>Apply for Verification</UButton
				>
			</UForm>
		</div>

		<!-- pending -->
		<div
			v-else-if="state === 'pending'"
			class="flex flex-col gap-3"
		>
			<p class="text-sm text-muted">
				Applied {{ relative(application?.applied_at) }}. Our team reviews applications in the order
				they arrive.
			</p>
			<div
				v-if="application?.reason"
				class="text-xs text-muted italic rounded border border-default border-dashed p-3"
			>
				&ldquo;{{ application.reason }}&rdquo;
			</div>
		</div>

		<!-- approved -->
		<div
			v-else-if="state === 'approved'"
			class="flex flex-col gap-4"
		>
			<p class="text-sm text-muted">
				Verified {{ relative(application?.reviewed_at) }}. You can submit activities for review.
			</p>

			<UButton
				color="primary"
				icon="mdi:plus"
				class="self-start"
				@click="submitModal = true"
				>Submit an Activity</UButton
			>

			<div
				v-if="submissions.length > 0"
				class="rounded-lg border border-default divide-y divide-default overflow-hidden"
			>
				<div
					v-for="staged in submissions"
					:key="staged.id"
					class="flex items-center justify-between gap-3 px-3 py-2"
				>
					<span class="text-sm font-medium">{{ staged.activity.name }}</span>
					<UBadge
						:color="staged.state === 'pending' ? 'warning' : 'neutral'"
						variant="subtle"
						size="sm"
						>{{ submissionLabel(staged) }}</UBadge
					>
				</div>
			</div>

			<AdminActivityEditorModal
				v-model:open="submitModal"
				mode="staged"
				title="Submit an Activity"
				description="Your submission is reviewed before it is published to the catalog."
				@approve:activity="submitActivity"
			/>
		</div>

		<!-- denied -->
		<div
			v-else
			class="flex flex-col gap-3"
		>
			<p
				v-if="application?.notes"
				class="text-sm"
			>
				{{ application.notes }}
			</p>
			<p class="text-sm text-muted">
				<span v-if="canReapply">You can apply again now.</span>
				<span v-else-if="application?.can_reapply_at"
					>You can re-apply after {{ formatDate(application.can_reapply_at) }}.</span
				>
			</p>
			<UButton
				color="primary"
				variant="outline"
				icon="mdi:refresh"
				class="self-start"
				:disabled="!canReapply"
				@click="state = 'none'"
				>Apply Again</UButton
			>
		</div>
	</UCard>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import { verifiedPublisherApplicationSchema } from 'schemas';
import type { Activity, StagedActivity } from 'types/activity';
import type { VerifiedPublisher, VerifiedPublisherState } from 'types/user';

const toast = useToast();
const { status, apply } = useVerifiedPublisher();
const { mine, submit: submitStaged } = useStagedActivities();

const loading = ref(true);
const submitting = ref(false);
const submitModal = ref(false);
const state = ref<VerifiedPublisherState>('none');
const application = ref<VerifiedPublisher | null>(null);
const submissions = ref<StagedActivity[]>([]);

const form = reactive({
	organization: '',
	website: '',
	reason: '',
	activity_examples: '',
	agrees_to_guidelines: false as boolean
});

const badge = computed(() => {
	switch (state.value) {
		case 'pending':
			return { label: 'Under Review', color: 'warning' as const, icon: 'mdi:clock-outline' };
		case 'approved':
			return { label: 'Verified Publisher', color: 'info' as const, icon: 'mdi:check-decagram' };
		case 'denied':
			return { label: 'Not Approved', color: 'error' as const, icon: 'mdi:close-circle-outline' };
		case 'revoked':
			return { label: 'Revoked', color: 'error' as const, icon: 'mdi:shield-off-outline' };
		default:
			return null;
	}
});

const canReapply = computed(() => {
	const at = application.value?.can_reapply_at;
	return !at || DateTime.fromISO(at) <= DateTime.now();
});

function relative(value?: string | null): string {
	return value ? (DateTime.fromISO(value).toRelative() ?? 'recently') : 'recently';
}

function formatDate(value: string): string {
	return DateTime.fromISO(value).toLocaleString(DateTime.DATE_MED);
}

function submissionLabel(staged: StagedActivity): string {
	if (staged.state !== 'pending') return staged.state.replace(/_/g, ' ');
	const relativeDeadline = DateTime.fromISO(staged.expires_at).toRelative() ?? 'soon';
	return `Auto-denies ${relativeDeadline}`;
}

async function load() {
	loading.value = true;
	try {
		const res = await status();
		if (res.success && res.data) {
			application.value = res.data;
			state.value = res.data.state;

			if (res.data.state === 'approved') {
				const own = await mine();
				if (own.success && own.data) submissions.value = own.data.items ?? [];
			}
		}
	} finally {
		loading.value = false;
	}
}

async function submit() {
	submitting.value = true;
	try {
		const links = form.website ? [form.website] : [];
		const res = await apply({
			reason: form.reason,
			organization: form.organization || undefined,
			links
		});

		if (res.success && res.data) {
			application.value = res.data;
			state.value = res.data.state;
			toast.add({
				title: 'Application Submitted',
				description: 'We will review it shortly.',
				icon: 'mdi:shield-check',
				color: 'success',
				duration: 5000
			});
		} else {
			toast.add({
				title: 'Application Failed',
				description: res.message,
				icon: 'mdi:alert-circle',
				color: 'error'
			});
		}
	} finally {
		submitting.value = false;
	}
}

async function submitActivity(activity: Partial<Activity> | null) {
	if (!activity) return;

	const res = await submitStaged(activity);
	if (res.success) {
		toast.add({
			title: 'Activity Submitted for Review',
			icon: 'mdi:check-circle',
			color: 'success',
			duration: 4000
		});
		const own = await mine();
		if (own.success && own.data) submissions.value = own.data.items ?? [];
	} else {
		toast.add({
			title: 'Submission Failed',
			description: res.message,
			icon: 'mdi:alert-circle',
			color: 'error'
		});
	}
}

onMounted(load);
</script>
