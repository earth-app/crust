<template>
	<div
		:class="[
			'ml-2 sm:ml-4 md:ml-6 lg:ml-8 mt-6 min-w-70 max-w-11/12 relative rounded-lg',
			special && !prefersReducedMotion ? 'gradient-border-host' : ''
		]"
	>
		<div
			v-if="special && !prefersReducedMotion"
			aria-hidden="true"
			class="gradient-border-ring"
		/>
		<UCard
			class="shadow-xl rounded-lg light:border-2 light:border-black/10 relative z-10"
			:class="special ? 'bg-linear-to-br from-primary/15 via-info/10 to-transparent' : ''"
			variant="soft"
		>
			<div class="flex space-x-1 items-start mb-4">
				<div
					v-if="icon"
					class="flex"
				>
					<UButton
						v-if="iconButton"
						:icon="icon"
						color="neutral"
						variant="soft"
						:ui="{ leadingIcon: 'size-5 md:size-8 mt-0.5' }"
						class="mr-2"
						@click="emit('icon-click')"
					/>
					<UIcon
						v-else
						:name="icon"
						class="size-4 md:size-8 mr-2 mt-0.5"
					/>
				</div>
				<div class="flex flex-col items-start text-white light:text-gray-800 min-w-1/4">
					<h1 class="text-2xl font-semibold">{{ title }}</h1>
					<p
						v-if="description"
						class="text-gray-400 light:text-gray-700 text-sm mt-1"
					>
						{{ description }}
					</p>
					<USeparator
						size="md"
						class="my-2"
					/>
				</div>
			</div>
			<LazyUTooltip
				text="Drag to scroll"
				arrow
				hydrate-on-interaction="mouseover"
			>
				<div
					ref="scrollContainer"
					role="region"
					:aria-label="`${title} card carousel - use arrow keys to scroll`"
					tabindex="0"
					class="flex flex-col sm:flex-row items-stretch flex-nowrap sm:py-2 md:py-4 lg:py-6 px-4 overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md *:mx-2 *:h-1/2 *:min-w-10 *:max-w-140 *:z-10 *:shrink-0"
					@mousedown="startDrag"
					@mousemove="onDrag"
					@mouseup="endDrag"
					@mouseleave="endDrag"
					@keydown="onKeydown"
				>
					<slot />
				</div>
			</LazyUTooltip>
			<LazyUProgress
				v-if="showProgress"
				v-model="progress"
				:max="100"
				class="mt-2 px-12"
				color="secondary"
				height="4px"
				hydrate-on-visible
			/>
		</UCard>
	</div>
</template>

<script setup lang="ts">
defineProps<{
	title: string;
	description?: string;
	icon?: string;
	iconButton?: boolean;
	showProgress?: boolean;
	special?: boolean;
}>();

const emit = defineEmits<{
	(event: 'icon-click'): void;
}>();

const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

const scrollContainer = ref<HTMLElement>();
const isDragging = ref(false);
const startX = ref(0);
const scrollLeft = ref(0);

const progress = ref(0);
function updateProgress() {
	if (scrollContainer.value) {
		const scrollWidth = scrollContainer.value.scrollWidth - scrollContainer.value.clientWidth;
		if (scrollWidth > 0) {
			progress.value = (scrollContainer.value.scrollLeft / scrollWidth) * 100;
		} else {
			progress.value = 0;
		}
	}
}

let scrollTicking = false;
useEventListener(
	scrollContainer,
	'scroll',
	() => {
		if (scrollTicking) return;
		scrollTicking = true;
		requestAnimationFrame(() => {
			updateProgress();
			scrollTicking = false;
		});
	},
	{ passive: true }
);

onMounted(() => {
	if (scrollContainer.value) updateProgress();
});

// keyboard scrolling: arrows nudge by ~80% of viewport width so keyboard users
// don't lose context between pages. Home/End jump to the ends.
const onKeydown = (e: KeyboardEvent) => {
	const el = scrollContainer.value;
	if (!el) return;
	const step = Math.max(120, Math.floor(el.clientWidth * 0.8));
	switch (e.key) {
		case 'ArrowRight':
		case 'PageDown':
			e.preventDefault();
			el.scrollBy({ left: step, behavior: 'smooth' });
			break;
		case 'ArrowLeft':
		case 'PageUp':
			e.preventDefault();
			el.scrollBy({ left: -step, behavior: 'smooth' });
			break;
		case 'Home':
			e.preventDefault();
			el.scrollTo({ left: 0, behavior: 'smooth' });
			break;
		case 'End':
			e.preventDefault();
			el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
			break;
	}
};

const startDrag = (e: MouseEvent) => {
	if (!scrollContainer.value) return;

	isDragging.value = true;
	startX.value = e.pageX - scrollContainer.value.offsetLeft;
	scrollLeft.value = scrollContainer.value.scrollLeft;

	// Prevent text selection while dragging
	e.preventDefault();
};

const onDrag = (e: MouseEvent) => {
	if (!isDragging.value || !scrollContainer.value) return;

	e.preventDefault();
	const x = e.pageX - scrollContainer.value.offsetLeft;
	const walk = (x - startX.value) * 2; // Scroll speed multiplier
	scrollContainer.value.scrollLeft = scrollLeft.value - walk;
};

const endDrag = () => {
	isDragging.value = false;
};
</script>

<style scoped>
@keyframes icg-gradient-spin {
	0% {
		transform: rotate(0deg);
	}
	100% {
		transform: rotate(360deg);
	}
}

.gradient-border-host {
	isolation: isolate;
}

.gradient-border-ring {
	position: absolute;
	inset: -2px;
	border-radius: inherit;
	padding: 2px;
	background: conic-gradient(
		from 0deg,
		var(--ui-primary, #22c55e),
		var(--ui-secondary, #3b82f6),
		var(--ui-info, #06b6d4),
		var(--ui-primary, #22c55e)
	);
	-webkit-mask:
		linear-gradient(#000 0 0) content-box,
		linear-gradient(#000 0 0);
	-webkit-mask-composite: xor;
	mask:
		linear-gradient(#000 0 0) content-box,
		linear-gradient(#000 0 0);
	mask-composite: exclude;
	pointer-events: none;
	z-index: 0;
	animation: icg-gradient-spin 12s linear infinite;
	opacity: 0.7;
}
</style>
