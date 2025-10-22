<template>
	<div
		v-if="isActive && boxStyle.display === 'block'"
		ref="highlightBox"
		:style="{
			position: 'absolute',
			top: boxStyle.top,
			left: boxStyle.left,
			width: boxStyle.width,
			height: boxStyle.height,
			border: '2px solid #3B82F6',
			borderRadius: '8px',
			boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)',
			pointerEvents: 'none',
			zIndex: 9998
		}"
	/>
	<div
		v-if="isActive && boxStyle.display === 'block' && step"
		:style="{
			position: 'absolute',
			top: `calc(${boxStyle.top} + ${boxStyle.height} + 12px)`,
			left: boxStyle.left,
			zIndex: 9999,
			pointerEvents: 'auto'
		}"
	>
		<UCard class="shadow-lg w-[40vw] max-w-200">
			<template #header>
				<div class="flex justify-between items-center">
					<h3 class="text-lg font-semibold">{{ step.title }}</h3>
					<UButton
						icon="i-heroicons-x-mark"
						color="neutral"
						variant="ghost"
						size="sm"
						@click="close"
					/>
				</div>
			</template>

			<p class="text-sm text-gray-600 dark:text-gray-400">
				{{ step.description }}
			</p>

			<template #footer>
				<div class="flex justify-between items-center">
					<p
						v-if="step.footer"
						class="text-xs text-gray-500 px-2"
					>
						{{ step.footer }}
					</p>
					<span class="text-xs text-gray-500 text-center mx-4 w-1/4">
						Step {{ index + 1 }}&nbsp;of&nbsp;{{ steps.length }}
					</span>
					<div class="flex gap-2">
						<UButton
							v-if="index > 1"
							label="Previous"
							color="info"
							icon="i-heroicons-arrow-left"
							variant="outline"
							size="sm"
							@click="
								() => {
									index--;
									display();
									emit('prev-step', index + 1);
								}
							"
						/>
						<UButton
							:label="index >= steps.length - 1 ? 'Finish' : 'Next'"
							color="primary"
							:trailing-icon="
								index >= steps.length - 1 ? 'i-heroicons-flag' : 'i-heroicons-arrow-right'
							"
							size="sm"
							@click="
								() => {
									index++;
									display();
									emit('next-step', index - 1);
								}
							"
						/>
					</div>
				</div>
			</template>
		</UCard>
	</div>
</template>

<script setup lang="ts">
const props = defineProps<{
	tourId: string;
	name: string;
	steps: SiteTourStep[];
}>();

const emit = defineEmits<{
	(event: 'next-step', oldStep: number): void;
	(event: 'prev-step', oldStep: number): void;
	(event: 'close-tour'): void;
}>();

const { registerTour, unregisterTour, isActiveTour, stopTour } = useSiteTour();
const highlightBox = ref<HTMLElement | null>(null);
const router = useRouter();
const index = ref(0);
const step = computed(() => props.steps[index.value] || null);
const boxStyle = ref({
	top: '0px',
	left: '0px',
	width: '0px',
	height: '0px',
	display: 'none'
});

const isActive = computed(() => isActiveTour(props.tourId));

async function display() {
	if (index.value < 0 || index.value >= props.steps.length) {
		// finished the tour
		close();
		return;
	}

	if (step === null) {
		// finished the tour
		close();
		return;
	}

	// Clean up previous highlight
	destroyTourHighlight();
	if (step.value) {
		// Navigate to URL if provided
		if (step.value.url) {
			await router.push(step.value.url).catch((err) => {
				console.error(`Failed to navigate to ${step.value?.url}:`, err);
			});
		}

		// Create new highlight
		createTourHighlight(step.value.id);
	} else {
		console.warn(`No step found at index ${index.value}`);
	}
}

function close() {
	// Clean up highlight
	destroyTourHighlight();

	emit('close-tour');
	stopTour();
	index.value = 0;
}

function createTourHighlight(id: string) {
	const element = document.getElementById(id);
	if (element) {
		element.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	const rect = element?.getBoundingClientRect();
	if (rect) {
		boxStyle.value = {
			top: `${rect.top + window.scrollY - 8}px`,
			left: `${rect.left + window.scrollX - 8}px`,
			width: `${rect.width + 16}px`,
			height: `${rect.height + 16}px`,
			display: 'block'
		};
	} else {
		console.warn(`Element with id "${id}" not found for tour highlight.`);
		boxStyle.value.display = 'none';
	}
}

function destroyTourHighlight() {
	boxStyle.value.display = 'none';
}

// Register/unregister tour
onMounted(() => {
	registerTour({
		id: props.tourId,
		name: props.name,
		steps: props.steps
	});
});

onUnmounted(() => {
	unregisterTour(props.tourId);
});

// Watch for tour activation
watch(isActive, (active) => {
	if (active) {
		index.value = 0;
		if (props.steps.length > 0) {
			display();
		}
	} else {
		destroyTourHighlight();
		index.value = 0;
	}
});
</script>
