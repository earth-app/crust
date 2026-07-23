<template>
	<div class="flex flex-col gap-5 rounded-2xl border border-default bg-elevated/30 p-5">
		<div
			v-if="expedition"
			class="flex flex-col gap-5"
		>
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div class="flex flex-col gap-1">
					<h2 class="text-xl font-semibold">{{ expedition.title }}</h2>
					<div class="flex flex-wrap items-center gap-2">
						<UBadge
							:icon="goalMeta.icon"
							color="primary"
							variant="subtle"
							>{{ goalMeta.label }}</UBadge
						>
						<UBadge
							:icon="timeLeft.expired ? 'mdi:flag-checkered' : 'mdi:timer-outline'"
							:color="timeLeft.expired ? 'neutral' : 'success'"
							variant="soft"
							>{{ timeLabel }}</UBadge
						>
					</div>
				</div>
			</div>

			<div class="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
				<div id="expedition-ring">
					<CircleRing :expedition="expedition" />
				</div>

				<div
					id="circle-kudos"
					class="flex flex-col gap-3"
				>
					<span class="text-xs font-semibold tracking-wide text-muted uppercase"
						>The Circle's Contribution</span
					>
					<ul class="flex flex-col gap-3">
						<li
							v-for="c in contributors"
							:key="c.uid"
							class="flex items-center gap-3"
						>
							<span
								class="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
								:style="{ backgroundColor: color(c.uid) }"
								>{{ initial(c.username) }}</span
							>
							<div class="min-w-0 flex-1">
								<div class="flex items-center justify-between gap-2">
									<span class="truncate text-sm font-medium">
										{{ c.username }}
										<span
											v-if="c.uid === currentUid"
											class="text-muted"
											>(You)</span
										>
									</span>
									<span class="shrink-0 text-xs text-muted tabular-nums"
										>{{ c.contribution.toLocaleString() }} {{ goalMeta.unit }}</span
									>
								</div>
								<div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-default/60">
									<div
										class="h-full rounded-full transition-[width] duration-700 ease-out"
										:style="{
											width: `${barWidth(c.contribution)}%`,
											backgroundColor: color(c.uid)
										}"
									/>
								</div>
							</div>
							<CircleKudos
								v-if="c.uid !== currentUid && currentUid"
								:to-uid="c.uid"
								context-type="expedition"
								:context-ref="expedition.id"
								:username="c.username"
								heading="Cheer On"
								class="shrink-0"
							/>
						</li>
					</ul>
				</div>
			</div>

			<p class="text-xs text-muted">
				Everyone's outdoor time grows the same goal. This is your circle versus the challenge, never
				each other.
			</p>
		</div>

		<div
			v-else-if="loading"
			class="flex flex-col gap-4"
			data-testid="expedition-loading"
		>
			<USkeleton class="h-6 w-48 rounded" />
			<USkeleton class="h-24 w-full rounded-xl" />
		</div>

		<div
			v-else-if="canStart"
			class="flex flex-col gap-4"
		>
			<div class="flex flex-col gap-1">
				<h2 class="text-lg font-semibold">Start an Expedition</h2>
				<p class="text-sm text-muted">
					Set a shared outdoor goal for your circle. You grow it together; there is no scoreboard.
				</p>
			</div>
			<div class="grid gap-3 sm:grid-cols-2">
				<UFormField
					label="Title"
					class="sm:col-span-2"
				>
					<UInput
						v-model="form.title"
						placeholder="Weekend Woods Challenge"
						class="w-full"
					/>
				</UFormField>
				<UFormField label="Goal">
					<USelect
						v-model="form.goal"
						:items="goalOptions"
						class="w-full"
					/>
				</UFormField>
				<UFormField :label="`Target (${goalOptionMeta.unit})`">
					<UInputNumber
						v-model="form.target"
						:min="1"
						class="w-full"
					/>
				</UFormField>
				<UFormField
					label="Days"
					class="sm:col-span-2"
				>
					<UInputNumber
						v-model="form.days"
						:min="1"
						:max="90"
						class="w-full"
					/>
				</UFormField>

				<div
					v-if="guidance.level !== 'ok'"
					class="flex items-start gap-2 text-xs sm:col-span-2"
					:class="guidance.color === 'warning' ? 'text-warning' : 'text-info'"
				>
					<UIcon
						:name="guidance.icon"
						class="size-4 mt-0.5 shrink-0"
					/>
					<span class="text-wrap min-w-0">
						<span class="font-semibold">{{ guidance.title }}</span>
						<span class="opacity-80 ml-2"> {{ guidance.message }}</span>
					</span>
				</div>
			</div>
			<div>
				<UButton
					:icon="hasCircleMembers ? 'mdi:rocket-launch-outline' : 'mdi:account-plus-outline'"
					color="primary"
					:loading="starting"
					:disabled="starting || (hasCircleMembers && !form.title.trim())"
					@click="onStart"
					>{{ hasCircleMembers ? 'Start Expedition' : 'Invite Friends to Start' }}</UButton
				>
			</div>
		</div>

		<div
			v-else
			class="flex flex-col items-center gap-2 py-6 text-center"
		>
			<UIcon
				name="mdi:tent"
				class="text-3xl text-muted"
			/>
			<p class="text-sm text-muted">No active expedition yet.</p>
		</div>

		<UModal
			v-model:open="showInviteModal"
			title="Invite Your Circle First"
		>
			<template #body>
				<div class="flex flex-col gap-4">
					<p class="text-sm text-muted">
						An expedition is a shared goal. Add a friend or two to your circle, then grow a garden
						together.
					</p>
					<UserInviteFriend />
					<UButton
						variant="soft"
						color="neutral"
						icon="mdi:compass-outline"
						block
						@click="openDiscover"
						>Find People to Follow</UButton
					>
				</div>
			</template>
		</UModal>
	</div>
