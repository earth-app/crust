<template>
	<div class="min-h-screen bg-neutral-950 p-4 text-white">
		<div
			data-testid="harness-ready"
			class="text-xs text-neutral-500"
		>
			{{ ready ? 'ready' : 'loading' }}
		</div>
		<div
			data-testid="active-quest-id"
			class="text-xs text-neutral-500"
		>
			{{ quest?.questId ?? '' }}
		</div>
		<div
			data-testid="completed-step-count"
			class="text-xs text-neutral-500"
		>
			{{ completedStepCount }}
		</div>

		<UButton
			data-testid="open-quest"
			class="mt-4"
			@click="open = true"
		>
			Open Quest
		</UButton>

		<UserQuestModal
			v-if="questDefinition"
			v-model:open="open"
			:quest="questDefinition"
			:progress="quest?.progress"
			:completed-at="completedAt"
		/>

		<!-- mirror the layout-level overlay so quest-completion is assertable on this layout-less page -->
		<UserQuestCompletionOverlay
			v-model:open="celebration.open.value"
			:quest-title="celebration.payload.value.questTitle"
			:points="celebration.payload.value.points"
		>
			<template #actions="{ close }">
				<UButton
					data-testid="celebration-close"
					color="primary"
					@click="close"
				>
					Continue
				</UButton>
			</template>
		</UserQuestCompletionOverlay>
	</div>
</template>

<script setup lang="ts">
import type { Quest } from 'types/user';

definePageMeta({ layout: false });

// gated behind the test build flag, same guard as drag-harness
const config = useRuntimeConfig();
if (!config.public.testBuild) {
	throw createError({ statusCode: 404, statusMessage: 'Not Found' });
}

const route = useRoute();
const { user } = useAuth();
const userId = computed(() => user.value?.id);
const { quest, fetchUserQuest, questHistory, fetchQuestHistory } = useUser(userId);
const celebration = useQuestCelebration();

const open = ref(route.query.open === '1');
const ready = ref(false);

// the modal needs the full Quest definition; the active-quest store entry carries it
const questDefinition = computed<Quest | null>(() => quest.value?.quest ?? null);

const completedStepCount = computed(() => {
	const progress = quest.value?.progress ?? [];
	return progress.reduce((count, slot) => {
		if (Array.isArray(slot)) return count + (slot.length > 0 ? 1 : 0);
		return count + (slot ? 1 : 0);
	}, 0);
});

const completedAt = computed(() => {
	const id = questDefinition.value?.id;
	if (!id) return undefined;
	return questHistory.value?.get(id)?.completedAt;
});

onMounted(async () => {
	// seed the active-quest store from the mock-overridden /v2/users/{id}/quest;
	// the modal/timeline read isCurrentQuest + unlock state from this
	await fetchUserQuest(true);
	// history drives the "completed" timeline state for replay specs
	await fetchQuestHistory({ force: true }).catch(() => {});
	ready.value = true;
});
</script>
