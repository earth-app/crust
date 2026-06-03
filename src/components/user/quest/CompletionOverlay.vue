<template>
	<Teleport to="body">
		<Transition
			enter-active-class="transition duration-300 ease-out"
			leave-active-class="transition duration-200 ease-in"
			enter-from-class="opacity-0 scale-90"
			enter-to-class="opacity-100 scale-100"
			leave-from-class="opacity-100 scale-100"
			leave-to-class="opacity-0 scale-90"
		>
			<div
				v-if="open"
				role="alertdialog"
				aria-modal="true"
				:aria-labelledby="titleId"
				:aria-describedby="descId"
				class="fixed inset-0 z-80 flex items-center justify-center bg-black/60 light:bg-black/40 backdrop-blur-sm p-4"
				@click.self="close"
				@keydown.esc="close"
			>
				<canvas
					v-if="confettiEnabled"
					ref="confettiCanvas"
					class="pointer-events-none fixed inset-0 z-81 w-full h-full"
					aria-hidden="true"
				/>
				<div class="relative max-w-md w-full bg-elevated rounded-2xl shadow-2xl p-6 text-center">
					<UButton
						color="neutral"
						variant="ghost"
						size="sm"
						icon="mdi:close"
						class="absolute top-2 right-2"
						aria-label="Dismiss celebration"
						@click="close"
					/>
					<div
						class="mx-auto mb-3 size-16 rounded-full bg-success/10 flex items-center justify-center"
					>
						<UIcon
							name="mdi:trophy-award"
							class="size-10 text-success"
							:class="confettiEnabled ? 'animate-pulse' : ''"
						/>
					</div>
					<h2
						:id="titleId"
						class="text-2xl font-bold mb-1"
					>
						Quest Complete!
					</h2>
					<p
						v-if="questTitle"
						:id="descId"
						class="text-muted mb-4"
					>
						{{ questTitle }}
					</p>
					<div
						v-if="finalPoints > 0"
						class="flex items-center justify-center gap-2 mb-4"
						aria-live="polite"
					>
						<UIcon
							name="mdi:chart-line"
							class="size-5 text-primary"
						/>
						<span class="text-3xl font-bold text-primary tabular-nums">
							+{{ animatedPoints }}
						</span>
						<span class="text-sm text-muted">Impact Points</span>
					</div>
					<div
						v-if="badgeIcon"
						class="flex items-center justify-center gap-2 my-3"
					>
						<UIcon
							:name="badgeIcon"
							class="size-8 text-warning motion-preset-pop"
						/>
						<span class="text-sm font-medium">Badge unlocked!</span>
					</div>
					<UButton
						color="primary"
						class="mt-2"
						trailing-icon="mdi:arrow-right"
						@click="close"
					>
						Keep Exploring
					</UButton>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<script setup lang="ts">
const props = withDefaults(
	defineProps<{
		open: boolean;
		questTitle?: string;
		points?: number;
		badgeIcon?: string;
	}>(),
	{ points: 0 }
);

const emit = defineEmits<{
	(event: 'update:open', value: boolean): void;
}>();

const titleId = useId();
const descId = useId();

// honor user-level reduced-motion preference — no confetti if they asked for less motion
const prefersReducedMotion = ref(false);
onMounted(() => {
	if (typeof window === 'undefined') return;
	const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
	prefersReducedMotion.value = mql.matches;
	mql.addEventListener?.('change', (e) => (prefersReducedMotion.value = e.matches));
});
const confettiEnabled = computed(() => !prefersReducedMotion.value);

// points count up from 0 → final over ~900ms for a satisfying tick. respects reduced-motion.
const finalPoints = computed(() => Math.max(0, Math.floor(props.points)));
const animatedPoints = ref(0);
let animationFrame: number | null = null;

watch(
	() => props.open,
	(opened) => {
		if (!opened) {
			animatedPoints.value = 0;
			if (animationFrame) cancelAnimationFrame(animationFrame);
			return;
		}
		if (!confettiEnabled.value) {
			animatedPoints.value = finalPoints.value;
			runConfetti();
			return;
		}
		const start = performance.now();
		const duration = 900;
		const target = finalPoints.value;
		const tick = (now: number) => {
			const t = Math.min(1, (now - start) / duration);
			// easeOutCubic
			const eased = 1 - Math.pow(1 - t, 3);
			animatedPoints.value = Math.round(target * eased);
			if (t < 1) animationFrame = requestAnimationFrame(tick);
		};
		animationFrame = requestAnimationFrame(tick);
		runConfetti();
	},
	{ immediate: true }
);

onBeforeUnmount(() => {
	if (animationFrame) cancelAnimationFrame(animationFrame);
});

function close() {
	emit('update:open', false);
}

// micro-confetti: a few hundred particles falling with rotation + drift
const confettiCanvas = ref<HTMLCanvasElement | null>(null);

interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	angle: number;
	spin: number;
	color: string;
	size: number;
	life: number;
}

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#a855f7', '#ef4444'];

function runConfetti() {
	if (!confettiEnabled.value) return;
	if (!import.meta.client) return;
	const canvas = confettiCanvas.value;
	if (!canvas) {
		// canvas may mount on next tick; defer once
		nextTick(() => {
			if (confettiCanvas.value) startConfettiLoop(confettiCanvas.value);
		});
		return;
	}
	startConfettiLoop(canvas);
}

function startConfettiLoop(canvas: HTMLCanvasElement) {
	const dpr = Math.min(2, window.devicePixelRatio || 1);
	canvas.width = window.innerWidth * dpr;
	canvas.height = window.innerHeight * dpr;
	canvas.style.width = `${window.innerWidth}px`;
	canvas.style.height = `${window.innerHeight}px`;
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	ctx.scale(dpr, dpr);

	const particles: Particle[] = [];
	const burst = (cx: number, cy: number, n: number) => {
		for (let i = 0; i < n; i++) {
			const angle = Math.random() * Math.PI * 2;
			const speed = 4 + Math.random() * 6;
			particles.push({
				x: cx,
				y: cy,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed - 4,
				angle: Math.random() * Math.PI,
				spin: (Math.random() - 0.5) * 0.3,
				color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#22c55e',
				size: 6 + Math.random() * 6,
				life: 1
			});
		}
	};
	burst(window.innerWidth * 0.3, window.innerHeight * 0.45, 80);
	burst(window.innerWidth * 0.7, window.innerHeight * 0.45, 80);
	burst(window.innerWidth * 0.5, window.innerHeight * 0.35, 60);

	let raf = 0;
	const start = performance.now();
	const draw = (now: number) => {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		const elapsed = now - start;
		for (const p of particles) {
			p.vy += 0.18; // gravity
			p.x += p.vx;
			p.y += p.vy;
			p.angle += p.spin;
			p.life = Math.max(0, 1 - elapsed / 3200);
			if (p.life <= 0) continue;
			ctx.save();
			ctx.translate(p.x, p.y);
			ctx.rotate(p.angle);
			ctx.globalAlpha = p.life;
			ctx.fillStyle = p.color;
			ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
			ctx.restore();
		}
		if (elapsed < 3300 && props.open) {
			raf = requestAnimationFrame(draw);
		} else {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
		}
	};
	raf = requestAnimationFrame(draw);

	onBeforeUnmount(() => cancelAnimationFrame(raf));
}
</script>
