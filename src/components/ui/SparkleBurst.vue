<template>
	<ClientOnly>
		<canvas
			v-if="active"
			ref="canvasRef"
			class="pointer-events-none absolute inset-0 w-full h-full"
			aria-hidden="true"
		/>
	</ClientOnly>
</template>

<script setup lang="ts">
type Color = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'rainbow';

const props = withDefaults(
	defineProps<{
		trigger: number;
		color?: Color;
		count?: number;
		duration?: number;
	}>(),
	{ color: 'rainbow', count: 28, duration: 900 }
);

const COLOR_SETS: Record<Color, string[]> = {
	primary: ['#22c55e', '#16a34a', '#86efac'],
	secondary: ['#3b82f6', '#1d4ed8', '#93c5fd'],
	success: ['#22c55e', '#16a34a', '#bbf7d0'],
	info: ['#3b82f6', '#0ea5e9', '#7dd3fc'],
	warning: ['#f59e0b', '#fbbf24', '#fde68a'],
	error: ['#ef4444', '#dc2626', '#fca5a5'],
	rainbow: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#a855f7']
};

const canvasRef = ref<HTMLCanvasElement | null>(null);
const active = ref(false);
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	size: number;
	color: string;
	life: number;
}

let raf = 0;
let teardown: (() => void) | null = null;

watch(
	() => props.trigger,
	async (value, prev) => {
		if (value === prev) return;
		if (prefersReducedMotion.value) return;
		if (!import.meta.client) return;
		active.value = true;
		await nextTick();
		runBurst();
	}
);

function runBurst() {
	const canvas = canvasRef.value;
	if (!canvas) return;
	const parent = canvas.parentElement;
	if (!parent) return;

	const dpr = Math.min(2, window.devicePixelRatio || 1);
	const w = parent.clientWidth;
	const h = parent.clientHeight;
	canvas.width = w * dpr;
	canvas.height = h * dpr;
	canvas.style.width = `${w}px`;
	canvas.style.height = `${h}px`;
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	ctx.scale(dpr, dpr);

	const palette = COLOR_SETS[props.color] || COLOR_SETS.rainbow;
	const cx = w / 2;
	const cy = h / 2;
	const cap = Math.min(60, Math.max(8, props.count));
	const particles: Particle[] = [];
	for (let i = 0; i < cap; i++) {
		const angle = Math.random() * Math.PI * 2;
		const speed = 1.2 + Math.random() * 3.2;
		particles.push({
			x: cx,
			y: cy,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			size: 2 + Math.random() * 3,
			color: palette[Math.floor(Math.random() * palette.length)] || palette[0]!,
			life: 1
		});
	}

	const start = performance.now();
	if (teardown) teardown();
	const draw = (now: number) => {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		const elapsed = now - start;
		const t = Math.min(1, elapsed / props.duration);
		for (const p of particles) {
			p.x += p.vx;
			p.y += p.vy;
			p.vy += 0.05;
			p.life = 1 - t;
			if (p.life <= 0) continue;
			ctx.save();
			ctx.globalAlpha = p.life;
			ctx.fillStyle = p.color;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
		}
		if (elapsed < props.duration) {
			raf = requestAnimationFrame(draw);
		} else {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			active.value = false;
		}
	};
	raf = requestAnimationFrame(draw);
	teardown = () => cancelAnimationFrame(raf);
}

onBeforeUnmount(() => {
	if (teardown) teardown();
});
</script>
