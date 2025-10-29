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
						Step {{ visibleStepIndex + 1 }}&nbsp;of&nbsp;{{ visibleSteps.length }}
					</span>
					<div class="flex gap-2">
						<UButton
							v-if="index > 1"
							label="Previous"
							color="info"
							icon="i-heroicons-arrow-left"
							variant="outline"
							size="sm"
							@click="gotoPreviousStep"
						/>
						<UButton
							:label="visibleStepIndex >= visibleSteps.length - 1 ? 'Finish' : 'Next'"
							color="primary"
							:trailing-icon="
								visibleStepIndex >= visibleSteps.length - 1
									? 'i-heroicons-flag'
									: 'i-heroicons-arrow-right'
							"
							size="sm"
							@click="gotoNextStep"
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

let currentElementId: string | null = null;
let resizeObserver: ResizeObserver | null = null;
let mutationObserver: MutationObserver | null = null;

const isActive = computed(() => isActiveTour(props.tourId));
const isLoggedIn = computed(() => !!useCurrentSessionToken());

// Filter steps based on user login status
const visibleSteps = computed(() => {
	if (!isLoggedIn.value) {
		return props.steps;
	}
	return props.steps.filter((step) => !step.anonymous);
});

// Get the current visible step index (0-based)
const visibleStepIndex = computed(() => {
	if (!isLoggedIn.value) {
		return index.value;
	}
	// Count how many non-anonymous steps come before the current index
	let count = 0;
	for (let i = 0; i < index.value && i < props.steps.length; i++) {
		const currentStep = props.steps[i];
		if (currentStep && !currentStep.anonymous) {
			count++;
		}
	}
	return count;
});

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

	// Skip steps marked as anonymous if user is logged in
	if (step.value?.anonymous && isLoggedIn.value) {
		index.value++;
		await display();
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

async function gotoNextStep() {
	const oldStep = index.value;
	index.value++;
	await display();
	emit('next-step', oldStep);
}

async function gotoPreviousStep() {
	const oldStep = index.value;
	index.value--;

	// Skip steps marked as anonymous if user is logged in (going backwards)
	while (index.value >= 0 && props.steps[index.value]?.anonymous && isLoggedIn.value) {
		index.value--;
	}

	await display();
	emit('prev-step', oldStep);
}

function close() {
	// Clean up highlight
	destroyTourHighlight();

	emit('close-tour');
	stopTour();
	index.value = 0;
}

function updateBoxPosition() {
	if (!currentElementId) return;

	const element = document.getElementById(currentElementId);
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
		console.warn(`Element with id "${currentElementId}" not found for tour highlight.`);
		boxStyle.value.display = 'none';
	}
}

function createTourHighlight(id: string) {
	currentElementId = id;
	const element = document.getElementById(id);

	if (element) {
		element.scrollIntoView({ behavior: 'smooth', block: 'center' });

		// Set up ResizeObserver to track element size changes
		resizeObserver = new ResizeObserver(() => {
			updateBoxPosition();
		});
		resizeObserver.observe(element);

		// Set up MutationObserver to track DOM changes that might affect position
		mutationObserver = new MutationObserver(() => {
			updateBoxPosition();
		});
		mutationObserver.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['style', 'class']
		});

		// Listen for scroll and resize events
		window.addEventListener('scroll', updateBoxPosition, true);
		window.addEventListener('resize', updateBoxPosition);
	}

	updateBoxPosition();
}

function destroyTourHighlight() {
	boxStyle.value.display = 'none';
	currentElementId = null;

	// Clean up observers and listeners
	if (resizeObserver) {
		resizeObserver.disconnect();
		resizeObserver = null;
	}
	if (mutationObserver) {
		mutationObserver.disconnect();
		mutationObserver = null;
	}
	window.removeEventListener('scroll', updateBoxPosition, true);
	window.removeEventListener('resize', updateBoxPosition);
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
	destroyTourHighlight();
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