</template>

<script setup lang="ts">
// the expedition surface: shared-goal ring, per-member contribution (never a rank),
// per-member kudos, and the start form when the circle has no active expedition
const props = withDefaults(
	defineProps<{
		expedition?: Expedition | null;
		currentUid?: string;
		canStart?: boolean;
		// circle member count (you + others); when omitted we derive it from the
		// current user's circle so the goal guidance scales to the group
		circleSize?: number;
		// true until the expedition fetch settles; shows a skeleton instead of flashing
		// the start form before we know whether an active expedition exists
		loading?: boolean;
	}>(),
	{ expedition: null, currentUid: '', canStart: true, circleSize: 0, loading: false }
);

const emit = defineEmits<{ (e: 'started', value: Expedition): void }>();

const { start } = useExpedition();
const { circle, fetchCircle } = useFriends();
const toast = useToast();

// a shared garden needs at least one other person; gate the start behind an invite prompt.
// honor the circleSize prop (you + others) as a hint before the circle fetch resolves
const showInviteModal = ref(false);
const hasCircleMembers = computed(() => circle.value.length > 0 || (props.circleSize ?? 0) > 1);

function openDiscover() {
	showInviteModal.value = false;
	if (import.meta.client) window.dispatchEvent(new Event('earth-app:open-discover'));
}

// prefer an explicit prop; otherwise size from the fetched circle (self + members)
const effectiveCircleSize = computed(() =>
	props.circleSize && props.circleSize > 0 ? props.circleSize : Math.max(1, circle.value.length + 1)
);

const goalMeta = computed(() =>
	props.expedition
		? EXPEDITION_GOAL_META[props.expedition.goal]
		: EXPEDITION_GOAL_META.nature_minutes
);

const contributors = computed(() =>
	props.expedition ? orderedContributors(props.expedition) : []
);
const timeLeft = computed(() =>
	props.expedition ? expeditionTimeLeft(props.expedition) : { expired: false, days: 0, hours: 0 }
);
const timeLabel = computed(() => {
	if (!props.expedition) return '';
	if (timeLeft.value.expired) return 'Complete';
	const { days, hours } = timeLeft.value;
	if (days > 0) return `${days}d ${hours}h Left`;
	return `${hours}h Left`;
});

const topContribution = computed(() =>
	contributors.value.reduce((m, c) => Math.max(m, c.contribution), 0)
);
function barWidth(contribution: number): number {
	const top = topContribution.value;
	if (top <= 0) return 0;
	return Math.round(clamp01(contribution / top) * 100);
}

const color = (uid: string) => contributorColor(uid);
const initial = (name: string) => (name?.trim()?.[0] ?? '?').toUpperCase();

const goalOptions = (['nature_minutes', 'trails', 'quests'] as ExpeditionGoal[]).map((g) => ({
	label: EXPEDITION_GOAL_META[g].label,
	value: g
}));
const form = reactive({
	title: '',
	goal: 'nature_minutes' as ExpeditionGoal,
	target: 600,
	days: 7
});
const goalOptionMeta = computed(() => EXPEDITION_GOAL_META[form.goal]);
const starting = ref(false);

// fun, non-blocking nudge when the target is very high or very low for the circle
const guidance = computed(() =>
	expeditionGoalGuidance({
		goal: form.goal,
		target: form.target,
		circleSize: effectiveCircleSize.value,
		days: form.days
	})
);

// client-only; sizes the guidance to the real circle without blocking ssr
onMounted(() => {
	if (props.currentUid) void fetchCircle();
});

async function onStart() {
	if (starting.value) return;
	// an expedition is a shared goal - block it when the circle is empty and offer to invite
	if (!hasCircleMembers.value) {
		showInviteModal.value = true;
		return;
	}
	if (!form.title.trim()) return;
	starting.value = true;
	const res = await start({
		title: form.title.trim(),
		goal: form.goal,
		target: form.target,
		days: form.days
	});
	starting.value = false;

	if (res.success && res.data) {
		toast.add({
			title: 'Expedition Started',
			description: 'Your circle is on the trail. Every minute outside grows the goal.',
			icon: 'mdi:rocket-launch',
			color: 'success',
			duration: 5000
		});
		emit('started', res.data);
		return;
	}

	toast.add({
		title: 'Could Not Start Expedition',
		description: res.error || 'Please try again.',
		icon: 'mdi:cloud-alert-outline',
		color: 'error',
		duration: 5000
	});
}
</script>
