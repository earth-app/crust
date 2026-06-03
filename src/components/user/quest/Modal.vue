<template>
	<template v-if="quest">
		<UModal
			v-model:open="questOpen"
			class="min-w-full min-h-full"
			:dismissible="!stepOpen"
			:modal="true"
			fullscreen
		>
			<template #header>
				<div class="flex items-center w-full space-x-2">
					<UIcon
						:name="isMasteryQuest ? 'mdi:medal-outline' : quest.icon"
						class="size-12"
						:class="isMasteryQuest ? 'text-warning' : 'text-primary'"
					/>
					<div class="flex flex-col">
						<div class="flex items-center gap-2">
							<h1 class="font-semibold text-lg">{{ quest.title }}</h1>
							<UBadge
								v-if="isMasteryQuest"
								color="warning"
								variant="soft"
								icon="mdi:medal-outline"
								size="sm"
								>Badge Mastery</UBadge
							>
							<UPopover
								v-if="delayReductionLabel && hasDelayedStep"
								mode="hover"
							>
								<UBadge
									color="warning"
									variant="subtle"
									icon="mdi:lightning-bolt"
									size="sm"
									>{{ delayReductionLabel }}</UBadge
								>
								<template #content>
									<div class="flex flex-col p-4 max-w-72">
										<span class="text-sm">Your rank shortens the wait between quest steps.</span>
										<span class="text-xs opacity-80 mt-1"
											>This bonus is automatically applied based on your account rank.</span
										>
									</div>
								</template>
							</UPopover>
						</div>
						<span class="font-medium opacity-90 text-base">{{ quest.description }}</span>
						<span
							v-if="completedAtNormal"
							class="text-sm opacity-80"
							>Completed on {{ completedAtNormal }}</span
						>
					</div>

					<UButton
						variant="outline"
						class="ml-auto mr-4"
						color="error"
						icon="mdi:exit-to-app"
						@click="questOpen = false"
					/>
				</div>
			</template>
			<template #body>
				<div
					class="h-full w-full overscroll-contain"
					:class="stepOpen ? 'overflow-hidden' : 'overflow-y-auto'"
				>
					<UAlert
						v-if="isMasteryQuest && !completedAtNormal"
						id="mastery-warning"
						color="warning"
						variant="subtle"
						icon="mdi:alert-octagon-outline"
						title="One-Shot Mastery Quest"
						description="Resetting this quest or starting any other quest before you finish it will permanently lock this Badge Mastery. There is no second chance."
						class="my-3"
					/>
					<UAlert
						v-if="quest.mobile_only"
						id="mobile-only-warning"
						color="info"
						variant="subtle"
						icon="mdi:cellphone-lock"
						title="Mobile Only"
						description="This quest can only be started and continued from The Earth App mobile app. You can preview the steps here, but you'll need the mobile app to complete it."
						class="my-3"
						:actions="[
							{
								label: 'Open in The Earth App',
								icon: 'mdi:cellphone-arrow-down',
								color: 'info',
								variant: 'solid',
								to: appConfig.mobile.getTheAppUrl,
								target: '_blank',
								rel: 'noopener'
							}
						]"
					/>

					<div
						v-if="isMasteryQuest && masteryBadge"
						class="flex w-full justify-center"
					>
						<UserBadgeCard
							:badge="masteryBadge"
							no-modal
							class="mb-4"
						/>
					</div>

					<LazyUserQuestTimeline
						:quest="quest"
						:progress="progress"
						@select-step="
							openStep = $event;
							stepOpen = true;
						"
					/>
				</div>
			</template>
		</UModal>

		<UModal
			v-model:open="stepOpen"
			:modal="true"
			@close="openStep = null"
			scrollable
			class="md:min-w-160 lg:min-w-200"
		>
			<template #header="{ close }">
				<div class="flex items-center justify-between w-full px-1">
					<div class="flex items-center gap-2">
						<UIcon
							v-if="openStep?.icon"
							:name="openStep.icon"
							class="size-5 text-primary"
						/>
						<span class="text-sm ml-2 font-medium truncate max-w-160">{{
							openStep?.description ?? ''
						}}</span>
					</div>
					<button
						class="w-8 h-8 rounded-full border border-neutral-700 bg-neutral-900/60 flex items-center justify-center text-neutral-400 hover:text-white hover:border-neutral-500 transition-all active:scale-95 shrink-0"
						aria-label="Close"
						@click="close"
					>
						<UIcon
							name="i-lucide-x"
							class="size-4"
						/>
					</button>
				</div>
			</template>
			<template #body>
				<LazyUserQuestStepSubmission
					v-if="openStep"
					:quest="quest"
					:progress="progress"
					:step="openStep"
					@submitted="stepOpen = false"
				/>
				<Loading v-else-if="stepOpen" />
			</template>
		</UModal>

		<UModal
			v-if="quest.premium"
			v-model:open="premiumOpen"
			class="min-w-full min-h-full"
			:modal="true"
			fullscreen
			dismissible
		>
			<template #title>
				<div class="flex">
					<UIcon
						name="mdi:diamond-stone"
						class="size-6"
					/>
					<span class="ml-2">Upgrade to Access Premium Quests</span>
				</div>
			</template>
			<template #body>
				<div class="flex flex-col w-full items-center gap-4">
					<UserCard
						v-if="user"
						:user="user"
					/>
					<Ranks highlighted="PRO" />
				</div>
			</template>
		</UModal>
	</template>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';

