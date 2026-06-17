<template>
	<div class="min-h-screen bg-neutral-950 p-4 text-white">
		<div
			data-testid="harness-ready"
			class="text-xs text-neutral-500"
		>
			{{ which }}
		</div>

		<div
			data-testid="emitted-order"
			class="text-xs text-neutral-500"
		>
			{{ order.join(',') }}
		</div>

		<section
			v-if="which === 'orderer'"
			data-testid="orderer-untimed"
			class="mt-6 max-w-md"
		>
			<UserQuestStepOrderer
				:items="orderItems"
				untimed
				:submit="false"
				@update:order="(o: string[]) => (order = o)"
			/>
		</section>

		<section
			v-else-if="which === 'orderer-timed'"
			data-testid="orderer-timed"
			class="mt-6 max-w-md"
		>
			<UserQuestStepOrderer
				:step="orderStep"
				:submit="false"
				@update:order="(o: string[]) => (order = o)"
			/>
		</section>

		<section
			v-else-if="which === 'matcher'"
			data-testid="matcher"
			class="mt-6 max-w-md"
		>
			<UserQuestStepMatcher
				:step="matchStep"
				:submit="false"
			/>
		</section>
	</div>
</template>

<script setup lang="ts">
import type { QuestTimelineStep } from 'types/user';

definePageMeta({ layout: false });

const config = useRuntimeConfig();
if (!config.public.testBuild) {
	throw createError({ statusCode: 404, statusMessage: 'Not Found' });
}

const route = useRoute();
const which = computed(() => (route.query.c as string) || 'orderer');

// canonical order — Orderer shuffles this into the bank on init, so tests must read the
// actual tile text rather than assume positions
const orderItems = ['Mercury', 'Venus', 'Earth', 'Mars'];
const order = ref<string[]>([]);

const orderStep: QuestTimelineStep = {
	type: 'order_items',
	description: 'Put the planets in order from the sun',
	parameters: [orderItems],
	index: 0,
	icon: 'i-lucide-list-ordered',
	completed: false,
	isCurrentQuest: true
};

const matchStep: QuestTimelineStep = {
	type: 'match_terms',
	description: 'Match each body to its kind',
	parameters: [
		'Match each body to its kind',
		[
			['Sun', 'Star'],
			['Moon', 'Satellite']
		]
	],
	index: 0,
	icon: 'i-lucide-link',
	completed: false,
	isCurrentQuest: true
};
</script>
