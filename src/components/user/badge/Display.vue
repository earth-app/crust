<template>
	<div
		class="flex justify-center! items-center aspect-video overflow-hidden rounded-xl border-4 border-gray-700 bg-gray-600 light:border-gray-200 light:bg-white light:shadow-md hover:-translate-y-1 hover:brightness-110 transition-all duration-300 cursor-pointer"
		:class="[
			sizeClasses.container,
			isGranted
				? 'border-yellow-500 shadow-md shadow-white/40 bg-linear-to-tl from-yellow-500/70 via-yellow-600/40 to-yellow-500/70 light:border-yellow-400 light:shadow-yellow-500/30 light:from-yellow-400/80 light:via-amber-200/60 light:to-yellow-400/80'
				: '',
			isMastered
				? 'bg-linear-to-tl! border-purple-400/70! from-purple-900! via-purple-400/60! to-purple-900! shadow-md shadow-purple-500/40! light:via-purple-500/90!'
				: ''
		]"
		@click="emit('clicked')"
	>
		<UIcon
			:name="badge.icon"
			class="shrink-0"
			:class="[
				sizeClasses.icon,
				isGranted ? 'text-white light:text-amber-900' : 'opacity-70',
				isMastered ? 'text-purple-200! opacity-100!' : '',
				isMastered ? 'badge-pulse-mastered' : isGranted ? 'badge-pulse-granted' : ''
			]"
		/>

		<div
			class="flex flex-col items-center px-1 min-w-0"
			:class="size === 'full' ? 'gap-2' : size === 'medium' ? 'gap-1' : ''"
		>
			<UBadge
				:color="rarityColor"
				:size="badgeSize"
				:trailing-icon="isMastered ? 'mdi:star-circle' : isGranted ? 'mdi:check' : ''"
				>{{ capitalizeFully(badge.rarity) }}</UBadge
			>
			<h3
				class="font-semibold! text-center leading-tight line-clamp-2 m-0!"
				:class="[sizeClasses.name, isMastered ? 'text-purple-50!' : '']"
			>
				{{ badge.name }}
			</h3>
			<span
				v-if="size !== 'small'"
				class="opacity-90! text-center line-clamp-2"
				:class="[
					sizeClasses.desc,
					isGranted ? 'font-semibold!' : '',
					isMastered ? 'text-purple-100! opacity-100!' : ''
				]"
				>{{ badge.description }}</span
			>
		</div>
	</div>
</template>

<script setup lang="ts">
const props = withDefaults(
	defineProps<{
		badge: Badge | UserBadge;
		isGranted?: boolean;
		isMastered?: boolean;
		size?: 'small' | 'medium' | 'full';
	}>(),
	{ size: 'full' }
);

// Scale the whole card per size, not just its width.
const sizeClasses = computed(() => {
	switch (props.size) {
		case 'small':
			return {
				container: 'w-35 gap-1.5 p-2',
				icon: 'min-h-7 min-w-7',
				name: 'text-xs!',
				desc: ''
			};
		case 'medium':
			return {
				container: 'w-50 gap-3 p-3',
				icon: 'min-h-12 min-w-12',
				name: 'text-xs! md:text-sm!',
				desc: 'text-xs!'
			};
		default:
			return {
				container: 'w-75 gap-4 p-4',
				icon: 'min-h-16 min-w-16',
				name: 'text-base! md:text-lg!',
				desc: 'text-sm!'
			};
	}
});

const badgeSize = computed(() =>
	props.size === 'small' ? 'xs' : props.size === 'medium' ? 'sm' : 'md'
);

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

<style scoped>
/* subtle resting-state glow pulse — keeps earned/mastered badges feeling alive without distraction */
@keyframes badge-pulse-granted {
	0%,
	100% {
		transform: scale(1);
		filter: drop-shadow(0 0 0 rgba(250, 204, 21, 0));
	}
	50% {
		transform: scale(1.04);
		filter: drop-shadow(0 0 6px rgba(250, 204, 21, 0.55));
	}
}
.badge-pulse-granted {
	animation: badge-pulse-granted 2s ease-in-out infinite;
}

@keyframes badge-pulse-mastered {
	0%,
	100% {
		transform: scale(1);
		filter: drop-shadow(0 0 0 rgba(192, 132, 252, 0));
	}
	50% {
		transform: scale(1.06);
		filter: drop-shadow(0 0 10px rgba(192, 132, 252, 0.7));
	}
}
.badge-pulse-mastered {
	animation: badge-pulse-mastered 2.4s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
	.badge-pulse-granted,
	.badge-pulse-mastered {
		animation: none !important;
	}
}
</style>
