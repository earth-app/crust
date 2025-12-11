<template>
	<ClientOnly>
		<div class="w-full flex items-center justify-center my-2 sm:my-4 md:my-6 lg:my-8">
			<InfoCard
				:title="activity.name"
				:badges="
					activity.types.map((type, i) => ({
						text: capitalizeFully(type.replace(/_/g, ' ')),
						color: colors[Math.min(colors.length - 1, i)] as any
					}))
				"
				:icon="activity.fields['icon'] || 'mdi:earth'"
				:content="trimString(activity.description, 220)"
				:link="noLink ? undefined : `/activities/${activity.id}`"
			/>
		</div>
	</ClientOnly>
</template>

<script setup lang="ts">
import type { Activity } from '../../shared/types/activity';
import { capitalizeFully, trimString } from '../../shared/util';

const colors = ['primary', 'warning', 'info'];

defineProps<{
	activity: Activity;
	noLink?: boolean;
}>();
</script>
