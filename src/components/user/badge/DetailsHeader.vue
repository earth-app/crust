<template>
	<UIcon
		:name="badge.icon"
		class="self-center min-h-12 min-w-12 sm:size-16 md:size-20 lg:size-24"
		:class="isMastered ? 'text-purple-400' : isGranted ? 'text-yellow-400' : ''"
	/>
	<div class="flex space-x-2 items-center">
		<h2 class="font-bold text-xl md:text-2xl">{{ badge.name }}</h2>
		<UBadge
			:color="rarityColor"
			:trailing-icon="isMastered ? 'mdi:star-circle' : isGranted ? 'mdi:check' : ''"
			class="text-base"
			>{{ capitalizeFully(badge.rarity) }}</UBadge
		>
		<slot name="actions" />
	</div>
	<p class="text-center text-md md:text-lg">{{ badge.description }}</p>
</template>

<script setup lang="ts">
import { capitalizeFully } from 'utils';

defineProps<BadgeHeaderProps>();
</script>
