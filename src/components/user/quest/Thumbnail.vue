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
						{{ completedCount }} / {{ quest.steps.length }} completed</span
					>
					<span
						v-else
						class="text-sm underline opacity-80"
						>{{ quest.steps.length }} steps</span
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
			v-model:open="open"
			:quest="quest"
			:progress="progress"
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
}>();

const open = ref(false);

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

	return completedCount.value >= props.quest.steps.length;
});

const i18n = useI18n();
const completedAtRelative = computed(() => {
	if (!props.completedAt) return null;
	return DateTime.fromMillis(props.completedAt).toRelative({ locale: i18n.locale.value });
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
