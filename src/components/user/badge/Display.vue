<template>
	<div
		class="flex justify-center w-70 aspect-video gap-4 p-4 rounded-lg border-4 border-gray-700 bg-gray-600 light:bg-gray-200 hover:opacity-90 transition-opacity duration-300 cursor-pointer"
		:class="[
			isGranted ? 'border-yellow-500' : '',
			isMastered ? 'border-purple-400/70! bg-linear-to-tl via-purple-400/20 to-transparent' : ''
		]"
		@click="emit('clicked')"
	>
		<UIcon
			:name="badge.icon"
			class="self-center min-h-8 min-w-8 sm:size-10 md:size-12 lg:size-16"
			:class="[isGranted ? 'text-yellow-400' : '', isMastered ? 'text-purple-400!' : '']"
		/>

		<div class="flex flex-col items-center gap-2">
			<UBadge
				:color="rarityColor"
				:trailing-icon="isMastered ? 'mdi:star-circle' : isGranted ? 'mdi:check' : ''"
				>{{ capitalizeFully(badge.rarity) }}</UBadge
			>
			<h3 class="font-semibold text-md md:text-lg">{{ badge.name }}</h3>
			<span class="text-sm opacity-90 text-center">{{ badge.description }}</span>
		</div>
	</div>
</template>

<script setup lang="ts">
const props = defineProps<{
	badge: Badge | UserBadge;
	isGranted?: boolean;
	isMastered?: boolean;
}>();

const rarityColor = computed(() => {
	switch (props.badge.rarity) {
		case 'normal':
			return 'neutral';
		case 'rare':
			return 'info';
		case 'amazing':
			return 'warning';
		case 'green':
			return 'success';
	}
});

const emit = defineEmits<{
	(event: 'clicked'): void;
}>();
</script>
