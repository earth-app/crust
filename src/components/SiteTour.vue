<template>
	<!-- tour start -->
	<Teleport :to="overlayTeleportTarget">
		<div
			v-if="isActive && boxStyle.display === 'block'"
			ref="highlightBox"
			:style="{
				position: 'fixed',
				top: boxStyle.top,
				left: boxStyle.left,
				width: boxStyle.width,
				height: boxStyle.height,
				border: '2px solid #3B82F6',
				borderRadius: '8px',
				boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)',
				pointerEvents: 'none',
				zIndex: boxStyle.zIndex
			}"
		/>
		<div
			v-if="isActive && step"
			ref="tooltipCard"
			@click.stop
			@mousedown.stop
			@pointerdown.stop
			@touchstart.stop
			:style="{
				position: 'fixed',
				top: tooltipStyle.top,
				left: tooltipStyle.left,
				right: tooltipStyle.right,
				maxWidth: tooltipStyle.maxWidth,
				transform: tooltipStyle.transform,
				zIndex: tooltipStyle.zIndex,
				pointerEvents: 'auto'
			}"
		>
			<LazyUCard class="shadow-lg min-w-80 w-[60vw] max-w-200 m-8">
				<template #header>
					<div class="flex justify-between items-center">
						<h3 class="text-lg font-semibold">{{ step.title }}</h3>
						<LazyUButton
							icon="i-heroicons-x-mark"
							color="neutral"
							variant="ghost"
							size="sm"
							@click="close"
							hydrate-on-interaction
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
							<LazyUButton
								v-if="index > 1"
								label="Previous"
								color="info"
								icon="i-heroicons-arrow-left"
								variant="outline"
								size="sm"
								@click="gotoPreviousStep"
								hydrate-on-interaction
							/>
							<LazyUButton
								:label="visibleStepIndex >= visibleSteps.length - 1 ? 'Finish' : 'Next'"
								color="primary"
								:trailing-icon="
									visibleStepIndex >= visibleSteps.length - 1
										? 'i-heroicons-flag'
										: 'i-heroicons-arrow-right'
								"
								size="sm"
								@click="gotoNextStep"
								hydrate-on-interaction
							/>
						</div>
					</div>
				</template>
			</LazyUCard>
		</div>
	</Teleport>
	<!-- tour end -->
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
const overlayTeleportTarget = ref<string | HTMLElement>('body');
const highlightBox = ref<HTMLElement | null>(null);
const tooltipCard = ref<HTMLElement | null>(null);
const router = useRouter();
const index = ref(0);
const step = computed(() => props.steps[index.value] || null);
const BASE_LAYER_Z_INDEX = 20_000;
const boxStyle = ref({
	top: '0px',
	left: '0px',
	width: '0px',
	height: '0px',
	display: 'none',
	zIndex: `${BASE_LAYER_Z_INDEX}`
});
const tooltipStyle = ref({
	top: '0px',
	left: 'auto',
	right: 'auto',
	maxWidth: 'none',
	transform: 'none',
	zIndex: `${BASE_LAYER_Z_INDEX + 1}`
});

let currentElementId: string | null = null;
let resizeObserver: ResizeObserver | null = null;
let mutationObserver: MutationObserver | null = null;
let observedElement: HTMLElement | null = null;
let activeLayerContainer: HTMLElement | null = null;
let hasScrolledToFallbackTooltip = false;
let missingElementWarningId: string | null = null;

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

	if (step.value === null) {
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

function parseNumericZIndex(value: string): number | null {
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed)) return null;
	return parsed;
}

const LAYER_CONTAINER_SELECTOR = [
	'[role="dialog"]',
	'[aria-modal="true"]',
	'[data-radix-dialog-content]',
	'[data-reka-dialog-content]',
	'[data-radix-popper-content-wrapper]',
	'[data-reka-popper-content-wrapper]'
].join(', ');

function findLayerContainer(element?: HTMLElement | null): HTMLElement | null {
	if (!element) return null;
	return element.closest<HTMLElement>(LAYER_CONTAINER_SELECTOR);
}

function updateOverlayTeleportTarget(targetElement?: HTMLElement | null) {
	if (!import.meta.client) return;

	const layerContainer = findLayerContainer(targetElement);
	if (layerContainer) {
		activeLayerContainer = layerContainer;
		overlayTeleportTarget.value = layerContainer;
		return;
	}

	if (activeLayerContainer?.isConnected) {
		overlayTeleportTarget.value = activeLayerContainer;
		return;
	}

	activeLayerContainer = null;
	overlayTeleportTarget.value = 'body';
}

