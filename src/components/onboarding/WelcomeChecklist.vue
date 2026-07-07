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

			<LazyUDropdownMenu
				:items="menuItems"
				hydrate-on-interaction="click"
			>
				<UButton
					icon="mdi:dots-horizontal"
					variant="ghost"
					color="neutral"
					size="sm"
				/>
			</LazyUDropdownMenu>
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
				<div
					v-if="showActions(step)"
					class="flex flex-col items-end gap-1 shrink-0"
				>
					<UButton
						size="xs"
						:color="step.id === nextStep?.id ? 'primary' : 'neutral'"
						:variant="step.id === nextStep?.id ? 'solid' : 'ghost'"
						:loading="isBusy(step)"
						:disabled="isBusy(step)"
						@click="invoke(step)"
					>
						{{ ctaLabel(step) }}
					</UButton>
					<UButton
						v-if="step.optional && !isDone(step.id) && !stepCompleted(step.id)"
						size="xs"
						color="neutral"
						variant="link"
						:disabled="isBusy(step)"
						@click="skipStep(step)"
					>
						Skip
					</UButton>
				</div>
			</li>
		</ul>
	</div>

	<div
		v-else-if="showError"
		id="welcome-checklist-error"
		class="rounded-2xl border border-primary/40 bg-elevated p-5 max-w-2xl mx-auto text-center"
	>
		<UIcon
			name="mdi:cloud-alert-outline"
			class="size-6 text-muted mx-auto mb-2"
		/>
		<p class="text-sm text-muted mb-3">We couldn't load your welcome checklist.</p>
		<UButton
			size="sm"
			:loading="onboarding.loading.value"
			@click="retry"
		>
			Retry
		</UButton>
	</div>
</template>

<script setup lang="ts">
import { ONBOARDING_CHECKLIST } from '~/composables/useOnboarding';

const onboarding = useOnboarding();
const { user, regenerateAvatar, fetchUser } = useAuth();
const router = useRouter();
const tours = useSiteTour();
const toast = useToast();
const avatarStore = useAvatarStore();

const generatingAvatar = ref(false);

// canonical "has a custom avatar" signal: mantle2 always emits the profile_photo
// endpoint url, so the truth is whether the avatar actually loaded bytes (a 404
// default placeholder lands in the store's failedUrls, never in the cache)
const avatarUrl = computed(() => user.value?.account?.avatar_url);
const hasCustomAvatar = computed(() => {
	const url = avatarUrl.value;
	if (!url || !(url.startsWith('http://') || url.startsWith('https://'))) return false;
	return avatarStore.has(url);
});

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
// persist generate_avatar server-side once the user actually has a custom avatar;
// the row's done-state is still derived from hasCustomAvatar so it re-opens if lost
watch(
	hasCustomAvatar,
	(has) => {
		if (
			has &&
			onboarding.state.value &&
			!onboarding.state.value.completed_steps.includes('generate_avatar')
		) {
			onboarding.completeStep('generate_avatar');
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
	if (!onboarding.fetched.value) return false;
	if (onboarding.isDismissed.value) return false;
	if (onboarding.isComplete.value) return false;
	return true;
});

// surface a retry instead of silently vanishing when the first fetch fails
const showError = computed(
	() =>
		Boolean(user.value) &&
		onboarding.error.value &&
		!onboarding.state.value &&
		!onboarding.isDismissed.value
);

function retry() {
	void onboarding.fetchState(true);
}

function stepCompleted(id: string) {
	return onboarding.state.value?.completed_steps.includes(id as any) ?? false;
}

function isDone(id: string) {
	// generate_avatar is done only while the user actually has a custom avatar, so it
	// stays an outstanding to-do (and re-opens if the avatar is ever lost); a skip
	// still records server-side for overall progress but does not mark the row done
	if (id === 'generate_avatar') return hasCustomAvatar.value;
	return stepCompleted(id);
}

function isBusy(step: (typeof ONBOARDING_CHECKLIST)[number]) {
	return step.id === 'generate_avatar' && generatingAvatar.value;
}

// generate_avatar keeps its CTA after completion so users can freely re-roll;
// every other step hides its action once done
function showActions(step: (typeof ONBOARDING_CHECKLIST)[number]) {
	return !isDone(step.id) || step.id === 'generate_avatar';
}

function ctaLabel(step: (typeof ONBOARDING_CHECKLIST)[number]) {
	if (step.id === 'generate_avatar' && isDone(step.id)) return 'Regenerate Avatar';
	return step.cta;
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
	if (step.id === 'generate_avatar') {
		void generateAvatar();
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

async function skipStep(step: (typeof ONBOARDING_CHECKLIST)[number]) {
	if (isBusy(step)) return;
	await onboarding.completeStep(step.id);
}

async function generateAvatar() {
	if (generatingAvatar.value) return;

	generatingAvatar.value = true;

	try {
		const res = await regenerateAvatar();
		if (valid(res) && res.data instanceof Blob) {
			const remoteUrl = user.value?.account?.avatar_url;
			if (remoteUrl && (remoteUrl.startsWith('http://') || remoteUrl.startsWith('https://'))) {
				avatarStore.clear(remoteUrl);
				// cache-bust for fresh bytes on profile surfaces, plus reprime the base
				// url so the has-avatar signal flips and the step auto-completes
				avatarStore.preloadAvatar(
					`${remoteUrl}${remoteUrl.includes('?') ? '&' : '?'}v=${Date.now()}`
				);
				avatarStore.preloadAvatar(remoteUrl);
			}
			// refresh the auth-store user so the new avatar propagates app-wide
			await fetchUser(true);
			toast.add({
				title: 'Avatar Generated',
				description: 'Your profile photo has been generated from your name and activities.',
				icon: 'mdi:image-refresh',
				color: 'success',
				duration: 5000
			});
			// completion is now derived: the hasCustomAvatar watcher persists the step
		} else {
			toast.add({
				title: 'Avatar Generation Failed',
				description: res.message || 'Avatar generation failed - please try again.',
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 7000
			});
		}
	} finally {
		// belt-and-suspenders: clear the spinner even if the user navigates away
		generatingAvatar.value = false;
	}
}

const emit = defineEmits<{
	(event: 'open-persona'): void;
}>();

async function dismiss() {
	const ok = await onboarding.dismiss();
	if (ok) {
		toast.add({
			title: 'Checklist Hidden',
			icon: 'mdi:eye-off-outline',
			color: 'success',
			duration: 4000
		});
	} else {
		toast.add({
			title: 'Could Not Hide Checklist',
			description: 'Please try again in a moment.',
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 6000
		});
	}
}

const menuItems = computed(() => [
	[
		{
			label: 'Hide Checklist',
			icon: 'mdi:eye-off-outline',
			onSelect: () => {
				void dismiss();
			}
		}
	]
]);
</script>
