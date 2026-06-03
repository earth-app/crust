<template>
	<div
		v-if="show"
		id="welcome-checklist"
		class="rounded-2xl border border-primary/40 bg-linear-to-br from-primary/10 via-secondary/5 to-transparent p-5 max-w-2xl mx-auto"
	>
		<div class="flex items-start justify-between gap-3 mb-3">
			<div class="flex flex-col">
				<div class="flex items-center gap-2">
					<UIcon
						name="mdi:rocket-launch-outline"
						class="size-5 text-primary"
					/>
					<h2 class="text-lg font-semibold">Welcome to The Earth App</h2>
				</div>
				<p class="text-sm text-muted mt-1">
					A short checklist to get to your first finished quest. Each step takes about a minute.
				</p>
			</div>

			<UDropdownMenu :items="menuItems">
				<UButton
					icon="mdi:dots-horizontal"
					variant="ghost"
					color="neutral"
					size="sm"
				/>
			</UDropdownMenu>
		</div>

		<div class="mb-3">
			<div class="flex items-center justify-between text-xs mb-1">
				<span class="text-muted">{{ progress.done }} of {{ progress.total }} done</span>
				<span class="font-medium">{{ percent }}%</span>
			</div>
			<div class="h-2 rounded-full bg-elevated overflow-hidden">
				<div
					class="h-full bg-linear-to-r from-primary to-secondary transition-all duration-500"
					:style="{ width: percent + '%' }"
				></div>
			</div>
		</div>

		<ul class="flex flex-col gap-1">
			<li
				v-for="step in steps"
				:key="step.id"
				class="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors"
				:class="isDone(step.id) ? 'opacity-60' : step.id === nextStep?.id ? 'bg-primary/5' : ''"
			>
				<UIcon
					:name="isDone(step.id) ? 'mdi:check-circle' : step.icon"
					class="size-5 mt-0.5 shrink-0"
					:class="isDone(step.id) ? 'text-success' : 'text-muted'"
				/>
				<div class="flex-1 min-w-0">
					<p
						class="text-sm font-medium"
						:class="isDone(step.id) ? 'line-through' : ''"
					>
						{{ step.title }}
					</p>
					<p
						v-if="!isDone(step.id)"
						class="text-xs text-muted"
					>
						{{ step.description }}
					</p>
				</div>
				<UButton
					v-if="!isDone(step.id) && step.id === nextStep?.id"
					size="xs"
					color="primary"
					variant="solid"
					@click="invoke(step)"
				>
					{{ step.cta }}
				</UButton>
				<UButton
					v-else-if="!isDone(step.id)"
					size="xs"
					color="neutral"
					variant="ghost"
					@click="invoke(step)"
				>
					{{ step.cta }}
				</UButton>
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
import { ONBOARDING_CHECKLIST } from '~/composables/useOnboarding';

const onboarding = useOnboarding();
const { user } = useAuth();
const router = useRouter();
const tours = useSiteTour();

onMounted(() => {
	if (user.value) onboarding.fetchState();
});

watch(user, (u) => {
	if (u) onboarding.fetchState();
});

// fold real-time email-verified state into the checklist so a user who verified
// in another tab sees the tick land here without needing a full refresh
watch(
	() => user.value?.account?.email_verified,
	(v) => {
		if (
			v &&
			onboarding.state.value &&
			!onboarding.state.value.completed_steps.includes('verify_email')
		) {
			onboarding.completeStep('verify_email');
		}
	},
	{ immediate: true }
);

// activities, mutual friends - detect first achievement at the auth-store boundary
watch(
	() => user.value?.activities?.length ?? 0,
	(n) => {
		if (
			n > 0 &&
			onboarding.state.value &&
			!onboarding.state.value.completed_steps.includes('first_activity')
		) {
			onboarding.completeStep('first_activity');
		}
	},
	{ immediate: true }
);
watch(
	() => user.value?.mutual_count ?? 0,
	(n) => {
		if (
			n > 0 &&
			onboarding.state.value &&
			!onboarding.state.value.completed_steps.includes('first_friend')
		) {
			onboarding.completeStep('first_friend');
		}
	},
	{ immediate: true }
);

// welcome step ticks only after the actual tour finishes, not on CTA click
watch(
	() => tours.hasCompleted('welcome'),
	(done) => {
		if (
			done &&
			onboarding.state.value &&
			!onboarding.state.value.completed_steps.includes('welcome')
		) {
			onboarding.completeStep('welcome');
		}
	},
	{ immediate: true }
);

const userStore = useUserStore();
watch(
	() => {
		const uid = user.value?.id;
		if (!uid) return false;
		return !!userStore.quest.get(uid);
	},
	(hasActive) => {
		if (
			hasActive &&
			onboarding.state.value &&
			!onboarding.state.value.completed_steps.includes('first_quest_started')
		) {
			onboarding.completeStep('first_quest_started');
		}
	},
	{ immediate: true }
);
watch(
	() => {
		const uid = user.value?.id;
		if (!uid) return 0;
		return userStore.questHistory.get(uid)?.size ?? 0;
	},
	(n) => {
		if (!onboarding.state.value) return;
		// any completed quest implies the started step too - backfill in case the
		// user finished a quest before the started watcher had a chance to fire
		if (n > 0) {
			if (!onboarding.state.value.completed_steps.includes('first_quest_started')) {
				onboarding.completeStep('first_quest_started');
			}
			if (!onboarding.state.value.completed_steps.includes('first_quest_completed')) {
				onboarding.completeStep('first_quest_completed');
			}
		}
	},
	{ immediate: true }
);

const steps = ONBOARDING_CHECKLIST;
const progress = computed(() => onboarding.progress.value);
const nextStep = computed(() => onboarding.nextStep.value || steps[0]);
const percent = computed(() =>
	progress.value.total === 0 ? 0 : Math.round((progress.value.done / progress.value.total) * 100)
);

const show = computed(() => {
	if (!user.value) return false;
	if (onboarding.isDismissed.value) return false;
	if (onboarding.isComplete.value) return false;
	return true;
});

function isDone(id: string) {
	return onboarding.state.value?.completed_steps.includes(id as any) ?? false;
}

function invoke(step: (typeof ONBOARDING_CHECKLIST)[number]) {
	if (step.id === 'welcome') {
		// don't mark complete here - the watcher catches genuine tour completion
		tours.startTour('welcome');
		return;
	}
	if (step.id === 'pick_interests') {
		emit('open-persona');
		return;
	}
	if (step.completeOnClick) {
		void onboarding.completeStep(step.id);
	}
	if (step.link) {
		router.push(step.link);
		return;
	}
}

const emit = defineEmits<{
	(event: 'open-persona'): void;
}>();

const menuItems = computed(() => [
	[
		{
			label: 'Hide Checklist',
			icon: 'mdi:eye-off-outline',
			onSelect: () => onboarding.dismiss()
		}
	]
]);
</script>