const props = defineProps<{
	open: boolean;
	quest: Quest;
	progress?: (QuestProgressEntry | QuestProgressEntry[])[];
	completedAt?: number;
}>();

const emit = defineEmits<{
	'update:open': [value: boolean];
}>();

const { user } = useAuth();
const userId = computed(() => user.value?.id);
const { badges, fetchBadges } = useUser(userId);
const appConfig = useAppConfig();

const questOpen = computed({
	get: () => props.open,
	set: (value) => emit('update:open', value)
});

const completedAtNormal = computed(() => {
	if (!props.completedAt) return null;
	return DateTime.fromMillis(props.completedAt).toLocaleString(DateTime.DATETIME_FULL_WITH_SECONDS);
});

const isMasteryQuest = computed(() => props.quest?.id?.startsWith('badge_mastery_') ?? false);
const masteryBadge = computed(() => {
	if (!isMasteryQuest.value) return null;
	if (!props.quest?.id) return null;

	const badgeId = props.quest.id.substring(14, props.quest.id.length);
	return badges.value.find((badge) => badge.id === badgeId) ?? null;
});

const accountType = computed(() => user.value?.account.account_type);
const delayReduction = computed(() => getQuestDelayReduction(accountType.value));
const delayReductionLabel = computed(() => {
	const r = delayReduction.value;
	if (r <= 0) return null;
	if (r >= 1) return 'Bypass';
	return `${Math.round(r * 100)}% Faster`;
});
const hasDelayedStep = computed(() =>
	(props.quest?.steps ?? []).some((step) =>
		Array.isArray(step)
			? step.some((alt) => alt.delay && alt.delay > 0)
			: step.delay && step.delay > 0
	)
);

const stepOpen = ref(false);
const openStep = ref<
	| (QuestStep & {
			icon: string;
			completed: boolean;
			index: number;
			altIndex?: number;
			isCurrentQuest: boolean;
			isUnlocked: boolean;
			data?: string;
	  })
	| null
>(null);

const premiumOpen = ref(false);
const canOpenPremium = computed(() => {
	if (!props.quest.premium) return true;
	return user.value?.account.account_type !== 'FREE';
});

onMounted(() => {
	fetchBadges();
});

watch(
	() => props.open,
	(isOpen) => {
		if (!isOpen) {
			stepOpen.value = false;
			openStep.value = null;
			return;
		}

		if (props.quest.premium && !canOpenPremium.value) {
			premiumOpen.value = true;
			emit('update:open', false);
		}
	},
	{ immediate: true }
);

watch(stepOpen, (isOpen) => {
	if (!isOpen) openStep.value = null;
});

watch(premiumOpen, (isOpen) => {
	if (!isOpen && props.open && props.quest.premium && !canOpenPremium.value) {
		emit('update:open', false);
	}
});
</script>