function applyLayerZIndex(targetElement?: HTMLElement | null) {
	let layerZIndex = BASE_LAYER_Z_INDEX;
	let current: HTMLElement | null = targetElement || null;

	while (current) {
		const zIndex = parseNumericZIndex(window.getComputedStyle(current).zIndex);
		if (zIndex !== null) {
			layerZIndex = Math.max(layerZIndex, zIndex + 2);
		}
		current = current.parentElement;
	}

	boxStyle.value.zIndex = `${layerZIndex}`;
	tooltipStyle.value.zIndex = `${layerZIndex + 1}`;
}

function isScrollableContainer(element: HTMLElement): boolean {
	const style = window.getComputedStyle(element);
	const hasVerticalScroll =
		/(auto|scroll|overlay)/.test(style.overflowY) && element.scrollHeight > element.clientHeight;
	const hasHorizontalScroll =
		/(auto|scroll|overlay)/.test(style.overflowX) && element.scrollWidth > element.clientWidth;
	return hasVerticalScroll || hasHorizontalScroll;
}

function scrollTargetIntoView(element: HTMLElement) {
	element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

	const scrollableAncestors: HTMLElement[] = [];
	let current = element.parentElement;
	while (current) {
		if (isScrollableContainer(current)) {
			scrollableAncestors.push(current);
		}
		current = current.parentElement;
	}

	const padding = 16;
	for (const ancestor of scrollableAncestors) {
		const elementRect = element.getBoundingClientRect();
		const ancestorRect = ancestor.getBoundingClientRect();

		if (
			elementRect.top < ancestorRect.top + padding ||
			elementRect.bottom > ancestorRect.bottom - padding
		) {
			const centeredTop =
				ancestor.scrollTop +
				elementRect.top -
				ancestorRect.top -
				ancestor.clientHeight / 2 +
				elementRect.height / 2;
			ancestor.scrollTo({ top: Math.max(0, centeredTop), behavior: 'smooth' });
		}
	}
}

function ensureObserversForTarget(element: HTMLElement) {
	if (observedElement === element) return;

	if (resizeObserver) {
		resizeObserver.disconnect();
	}

	resizeObserver = new ResizeObserver(() => {
		updateBoxPosition();
	});
	resizeObserver.observe(element);
	observedElement = element;
}

function ensureGlobalPositionObservers() {
	if (!mutationObserver) {
		mutationObserver = new MutationObserver(() => {
			updateBoxPosition();
		});
		mutationObserver.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['style', 'class']
		});
	}

	window.addEventListener('scroll', updateBoxPosition, true);
	window.addEventListener('resize', updateBoxPosition);
}

// Throttle update to prevent layout thrashing
let updateTicking = false;
function updateBoxPosition() {
	if (!currentElementId) return;
	if (updateTicking) return;

	updateTicking = true;
	requestAnimationFrame(() => {
		if (!currentElementId) {
			updateTicking = false;
			return;
		}

		const element = document.getElementById(currentElementId);

		if (!element) {
			// Element not found - hide highlight box and center the tooltip
			if (missingElementWarningId !== currentElementId) {
				console.warn(`Element with id "${currentElementId}" not found for tour highlight.`);
				missingElementWarningId = currentElementId;
			}
			updateOverlayTeleportTarget();
			applyLayerZIndex();
			positionFallbackTooltip();
			scrollToFallbackTooltip();
			updateTicking = false;
			return;
		}
		missingElementWarningId = null;

		updateOverlayTeleportTarget(element);
		ensureObserversForTarget(element);
		applyLayerZIndex(element);

		// Batch all layout reads first
		const rect = element.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		// Calculate position with padding
		const padding = 8;
		let top = rect.top - padding;
		let left = rect.left - padding;
		let width = rect.width + padding * 2;
		let height = rect.height + padding * 2;

		// Ensure the box doesn't overflow off the viewport
		if (left < 0) {
			width += left;
			left = 0;
		}
		if (top < 0) {
			height += top;
			top = 0;
		}
		if (left + width > viewportWidth) {
			width = viewportWidth - left;
		}
		if (top + height > viewportHeight) {
			height = viewportHeight - top;
		}

		// Ensure minimum dimensions
		width = Math.max(width, 0);
		height = Math.max(height, 0);

		// Batch all DOM writes
		boxStyle.value = {
			...boxStyle.value,
			top: `${top}px`,
			left: `${left}px`,
			width: `${width}px`,
			height: `${height}px`,
			display: 'block'
		};

		// Calculate tooltip position (already computed values)
		updateTooltipPosition(top, left, width, height, viewportWidth, viewportHeight);
		hasScrolledToFallbackTooltip = false;
		updateTicking = false;
	});
}

