<template>
	<div class="flex flex-col gap-4">
		<div class="flex items-start justify-between gap-3">
			<div>
				<h2 class="text-xl font-semibold">Marketing Studio</h2>
				<p class="mt-1 text-sm text-muted">
					Emulate content, modals, and interactions with mock data for demos and screen recordings.
					Preview only; nothing here is saved to the live app or shown to real users.
				</p>
			</div>
			<UBadge
				color="primary"
				variant="subtle"
				icon="mdi:movie-open-play"
				class="shrink-0"
				>Preview Only</UBadge
			>
		</div>

		<UTabs
			v-model="section"
			:items="sections"
			variant="pill"
			class="w-full"
		>
			<template #content="{ item }">
				<div class="mt-3">
					<AdminMarketingContentStudio v-if="item.value === 'content'" />
					<AdminMarketingPeopleStudio v-else-if="item.value === 'people'" />
					<AdminMarketingQuestStudio v-else-if="item.value === 'quests'" />
				</div>
			</template>
		</UTabs>
	</div>
</template>

<script setup lang="ts">
const section = ref('content');

const sections = [
	{ label: 'Content', icon: 'mdi:cards-variant', value: 'content' },
	{ label: 'People & Messages', icon: 'mdi:account-voice', value: 'people' },
	{ label: 'Quests', icon: 'mdi:flag-checkered', value: 'quests' }
];
</script>
