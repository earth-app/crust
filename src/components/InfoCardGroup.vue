<template>
	<UCard
		class="ml-2 sm:ml-4 md:ml-6 lg:ml-8 mt-6 shadow-xl rounded-lg min-w-70 max-w-11/12 light:border-2 light:border-black/10"
		variant="soft"
	>
		<div class="flex space-x-1 items-start mb-4">
			<div
				v-if="icon"
				class="flex"
			>
				<UIcon
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
		<UTooltip
			text="Drag to scroll"
			arrow
		>
			<div
				ref="scrollContainer"
				class="flex flex-col sm:flex-row items-stretch flex-nowrap sm:py-2 md:py-4 lg:py-6 px-4 overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing *:mx-2 *:h-1/2 *:min-w-10 *:max-w-140 *:z-10 *:shrink-0"
				@mousedown="startDrag"
				@mousemove="onDrag"
				@mouseup="endDrag"
				@mouseleave="endDrag"
			>
				<slot />
			</div>
		</UTooltip>
		<UProgress
			v-if="showProgress"
			v-model="progress"
			:max="100"
			class="mt-2 px-12"
			color="secondary"
			height="4px"
		/>
	</UCard>
</template>

<script setup lang="ts">
defineProps<{
	title: string;
	description?: string;
	icon?: string;
	showProgress?: boolean;
}>();

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

onMounted(() => {
	if (scrollContainer.value) {
		// Throttle scroll updates to animation frame
		let ticking = false;
		const onScroll = () => {
			if (!ticking) {
				ticking = true;
				requestAnimationFrame(() => {
					updateProgress();
					ticking = false;
				});
			}
		};
		scrollContainer.value.addEventListener('scroll', onScroll, { passive: true });
		// Store listener for cleanup
		(scrollContainer.value as any)._onScroll = onScroll;
	}
});

onUnmounted(() => {
	if (scrollContainer.value) {
		const onScroll = (scrollContainer.value as any)._onScroll || updateProgress;
		scrollContainer.value.removeEventListener('scroll', onScroll as any);
	}
});

watchEffect(() => {
	updateProgress();
});

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
