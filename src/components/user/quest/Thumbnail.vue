<template>
	<template v-if="quest">
		<UCard
			variant="subtle"
			:id="props.id"
			class="gap-4 p-4 hover:cursor-pointer hover:scale-105 transition-all duration-300"
			:class="current ? 'ring-4 ring-primary' : completed ? 'ring-2 ring-warning-300' : ''"
			@click="open = true"
		>
			<div class="flex flex-col items-center justify-center">
				<div class="flex justify-between w-full px-2">
					<span
						v-if="completedCount > 0"
						class="text-sm"
					>
						{{ completedCount }} / {{ quest.steps?.length ?? 0 }} completed</span
					>
					<span
						v-else
						class="text-sm underline opacity-80"
						>{{ quest.steps?.length ?? 0 }} steps</span
					>

					<span class="text-sm underline opacity-80">{{ comma(fullReward) }} points</span>

					<div class="flex gap-2">
						<UIcon
							v-if="quest.premium"
							name="mdi:diamond-stone"
							title="This quest requires Pro or higher to complete."
							class="size-5 text-secondary"
						/>

						<UIcon
							v-if="quest.mobile_only"
							name="mdi:cellphone-remove"
							title="This quest is only available on mobile."
							class="size-5 text-error"
						/>

						<UIcon
							v-if="quest.id.startsWith('badge_mastery_')"
							name="mdi:medal"
							title="This is a badge mastery quest."
							class="size-5 text-warning"
						/>

						<UIcon
							v-if="quest.id.startsWith('activity_quest_')"
							name="mdi:map-marker-path"
							title="This is an activity quest."
							class="size-5 text-primary"
						/>
					</div>
				</div>

				<UBadge
					:color="rarityColor"
					variant="subtle"
					size="md"
					class="my-2"
					>{{ capitalizeFully(quest.rarity || '') }}</UBadge
				>

				<UBadge
					:icon="quest.icon"
					:variant="completed ? 'solid' : completedCount > 0 ? 'subtle' : 'outline'"
					:color="completed ? 'primary' : 'neutral'"
					size="xl"
				/>
				<div class="flex flex-col gap-2">
					<h1 class="font-semibold text-lg">{{ quest.title }}</h1>
					<span class="font-medium opacity-90 text-base">{{ quest.description }}</span>
					<span
						v-if="completedAt"
						class="text-sm opacity-80"
						>Completed {{ completedAtRelative }}</span
					>

					<span
						v-if="expiresLabel"
						class="text-sm"
						:class="expiresInDays !== null && expiresInDays <= 3 ? 'text-error' : 'opacity-80'"
						>{{ expiresLabel }}</span
					>

					<UBadge
						v-if="current"
						icon="mdi:sword"
						color="success"
						class="self-start"
						>Current Quest</UBadge
					>
				</div>
			</div>
		</UCard>
		<LazyUserQuestModal
			v-if="modalEverOpened"
			v-model:open="open"
			:quest="quest"
			:progress="resolvedProgress"
			:completed-at="completedAt"
		/>
	</template>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';

const props = defineProps<{
	id?: string;
	quest: Quest;
	progress?: (QuestProgressEntry | QuestProgressEntry[])[];
	current?: boolean;
	completedAt?: number;
	expiresAt?: number;
}>();

const { user } = useAuth();
const userStore = useUserStore();

const open = ref(false);
// 20+ thumbnails on the quests page each used to mount a heavy modal eagerly. defer until
// the user actually opens this thumbnail's modal; once mounted, keep it mounted so close
// transitions and reopens don't pay the lazy-import cost again.
const modalEverOpened = ref(false);
watch(open, (isOpen) => {
	if (isOpen) modalEverOpened.value = true;
});

const lazyProgress = ref<(QuestProgressEntry | QuestProgressEntry[])[] | undefined>(undefined);
const resolvedProgress = computed(() => props.progress ?? lazyProgress.value);

watch(open, async (isOpen) => {
	if (!isOpen) return;
	if (props.progress || lazyProgress.value) return;
	if (!props.completedAt) return;
	const uid = user.value?.id;
	if (!uid) return;
	const entry = await userStore.fetchQuestHistoryEntry(uid, props.quest.id);
	if (entry?.progress) lazyProgress.value = entry.progress;
});

const fullReward = computed(() => {
	let base = props.quest.reward || 0;
	for (let step of props.quest.steps.flatMap((s) => (Array.isArray(s) ? s : [s]))) {
		if (step.reward) base += step.reward;
	}

	return base;
});

const completedCount = computed(() => props.progress?.length || 0);
const completed = computed(() => {
	if (!props.quest) return false;
	if (props.completedAt) return true;

	return completedCount.value >= (props.quest.steps?.length ?? 0);
});

const i18n = useI18n();
const completedAtRelative = computed(() => {
	if (!props.completedAt) return null;
	return DateTime.fromMillis(props.completedAt).toRelative({ locale: i18n.locale.value });
});

// days until expiry, mirroring sky's mastery list (Math.ceil, clamped at 0); null when the
// quest doesn't expire or is already completed.
const expiresInDays = computed(() => {
	if (props.expiresAt === undefined || completed.value) return null;
	const days = DateTime.fromMillis(props.expiresAt).diffNow('days').days;
	return days > 0 ? Math.ceil(days) : 0;
});
const expiresLabel = computed(() => {
	const days = expiresInDays.value;
	if (days === null) return null;
	if (days <= 0) return 'Expires soon';
	return `Expires in ${days} ${days === 1 ? 'day' : 'days'}`;
});

const rarityColor = computed(() => {
	if (!props.quest) return 'neutral';
	switch (props.quest.rarity) {
		case 'normal':
			return 'neutral';
		case 'rare':
			return 'info';
		case 'amazing':
			return 'warning';
		case 'green':
			return 'primary';
	}
});
</script>
