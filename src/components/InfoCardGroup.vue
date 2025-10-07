<template>
	<UCard
		class="ml-2 sm:ml-4 md:ml-6 lg:ml-8 mt-6 shadow-xl rounded-lg min-w-70 max-w-11/12"
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
			<div class="flex flex-col items-start text-white min-w-1/4">
				<h1 class="text-2xl font-semibold">{{ title }}</h1>
				<p
					v-if="description"
					class="text-gray-400 text-sm mt-1"
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
	</UCard>
</template>

<script setup lang="ts">
defineProps<{
	title: string;
	description?: string;
	icon?: string;
}>();

const scrollContainer = ref<HTMLElement>();
const isDragging = ref(false);
const startX = ref(0);
const scrollLeft = ref(0);

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
