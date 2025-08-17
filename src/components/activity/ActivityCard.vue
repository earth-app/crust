<template>
	<ClientOnly>
		<div class="w-full flex items-center justify-center my-8">
			<InfoCard
				:title="activity.name"
				:icon="activity.fields['icon'] || 'mdi:earth'"
				:content="trimString(activity.description, 220)"
				:link="noLink ? undefined : `/activities/${activity.id}`"
			/>
		</div>
	</ClientOnly>
</template>

<script setup lang="ts">
import type { Activity } from '~/shared/types/activity';
import { trimString } from '~/shared/util';

defineProps<{
	activity: Activity;
	noLink?: boolean;
}>();
</script>