function positionFallbackTooltip() {
	const padding = 16;
	boxStyle.value = {
		...boxStyle.value,
		display: 'none'
	};

	tooltipStyle.value = {
		...tooltipStyle.value,
		top: `${padding}px`,
		left: '50%',
		right: 'auto',
		maxWidth: 'min(calc(100vw - 32px), 800px)',
		transform: 'translateX(-50%)'
	};
}

function scrollToFallbackTooltip() {
	if (hasScrolledToFallbackTooltip) return;
	hasScrolledToFallbackTooltip = true;

	nextTick(() => {
		if (!tooltipCard.value) return;

		const rect = tooltipCard.value.getBoundingClientRect();
		const padding = 16;

		if (rect.top >= padding && rect.bottom <= window.innerHeight - padding) {
			return;
		}

		const targetTop = Math.max(0, window.scrollY + rect.top - padding);
		window.scrollTo({ top: targetTop, behavior: 'smooth' });
	});
}

function updateTooltipPosition(
	boxTop: number,
	boxLeft: number,
	boxWidth: number,
	boxHeight: number,
	viewportWidth: number,
	viewportHeight: number
) {
	const tooltipOffset = 12;
	const padding = 16;
	const maxTooltipWidth = Math.max(280, Math.min(viewportWidth - padding * 2, 800));

	// Try to get actual tooltip dimensions, or use estimated values
	let tooltipWidth = 0;
	let tooltipHeight = 0;
	if (tooltipCard.value) {
		tooltipWidth = tooltipCard.value.offsetWidth || maxTooltipWidth;
		tooltipHeight = tooltipCard.value.offsetHeight || 220;
	} else {
		tooltipWidth = maxTooltipWidth;
		tooltipHeight = 220;
	}
	tooltipWidth = Math.min(tooltipWidth, maxTooltipWidth);

	const belowTop = boxTop + boxHeight + tooltipOffset;
	const aboveTop = boxTop - tooltipHeight - tooltipOffset;
	const fitsBelow = belowTop + tooltipHeight <= viewportHeight - padding;
	const fitsAbove = aboveTop >= padding;

	let tooltipTop = belowTop;
	if (!fitsBelow && fitsAbove) {
		tooltipTop = aboveTop;
	} else if (!fitsBelow && !fitsAbove) {
		tooltipTop = Math.max(padding, viewportHeight - tooltipHeight - padding);
	}

	const boxCenter = boxLeft + boxWidth / 2;
	let tooltipLeft = boxCenter - tooltipWidth / 2;
	tooltipLeft = Math.max(padding, Math.min(tooltipLeft, viewportWidth - tooltipWidth - padding));

	tooltipTop = Math.max(padding, Math.min(tooltipTop, viewportHeight - tooltipHeight - padding));

	tooltipStyle.value = {
		...tooltipStyle.value,
		top: `${tooltipTop}px`,
		left: `${tooltipLeft}px`,
		right: 'auto',
		maxWidth: `${maxTooltipWidth}px`,
		transform: 'none'
	};
}

function createTourHighlight(id?: string) {
	currentElementId = id ?? null;
	hasScrolledToFallbackTooltip = false;

	const activeElement = document.activeElement;
	const currentActiveElement = activeElement instanceof HTMLElement ? activeElement : null;
	updateOverlayTeleportTarget(currentActiveElement);
	applyLayerZIndex(currentActiveElement);

	if (!id) {
		positionFallbackTooltip();
		scrollToFallbackTooltip();
		return;
	}

	ensureGlobalPositionObservers();

	const element = document.getElementById(id);

	if (element) {
		updateOverlayTeleportTarget(element);
		scrollTargetIntoView(element);
		ensureObserversForTarget(element);
	}

	updateBoxPosition();
}

function destroyTourHighlight() {
	boxStyle.value = {
		...boxStyle.value,
		display: 'none'
	};
	currentElementId = null;
	observedElement = null;
	activeLayerContainer = null;
	hasScrolledToFallbackTooltip = false;
	missingElementWarningId = null;
	overlayTeleportTarget.value = 'body';

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
if (import.meta.client) {
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
}
</script>
