<template>
	<div v-if="displayOnly && scene">
		<AdminMarketingContentActivity
			v-if="scene.kind === 'activity'"
			:scene="scene"
			:display-only="true"
		/>
		<AdminMarketingContentEvent
			v-else-if="scene.kind === 'event'"
			:scene="scene"
			:display-only="true"
		/>
		<AdminMarketingContentPrompt
			v-else-if="scene.kind === 'prompt'"
			:scene="scene"
			:display-only="true"
		/>
		<AdminMarketingContentArticle
			v-else-if="scene.kind === 'article'"
			:scene="scene"
			:display-only="true"
		/>
	</div>
	<div
		v-else
		class="flex flex-col gap-3"
	>
		<p class="text-sm text-muted">
			Author a mock object three ways — hand-write it, pull a real sample to tweak, or generate one
			with AI — then preview the real card and record it fullscreen.
		</p>
		<UTabs
			v-model="kind"
			:items="kinds"
			variant="link"
			class="w-full"
		>
			<template #content="{ item }">
				<div class="mt-2">
					<AdminMarketingContentActivity v-if="item.value === 'activity'" />
					<AdminMarketingContentEvent v-else-if="item.value === 'event'" />
					<AdminMarketingContentPrompt v-else-if="item.value === 'prompt'" />
					<AdminMarketingContentArticle v-else-if="item.value === 'article'" />
					<AdminMarketingContentInfoCardPlayground v-else-if="item.value === 'infocard'" />
				</div>
			</template>
		</UTabs>
	</div>
</template>

<script setup lang="ts">
// MarketingStudioProps is auto-imported; importing it via ~/shared in a macro breaks the SFC build
defineProps<MarketingStudioProps>();

const kind = ref('activity');

const kinds = [
	{ label: 'Activity', icon: 'mdi:run', value: 'activity' },
	{ label: 'Event', icon: 'mdi:calendar-star', value: 'event' },
	{ label: 'Prompt', icon: 'mdi:comment-question-outline', value: 'prompt' },
	{ label: 'Article', icon: 'mdi:newspaper-variant-outline', value: 'article' },
	{ label: 'InfoCard', icon: 'mdi:card-text-outline', value: 'infocard' }
];
</script>
