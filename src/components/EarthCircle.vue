<template>
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

	<UIcon
		v-for="(icon, idx) in icons"
		:key="idx"
		:name="icon.name"
		:title="`Satellite ${idx + 1}`"
		size="calc(24px + 0.8vw)"
		class="absolute"
		:style="iconStyle(idx, icon.offset, icon.radius)"
	/>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

const icons = [
	{ name: 'carbon:satellite', speed: 6, radius: 65, offset: 0 },
	{ name: 'solar:satellite-linear', speed: 8, radius: 85, offset: 45 },
	{ name: 'circum:satellite-1', speed: 6, radius: 70, offset: 90 },
	{ name: 'material-symbols-light:satellite-alt-outline', speed: 6.5, radius: 70, offset: 135 },
	{ name: 'solar:rocket-bold-duotone', speed: 4, radius: 80, offset: 60 },
	{ name: 'mdi:space-station', speed: 5, radius: 70, offset: 120 },
	{ name: 'mdi:satellite-variant', speed: 7, radius: 70, offset: 240 },
	{ name: 'solar:ufo-bold', speed: 4, radius: 85, offset: 300 },
	{ name: 'mdi:space-invaders', speed: 7, radius: 90, offset: 180 }
];

const angles = icons.map(() => ref(0));
let rafId: number | null = null;
let lastTimestamp = 0;
let isActive = true;

function animateFrame(timestamp: number) {
	if (!isActive) return; // Stop animation if component is inactive

	if (!lastTimestamp) lastTimestamp = timestamp;
	const deltaMs = timestamp - lastTimestamp;
	lastTimestamp = timestamp;

	icons.forEach((icon, idx) => {
		const degreesPerMs = 360 / (icon.speed * 1000);
		const angleRef = angles[idx];
		if (angleRef) {
			angleRef.value = (angleRef.value + degreesPerMs * deltaMs) % 360;
		}
	});

	if (isActive) {
		rafId = requestAnimationFrame(animateFrame);
	}
}

function iconStyle(idx: number, offset: number = 360 / icons.length, radius: number = 65) {
	const baseAngle = offset * idx;
	const angleRef = angles[idx];
	if (!angleRef) return { display: 'none' };

	const total = angleRef.value + baseAngle;
	const rad = (total * Math.PI) / 180;
	const radiusPercent = radius ?? 65;
	const x = 50 + Math.cos(rad) * radiusPercent;
	const y = 50 + Math.sin(rad) * radiusPercent;
	return {
		top: `${y}%`,
		left: `${x}%`,
		transform: 'translate(-50%, -50%)'
	};
}

onMounted(() => {
	isActive = true;
	rafId = requestAnimationFrame(animateFrame);
});

onUnmounted(() => {
	isActive = false;
	if (rafId) {
		cancelAnimationFrame(rafId);
		rafId = null;
	}
	lastTimestamp = 0;
});
</script>
