<template>
	<div
		ref="root"
		class="ea-circle-root"
	>
		<NuxtImg
			src="/earth-app.png"
			alt="Earth App Logo"
			format="webp"
			width="512"
			height="512"
			class="absolute h-full w-full rounded-full"
			id="earth-circle"
			loading="eager"
			decoding="async"
			fetchpriority="high"
		/>

		<div
			v-for="(icon, idx) in icons"
			:key="idx"
			class="ea-orbit"
			:style="orbitStyle(icon, idx)"
		>
			<UIcon
				:name="icon.name"
				:title="`Satellite ${idx + 1}`"
				size="calc(24px + 0.8vw)"
				class="ea-satellite"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

type Orbit = {
	name: string;
	speed: number;
	radius: number;
	offset: number;
};

const icons: Orbit[] = [
	{ name: 'carbon:satellite', speed: 6, radius: 65, offset: 0 },
	{ name: 'solar:satellite-linear', speed: 8, radius: 85, offset: 45 },
	{ name: 'circum:satellite-1', speed: 6, radius: 70, offset: 90 },
	{ name: 'material-symbols-light:satellite-alt-outline', speed: 6.5, radius: 70, offset: 135 },
	{ name: 'solar:rocket-bold-duotone', speed: 4, radius: 80, offset: 60 },
	{ name: 'mdi:space-station', speed: 5, radius: 70, offset: 120 },
	{ name: 'mdi:satellite-variant', speed: 7, radius: 70, offset: 240 },
	{ name: 'solar:ufo-bold', speed: 4, radius: 85, offset: 300 },
	{ name: 'mdi:space-invaders', speed: 7, radius: 90, offset: 180 },
	{ name: 'solar:asteroid-line-duotone', speed: 9, radius: 90, offset: 270 },
	{ name: 'solar:moon-bold-duotone', speed: 0, radius: 75, offset: 320 }
];

function orbitStyle(icon: Orbit, idx: number) {
	return {
		// ring diameter is 2x the orbit radius, expressed as a percentage of the
		// (square) container so the orbit scales with the responsive logo size
		'--ea-diameter': `${icon.radius * 2}%`,
		'--ea-phase': `${(icon.offset * idx) % 360}deg`,
		'--ea-period': `${icon.speed}s`,
		'--ea-z': idx
	};
}

// webkit pauses composited css animations on a hidden (display:none) ion-page and
// may not resume them; re-trigger the keyframes when we become visible again
const root = ref<HTMLElement | null>(null);

function restartAnimations() {
	root.value?.querySelectorAll<HTMLElement>('.ea-orbit, .ea-satellite').forEach((node) => {
		node.style.animation = 'none';
		void node.offsetWidth; // force reflow so the restart takes effect
		node.style.animation = '';
	});
}

useIntersectionObserver(root, (entries) => {
	if (entries[0]?.isIntersecting) restartAnimations();
});
</script>

<style scoped>
.ea-circle-root {
	position: absolute;
	inset: 0;
}

.ea-orbit {
	position: absolute;
	top: 50%;
	left: 50%;
	width: var(--ea-diameter);
	z-index: var(--ea-z);
	aspect-ratio: 1 / 1;
	/* Decorative: never intercept clicks on nearby content (e.g. hero buttons). */
	pointer-events: none;
	transform: translate(-50%, -50%) rotate(var(--ea-phase));
	animation: ea-orbit-spin var(--ea-period) linear infinite;
}

.ea-satellite {
	position: absolute;
	top: 0;
	left: 50%;
	transform: translate(-50%, -50%) rotate(calc(-1 * var(--ea-phase)));
	animation: ea-satellite-upright var(--ea-period) linear infinite;
}

@keyframes ea-orbit-spin {
	from {
		transform: translate(-50%, -50%) rotate(var(--ea-phase));
	}
	to {
		transform: translate(-50%, -50%) rotate(calc(var(--ea-phase) + 360deg));
	}
}

@keyframes ea-satellite-upright {
	from {
		transform: translate(-50%, -50%) rotate(calc(-1 * var(--ea-phase)));
	}
	to {
		transform: translate(-50%, -50%) rotate(calc(-1 * var(--ea-phase) - 360deg));
	}
}

@media (prefers-reduced-motion: reduce) {
	.ea-orbit,
	.ea-satellite {
		animation: none;
	}
}
</style>
