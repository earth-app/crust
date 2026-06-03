import { computed, ref } from 'vue';

export type OnboardingStepId =
	| 'welcome'
	| 'pick_interests'
	| 'first_activity'
	| 'first_prompt_response'
	| 'first_article_read'
	| 'first_quest_started'
	| 'first_quest_completed'
	| 'first_friend'
	| 'verify_email'
	| 'complete';

export type OnboardingState = {
	user_id: string;
	completed_steps: OnboardingStepId[];
	persona?: string;
	interests: string[];
	started_at: number;
	finished_at: number | null;
	dismissed_at: number | null;
	updated_at: number;
};

export const ONBOARDING_CHECKLIST: ReadonlyArray<{
	id: OnboardingStepId;
	title: string;
	description: string;
	icon: string;
	link?: string;
	mLink?: string;
	cta: string;
	// when true, clicking the CTA marks the step done immediately
	completeOnClick?: boolean;
}> = [
	{
		id: 'welcome',
		title: 'Take the Welcome Tour',
		description: 'A 60-second walkthrough of the app.',
		icon: 'mdi:earth',
		cta: 'Start Tour'
	},
	{
		id: 'pick_interests',
		title: 'Tell Us What You Like',
		description: 'Three quick taps so we can tailor what you see.',
		icon: 'mdi:sparkles',
		cta: 'Pick Interests'
	},
	{
		id: 'first_activity',
		title: 'Save Your First Activity',
		description: 'Discover a hobby — hiking, baking, whatever — and add it to your shelf.',
		icon: 'mdi:notebook-multiple',
		link: '/activities',
		mLink: '/tabs/discover?tab=activity',
		cta: 'Browse Activities'
	},
	{
		id: 'first_quest_started',
		title: 'Start Your First Quest',
		description: 'Quests unify everything: short missions that earn points and badges.',
		icon: 'mdi:flag-outline',
		link: '/profile/quests',
		mLink: '/tabs/quests',
		cta: 'Open Quests'
	},
	{
		id: 'first_prompt_response',
		title: 'Respond to a Prompt',
		description:
			'Share a thought on something you actually have an opinion about. Prompts vanish after 2 days — jump on a fresh one while the conversation is live.',
		icon: 'mdi:comment-question-outline',
		link: '/prompts',
		mLink: '/tabs/discover?tab=prompt',
		cta: 'Browse Prompts',
		completeOnClick: true
	},
	{
		id: 'first_article_read',
		title: 'Read an Article',
		description:
			'A short read curated to your interests. Articles only stay live for 2 weeks — the catalog refreshes constantly, so check back often.',
		icon: 'mdi:newspaper-variant-outline',
		link: '/articles',
		mLink: '/tabs/discover?tab=article',
		cta: 'Browse Articles',
		completeOnClick: true
	},
	{
		id: 'first_quest_completed',
		title: 'Finish a Quest',
		description: "The 'aha' moment - your rewards are one quest away.",
		icon: 'mdi:trophy-outline',
		link: '/profile/quests',
		mLink: '/tabs/quests',
		cta: 'Resume Quest'
	},
	{
		id: 'first_friend',
		title: 'Find a Friend',
		description: 'Other people are doing the same quests. Invite or follow.',
		icon: 'mdi:account-multiple-plus-outline',
		cta: 'Find Friends'
	},
	{
		id: 'verify_email',
		title: 'Verify Your Email',
		description: 'Unlocks posting prompts, articles, and events.',
		icon: 'mdi:email-check-outline',
		link: '/verify-email',
		mLink: '/verify-email',
		cta: 'Verify Now'
	}
];

const state = ref<OnboardingState | null>(null);
const loading = ref(false);
const fetched = ref(false);

export function useOnboarding() {
	const authStore = useAuthStore();
	const { user } = useAuth();

	const isComplete = computed(() => {
		if (!state.value) return false;
		if (state.value.finished_at) return true;
		return ONBOARDING_CHECKLIST.every((s) => state.value!.completed_steps.includes(s.id));
	});

	const isDismissed = computed(() => Boolean(state.value?.dismissed_at));

	const progress = computed(() => {
		if (!state.value) return { done: 0, total: ONBOARDING_CHECKLIST.length };
		const done = ONBOARDING_CHECKLIST.filter((s) =>
			state.value!.completed_steps.includes(s.id)
		).length;
		return { done, total: ONBOARDING_CHECKLIST.length };
	});

	const nextStep = computed(() => {
		if (!state.value) return ONBOARDING_CHECKLIST[0];
		return (
			ONBOARDING_CHECKLIST.find((s) => !state.value!.completed_steps.includes(s.id)) ||
			ONBOARDING_CHECKLIST[ONBOARDING_CHECKLIST.length - 1]
		);
	});

	const fetchState = async (force = false) => {
		if (!user.value) return;
		if (fetched.value && !force) return;
		loading.value = true;
		try {
			const res = await makeClientAPIRequest<{ state: OnboardingState }>(
				`/v2/users/current/onboarding`,
				authStore.sessionToken
			);
			if (valid(res)) {
				state.value = res.data.state;
				fetched.value = true;
			}
		} finally {
			loading.value = false;
		}
	};

	// in-flight set guards against duplicate POSTs when watchers and a rapid click race
	const inFlight = new Set<OnboardingStepId>();

	const completeStep = async (step: OnboardingStepId): Promise<boolean> => {
		if (!user.value) return false;
		// fold a successful verify_email into the checklist as soon as the auth store sees it
		if (state.value?.completed_steps.includes(step)) return true;
		if (inFlight.has(step)) return false;
		inFlight.add(step);
		try {
			const res = await makeClientAPIRequest<{ state: OnboardingState }>(
				`/v2/users/current/onboarding/step`,
				authStore.sessionToken,
				{
					method: 'POST',
					body: { step }
				}
			);
			if (valid(res)) {
				state.value = res.data.state;
				return true;
			}
			return false;
		} catch (e) {
			console.warn(`Failed to record onboarding step ${step}:`, e);
			return false;
		} finally {
			inFlight.delete(step);
		}
	};

	const setPersona = async (persona: string, interests: string[]): Promise<boolean> => {
		if (!user.value) return false;
		try {
			const res = await makeClientAPIRequest<{ state: OnboardingState }>(
				`/v2/users/current/onboarding/persona`,
				authStore.sessionToken,
				{
					method: 'POST',
					body: { persona, interests }
				}
			);
			if (valid(res)) {
				state.value = res.data.state;
				return true;
			}
			return false;
		} catch (e) {
			console.warn('Failed to set onboarding persona:', e);
			return false;
		}
	};

	const dismiss = async () => {
		if (!user.value) return;
		try {
			const res = await makeClientAPIRequest<{ state: OnboardingState }>(
				`/v2/users/current/onboarding/dismiss`,
				authStore.sessionToken,
				{ method: 'POST' }
			);
			if (valid(res)) state.value = res.data.state;
		} catch (e) {
			console.warn('Failed to dismiss onboarding:', e);
		}
	};

	return {
		state,
		loading,
		fetchState,
		completeStep,
		setPersona,
		dismiss,
		isComplete,
		isDismissed,
		progress,
		nextStep
	};
}
