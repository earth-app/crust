<template>
	<div
		class="flex justify-center w-75 aspect-video gap-4 p-4 rounded-lg border-4 border-gray-700 bg-gray-600 light:bg-gray-300 hover:opacity-90 transition-opacity duration-300 cursor-pointer"
		:class="[
			isGranted
				? 'shadow-md shadow-white/40 light:shadow-gray-900 border-yellow-500 light:border-yellow-300 bg-linear-to-tl from-yellow-500/70 via-yellow-600/40 to-yellow-500/70 light:from-yellow-600/70 light:via-yellow-300/50 light:to-yellow-600/70'
				: '',
			isMastered
				? 'border-purple-400/70! from-purple-900! via-purple-400/60! to-purple-900! light:via-purple-500/90!'
				: ''
		]"
		@click="emit('clicked')"
	>
		<UIcon
			:name="badge.icon"
			class="self-center min-h-8 min-w-8 sm:size-10 md:size-12 lg:size-16"
			:class="[isGranted ? 'text-white' : '', isMastered ? 'text-purple-300!' : '']"
		/>

		<div class="flex flex-col items-center gap-2 px-1">
			<UBadge
				:color="rarityColor"
				:trailing-icon="isMastered ? 'mdi:star-circle' : isGranted ? 'mdi:check' : ''"
				>{{ capitalizeFully(badge.rarity) }}</UBadge
			>
			<h3 class="font-semibold! text-base! md:text-lg!">{{ badge.name }}</h3>
			<span
				class="text-sm! opacity-90! text-center"
				:class="isGranted ? 'font-semibold!' : ''"
				>{{ badge.description }}</span
			>
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
