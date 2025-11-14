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
		v-if="isActive && step"
		ref="tooltipCard"
		:style="{
			position: 'absolute',
			top: tooltipStyle.top,
			left: tooltipStyle.left,
			right: tooltipStyle.right,
			maxWidth: tooltipStyle.maxWidth,
			transform: tooltipStyle.transform,
			zIndex: 9999,
			pointerEvents: 'auto'
		}"
	>
		<UCard class="shadow-lg min-w-80 w-[40vw] max-w-200">
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
					<div class="flex flex-col sm:flex-row gap-2">
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
const tooltipCard = ref<HTMLElement | null>(null);
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
const tooltipStyle = ref({
	top: '0px',
	left: 'auto',
	right: 'auto',
	maxWidth: 'none',
	transform: 'none'
});

let currentElementId: string | null = null;
let resizeObserver: ResizeObserver | null = null;
let mutationObserver: MutationObserver | null = null;

const isActive = computed(() => isActiveTour(props.tourId));
const isLoggedIn = computed(() => !!useCurrentSessionToken());

// Filter steps based on user login status
const visibleSteps = computed(() => {
	return props.steps.filter((step) => {
		// If anonymous is undefined/blank, don't skip
		if (step.anonymous === undefined) return true;
		// If anonymous is true, skip if logged in
		if (step.anonymous === true) return !isLoggedIn.value;
		// If anonymous is false, skip if not logged in
		if (step.anonymous === false) return isLoggedIn.value;
		return true;
	});
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

	// Skip steps based on anonymous property and login status
	if (step.value?.anonymous !== undefined) {
		const shouldSkip =
			(step.value.anonymous === true && isLoggedIn.value) ||
			(step.value.anonymous === false && !isLoggedIn.value);
		if (shouldSkip) {
			index.value++;
			await display();
			return;
		}
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

	// Prerender next step's URL if marked as prerendered
	const nextIndex = index.value + 1;
	if (nextIndex < props.steps.length) {
		const nextStep = props.steps[nextIndex];
		if (nextStep?.prerendered && nextStep?.url) {
			prerenderRoutes(nextStep.url);
		}
	}

	index.value++;
	await display();
	emit('next-step', oldStep);
}

async function gotoPreviousStep() {
	const oldStep = index.value;
	index.value--;

	// Skip steps based on anonymous property and login status (going backwards)
	while (index.value >= 0) {
		const currentStep = props.steps[index.value];
		if (currentStep?.anonymous !== undefined) {
			const shouldSkip =
				(currentStep.anonymous === true && isLoggedIn.value) ||
				(currentStep.anonymous === false && !isLoggedIn.value);
			if (shouldSkip) {
				index.value--;
			} else {
				break;
			}
		} else {
			break;
		}
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
		// Calculate position with padding
		const padding = 8;
		let top = rect.top + window.scrollY - padding;
		let left = rect.left + window.scrollX - padding;
		let width = rect.width + padding * 2;
		let height = rect.height + padding * 2;

		// Ensure the box doesn't overflow off the left or right edge
		const viewportWidth = window.innerWidth;
		if (left < 0) {
			width += left; // Reduce width by the overflow amount
			left = 0;
		}
		if (left + width > viewportWidth) {
			width = viewportWidth - left;
		}

		// Ensure the box doesn't overflow off the top
		if (top < window.scrollY) {
			const overflow = window.scrollY - top;
			height -= overflow;
			top = window.scrollY;
		}

		// Ensure minimum dimensions
		width = Math.max(width, 0);
		height = Math.max(height, 0);

		boxStyle.value = {
			top: `${top}px`,
			left: `${left}px`,
			width: `${width}px`,
			height: `${height}px`,
			display: 'block'
		};

		// Calculate tooltip position
		updateTooltipPosition(top, left, width, height);
	} else {
		// Element not found - hide highlight box and center the tooltip
		console.warn(`Element with id "${currentElementId}" not found for tour highlight.`);
		boxStyle.value.display = 'none';

		const viewportHeight = window.innerHeight;
		const tooltipTop = window.scrollY + viewportHeight / 2 - 100; // Offset to center vertically

		tooltipStyle.value = {
			top: `${tooltipTop}px`,
			left: '50%',
			right: 'auto',
			maxWidth: 'none',
			transform: 'translateX(-50%)'
		};
	}
}

function updateTooltipPosition(
	boxTop: number,
	boxLeft: number,
	boxWidth: number,
	boxHeight: number
) {
	const viewportWidth = window.innerWidth;
	const tooltipOffset = 12;
	const padding = 16;

	// Position tooltip below the box by default
	const tooltipTop = boxTop + boxHeight + tooltipOffset;

	// Try to get actual tooltip width, or use estimated width
	let tooltipWidth = 0;
	if (tooltipCard.value) {
		tooltipWidth = tooltipCard.value.offsetWidth || Math.min(viewportWidth * 0.4, 800);
	} else {
		tooltipWidth = Math.min(viewportWidth * 0.4, 800);
	}

	// Calculate where the tooltip would end if positioned at boxLeft
	const tooltipEndPosition = boxLeft + tooltipWidth;

	// If tooltip would overflow, align it to the right edge instead
	let tooltipLeft: number;
	if (tooltipEndPosition > viewportWidth - padding) {
		// Position from the right edge
		tooltipLeft = Math.max(padding, viewportWidth - tooltipWidth - padding);
	} else {
		// Normal positioning aligned with box
		tooltipLeft = Math.max(padding, boxLeft);
	}

	tooltipStyle.value = {
		top: `${tooltipTop}px`,
		left: `${tooltipLeft}px`,
		right: 'auto',
		maxWidth: 'none',
		transform: 'none'
	};
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
