<template>
	<!-- tour start -->
	<Teleport :to="overlayTeleportTarget">
		<!-- dim backdrop with cutout -->
		<div
			v-if="isActive && showDim"
			:style="{
				position: 'fixed',
				top: dimStyle.top,
				left: dimStyle.left,
				width: dimStyle.width,
				height: dimStyle.height,
				borderRadius: `${effectiveRadius}px`,
				boxShadow: `0 0 0 9999px ${dimColor}`,
				pointerEvents: allowInteraction ? 'none' : 'auto',
				transition: 'top 180ms ease, left 180ms ease, width 180ms ease, height 180ms ease',
				zIndex: dimZIndex
			}"
			@click="onBackdropClick"
		/>

		<!-- highlight box -->
		<div
			v-if="isActive && boxStyle.display === 'block'"
			ref="highlightBox"
			:class="['site-tour-highlight', { 'site-tour-highlight--pulse': showPulse }]"
			:style="{
				position: 'fixed',
				top: boxStyle.top,
				left: boxStyle.left,
				width: boxStyle.width,
				height: boxStyle.height,
				borderRadius: `${effectiveRadius}px`,
				pointerEvents: 'none',
				zIndex: boxStyle.zIndex
			}"
		/>

		<!-- tooltip card -->
		<div
			v-if="isActive && step"
			ref="tooltipCard"
			class="site-tour-card-wrap motion-preset-fade-md"
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
				transition: 'top 180ms ease, left 180ms ease, right 180ms ease, transform 180ms ease',
				zIndex: tooltipStyle.zIndex,
				pointerEvents: 'auto'
			}"
		>
			<LazyUCard class="shadow-xl min-w-20 w-[50vw] max-w-150 m-8 site-tour-card">
				<template #header>
					<div class="flex justify-between items-center gap-2">
						<div class="flex items-center gap-2 min-w-0">
							<UIcon
								v-if="step.icon"
								:name="step.icon"
								class="size-5 text-primary-500 shrink-0"
							/>
							<h3 class="text-lg font-semibold truncate">{{ step.title }}</h3>
						</div>
						<LazyUButton
							icon="i-heroicons-x-mark"
							color="neutral"
							variant="ghost"
							size="sm"
							@click="close()"
							aria-label="Close tour"
							hydrate-on-interaction
						/>
					</div>
				</template>

				<p class="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">
					{{ step.description }}
				</p>

				<NuxtImg
					v-if="step.image"
					:src="step.image"
					class="mt-3 rounded-md w-full max-h-48 object-cover border border-gray-200 dark:border-gray-800"
					loading="lazy"
				/>

				<template #footer>
					<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
						<p
							v-if="step.footer"
							class="text-xs text-gray-500 px-2 flex-1"
						>
							{{ step.footer }}
						</p>
						<div class="flex items-center justify-between gap-2 sm:justify-end shrink-0">
							<span class="text-xs text-gray-500 whitespace-nowrap">
								Step {{ visibleStepIndex + 1 }}&nbsp;of&nbsp;{{ visibleSteps.length }}
							</span>
							<div class="flex flex-col sm:flex-row gap-2">
								<LazyUButton
									v-if="index > 0"
									label="Back"
									color="neutral"
									icon="i-heroicons-arrow-left"
									variant="outline"
									size="sm"
									:disabled="busy"
									@click="gotoPreviousStep"
									hydrate-on-interaction
								/>
								<LazyUButton
									v-if="step.cta"
									:label="step.cta.label"
									:color="(step.cta.color as any) || 'success'"
									:icon="step.cta.icon || 'i-heroicons-bolt'"
									size="sm"
									:loading="ctaLoading"
									:disabled="busy"
									@click="runCTA"
									hydrate-on-interaction
								/>
								<LazyUButton
									:label="isLastVisibleStep ? 'Finish' : 'Next'"
									color="primary"
									:trailing-icon="
										isLastVisibleStep ? 'i-heroicons-flag' : 'i-heroicons-arrow-right'
									"
									size="sm"
									:loading="advancing"
									:disabled="busy"
									@click="gotoNextStep"
									hydrate-on-interaction
								/>
							</div>
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
	dim?: boolean;
	pulse?: boolean;
	allowSkip?: boolean;
	persist?: boolean;
}>();

const emit = defineEmits<{
	(event: 'next-step', oldStep: number): void;
	(event: 'prev-step', oldStep: number): void;
	(event: 'close-tour'): void;
	(event: 'complete-tour'): void;
}>();

const { registerTour, unregisterTour, isActiveTour, stopTour, activeStepIndex, markCompleted } =
	useSiteTour();

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
	zIndex: `${BASE_LAYER_Z_INDEX + 1}`
});
const dimStyle = ref({
	top: '-50vh',
	left: '-50vw',
	width: '0px',
	height: '0px'
});
const tooltipStyle = ref({
	top: '0px',
	left: 'auto',
	right: 'auto',
	maxWidth: 'none',
	transform: 'none',
	zIndex: `${BASE_LAYER_Z_INDEX + 2}`
});
const dimZIndex = ref(`${BASE_LAYER_Z_INDEX}`);
const dimColor = 'rgba(0, 0, 0, 0.55)';

const busy = ref(false);
const advancing = ref(false);
const ctaLoading = ref(false);

let currentElementId: string | null = null;
let mutationObserver: MutationObserver | null = null;
const observedElement = ref<HTMLElement | null>(null);
useResizeObserver(observedElement, () => updateBoxPosition());

let activeLayerContainer: HTMLElement | null = null;
let hasScrolledToFallbackTooltip = false;
let missingElementWarningId: string | null = null;
let displayToken = 0;

const isActive = computed(() => isActiveTour(props.tourId));
const isLoggedIn = computed(() => !!useCurrentSessionToken());

defineExpose({
	isActive,
	currentStep: step,
	highlightBox
});

const visibleSteps = computed(() => props.steps.filter((s) => !shouldSkipStep(s)));

const visibleStepIndex = computed(() => {
	let count = 0;
	for (let i = 0; i < index.value && i < props.steps.length; i++) {
		const s = props.steps[i];
		if (s && !shouldSkipStep(s)) count++;
	}
	return count;
});

const isLastVisibleStep = computed(() => visibleStepIndex.value >= visibleSteps.value.length - 1);

const showPulse = computed(() => {
	if (step.value?.pulse === false) return false;
	if (props.pulse === false) return false;
	if (step.value?.pulse === true) return true;
	if (props.pulse === true) return true;
	return true; // default-on for new visual feedback
});

const showDim = computed(() => {
	if (!isActive.value) return false;
	if (step.value?.dim === false) return false;
	if (step.value?.dim === true) return true;
	return !!props.dim;
});

const allowInteraction = computed(() => {
	return step.value?.interactive === true;
});

const effectiveRadius = computed(() => {
	if (typeof step.value?.radius === 'number') return step.value.radius;
	return 10;
});

function shouldSkipStep(s: SiteTourStep): boolean {
	if (s.anonymous === true && isLoggedIn.value) return true;
	if (s.anonymous === false && !isLoggedIn.value) return true;
	if (s.condition && !s.condition()) return true;
	return false;
}

async function waitForElement(id: string, timeout: number): Promise<HTMLElement | null> {
	const existing = document.getElementById(id);
	if (existing) return existing;
	if (timeout <= 0) return null;

	return new Promise((resolve) => {
		const start = Date.now();
		const interval = 60;

		const tick = () => {
			const el = document.getElementById(id);
			if (el) {
				resolve(el);
				return;
			}
			if (Date.now() - start >= timeout) {
				resolve(null);
				return;
			}
			setTimeout(tick, interval);
		};

		setTimeout(tick, interval);
	});
}

async function waitForCondition(check: () => boolean, timeout: number): Promise<boolean> {
	if (check()) return true;
	const start = Date.now();
	return new Promise((resolve) => {
		const interval = 80;
		const tick = () => {
			if (check()) {
				resolve(true);
				return;
			}
			if (Date.now() - start >= timeout) {
				resolve(false);
				return;
			}
			setTimeout(tick, interval);
		};
		setTimeout(tick, interval);
	});
}

async function executeActions(actions: SiteTourStepAction[] | undefined) {
	if (!actions || actions.length === 0) return;

	for (const action of actions) {
		if (action.delay && action.delay > 0) {
			await new Promise((resolve) => setTimeout(resolve, action.delay));
		}

		const target = action.target ? document.getElementById(action.target) : null;

		switch (action.type) {
			case 'click':
				if (target instanceof HTMLElement) {
					target.click();
				}
				break;
			case 'focus':
				if (target instanceof HTMLElement) {
					target.focus({ preventScroll: false });
				}
				break;
			case 'scroll':
				if (target instanceof HTMLElement) {
					target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
				}
				break;
			case 'set-value':
				if (
					(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
					typeof action.value === 'string'
				) {
					target.value = action.value;
					target.dispatchEvent(new Event('input', { bubbles: true }));
					target.dispatchEvent(new Event('change', { bubbles: true }));
				}
				break;
			case 'dispatch-event':
				if (target instanceof HTMLElement && action.event) {
					target.dispatchEvent(new CustomEvent(action.event, { bubbles: true }));
				}
				break;
			case 'wait':
				// already handled above via delay
				break;
		}
	}
}

async function display() {
	const token = ++displayToken;
	busy.value = true;

	try {
		if (index.value < 0 || index.value >= props.steps.length) {
			close({ completed: true });
			return;
		}

		if (step.value === null) {
			close({ completed: true });
			return;
		}

		const currentStep = step.value;

		if (shouldSkipStep(currentStep)) {
			index.value++;
			if (token !== displayToken) return;
			await display();
			return;
		}

		destroyTourHighlight();

		if (currentStep.url) {
			try {
				await router.push(currentStep.url);
			} catch (err) {
				console.error(`Failed to navigate to ${currentStep.url}:`, err);
			}
			if (token !== displayToken) return;
			// give nuxt a microtask to mount the new page
			await nextTick();
		}

		if (currentStep.delay && currentStep.delay > 0) {
			await new Promise((resolve) => setTimeout(resolve, currentStep.delay));
			if (token !== displayToken) return;
		}

		if (currentStep.waitFor) {
			const waited = await waitForCondition(() => {
				const el = document.getElementById(currentStep.waitFor!);
				return !!el;
			}, currentStep.waitTimeout ?? 2500);
			if (!waited) {
				console.warn(
					`Tour "${props.tourId}" timed out waiting for waitFor element "${currentStep.waitFor}".`
				);
			}
			if (token !== displayToken) return;
		}

		if (currentStep.id) {
			// wait for the target element to exist before rendering highlight,
			// avoids highlighting a stale element while the next page hydrates
			await waitForElement(currentStep.id, currentStep.waitTimeout ?? 1800);
			if (token !== displayToken) return;
		}

		await executeActions(currentStep.actions);
		if (token !== displayToken) return;

		createTourHighlight(currentStep.id);

		// fire onEnter after highlight is in place
		try {
			await currentStep.onEnter?.();
		} catch (err) {
			console.warn(`Tour step onEnter failed:`, err);
		}
	} finally {
		if (token === displayToken) {
			busy.value = false;
			advancing.value = false;
		}
	}
}

async function gotoNextStep() {
	if (busy.value) return;
	advancing.value = true;
	const oldStep = index.value;

	const currentStep = props.steps[oldStep];
	try {
		await currentStep?.onExit?.();
	} catch (err) {
		console.warn('Tour step onExit failed:', err);
	}

	const nextIndex = oldStep + 1;
	if (nextIndex < props.steps.length) {
		const nextStep = props.steps[nextIndex];
		if (nextStep?.prerendered && nextStep?.url) {
			try {
				prerenderRoutes(nextStep.url);
			} catch {
				// ignore prerender failures
			}
		}
	}

	if (nextIndex >= props.steps.length) {
		emit('next-step', oldStep);
		close({ completed: true });
		return;
	}

	index.value = nextIndex;
	await display();
	emit('next-step', oldStep);
}

async function gotoPreviousStep() {
	if (busy.value) return;
	const oldStep = index.value;

	const currentStep = props.steps[oldStep];
	try {
		await currentStep?.onExit?.();
	} catch (err) {
		console.warn('Tour step onExit failed:', err);
	}

	let newIndex = oldStep - 1;
	while (newIndex >= 0) {
		const s = props.steps[newIndex];
		if (s && shouldSkipStep(s)) {
			newIndex--;
		} else {
			break;
		}
	}
	if (newIndex < 0) newIndex = 0;

	index.value = newIndex;
	await display();
	emit('prev-step', oldStep);
}

async function runCTA() {
	const cta = step.value?.cta;
	if (!cta) return;
	if (ctaLoading.value) return;

	ctaLoading.value = true;
	try {
		await cta.handler();
		if (cta.closeOnSuccess) {
			close({ completed: false });
			return;
		}
		if (cta.advance !== false) {
			await gotoNextStep();
		}
	} catch (err) {
		console.error('Tour CTA handler failed:', err);
	} finally {
		ctaLoading.value = false;
	}
}

function close(options: { completed?: boolean } = {}) {
	const wasActive = isActive.value;
	destroyTourHighlight();

	if (wasActive) {
		if (options.completed) {
			emit('complete-tour');
			if (props.persist !== false) {
				markCompleted(props.tourId);
			}
		}
		emit('close-tour');
		stopTour({ completed: options.completed });
	}

	index.value = 0;
}

function onBackdropClick() {
	if (props.allowSkip === false) return;
	close({ completed: false });
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

function isClippingContainer(element: HTMLElement): boolean {
	if (!import.meta.client) return false;
	const style = window.getComputedStyle(element);
	const clips = (v: string) => v === 'hidden' || v === 'clip';
	return clips(style.overflow) || clips(style.overflowX) || clips(style.overflowY);
}

function findLayerContainer(element?: HTMLElement | null): HTMLElement | null {
	if (!element) return null;
	const layer = element.closest<HTMLElement>(LAYER_CONTAINER_SELECTOR);
	if (layer && isClippingContainer(layer)) return null;
	return layer;
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

	dimZIndex.value = `${layerZIndex}`;
	boxStyle.value.zIndex = `${layerZIndex + 1}`;
	tooltipStyle.value.zIndex = `${layerZIndex + 2}`;
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
	if (observedElement.value === element) return;
	observedElement.value = element;
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
}

useEventListener('scroll', () => updateBoxPosition(), { capture: true });
useEventListener('resize', () => updateBoxPosition());

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

		const rect = element.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		const padding =
			typeof step.value?.highlightPadding === 'number' ? step.value.highlightPadding : 8;
		let top = rect.top - padding;
		let left = rect.left - padding;
		let width = rect.width + padding * 2;
		let height = rect.height + padding * 2;

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

		width = Math.max(width, 0);
		height = Math.max(height, 0);

		boxStyle.value = {
			...boxStyle.value,
			top: `${top}px`,
			left: `${left}px`,
			width: `${width}px`,
			height: `${height}px`,
			display: 'block'
		};

		dimStyle.value = {
			top: `${top}px`,
			left: `${left}px`,
			width: `${width}px`,
			height: `${height}px`
		};

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

	dimStyle.value = {
		top: '50%',
		left: '50%',
		width: '0px',
		height: '0px'
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

	const placement: SiteTourStepPlacement = step.value?.placement || 'auto';

	const belowTop = boxTop + boxHeight + tooltipOffset;
	const aboveTop = boxTop - tooltipHeight - tooltipOffset;
	const fitsBelow = belowTop + tooltipHeight <= viewportHeight - padding;
	const fitsAbove = aboveTop >= padding;

	let tooltipTop = belowTop;
	let tooltipLeft = boxLeft + boxWidth / 2 - tooltipWidth / 2;

	if (placement === 'center') {
		tooltipTop = Math.max(padding, viewportHeight / 2 - tooltipHeight / 2);
		tooltipLeft = Math.max(padding, viewportWidth / 2 - tooltipWidth / 2);
	} else if (placement === 'top' && fitsAbove) {
		tooltipTop = aboveTop;
	} else if (placement === 'bottom' && fitsBelow) {
		tooltipTop = belowTop;
	} else if (placement === 'left') {
		tooltipTop = boxTop + boxHeight / 2 - tooltipHeight / 2;
		tooltipLeft = boxLeft - tooltipWidth - tooltipOffset;
	} else if (placement === 'right') {
		tooltipTop = boxTop + boxHeight / 2 - tooltipHeight / 2;
		tooltipLeft = boxLeft + boxWidth + tooltipOffset;
	} else {
		// auto
		if (!fitsBelow && fitsAbove) {
			tooltipTop = aboveTop;
		} else if (!fitsBelow && !fitsAbove) {
			tooltipTop = Math.max(padding, viewportHeight - tooltipHeight - padding);
		}
	}

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
	observedElement.value = null;
	activeLayerContainer = null;
	hasScrolledToFallbackTooltip = false;
	missingElementWarningId = null;
	overlayTeleportTarget.value = 'body';

	if (mutationObserver) {
		mutationObserver.disconnect();
		mutationObserver = null;
	}
}

onMounted(() => {
	registerTour({
		id: props.tourId,
		name: props.name,
		steps: props.steps,
		dim: props.dim,
		pulse: props.pulse,
		allowSkip: props.allowSkip,
		persist: props.persist
	});
});

onUnmounted(() => {
	unregisterTour(props.tourId);
	destroyTourHighlight();
});

if (import.meta.client) {
	watch(isActive, (active) => {
		if (active) {
			index.value = Math.max(0, Math.min(activeStepIndex.value || 0, props.steps.length - 1));
			if (props.steps.length > 0) {
				display();
			}
		} else {
			destroyTourHighlight();
			index.value = 0;
		}
	});

	watch(activeStepIndex, (newIdx) => {
		if (!isActive.value) return;
		if (newIdx === index.value) return;
		const clamped = Math.max(0, Math.min(newIdx, props.steps.length - 1));
		if (clamped !== index.value) {
			index.value = clamped;
			display();
		}
	});

	// keyboard navigation
	useEventListener(window, 'keydown', (event: KeyboardEvent) => {
		if (!isActive.value) return;
		if (event.key === 'Escape' && props.allowSkip !== false) {
			event.preventDefault();
			close({ completed: false });
		} else if (event.key === 'ArrowRight' && !busy.value) {
			event.preventDefault();
			gotoNextStep();
		} else if (event.key === 'ArrowLeft' && !busy.value && index.value > 0) {
			event.preventDefault();
			gotoPreviousStep();
		}
	});
}
</script>

<style scoped>
.site-tour-highlight {
	border: 2px solid #3b82f6;
	box-shadow:
		0 0 0 4px rgba(59, 130, 246, 0.18),
		0 0 14px rgba(59, 130, 246, 0.55);
	background: transparent;
	transition:
		top 180ms ease,
		left 180ms ease,
		width 180ms ease,
		height 180ms ease,
		box-shadow 250ms ease;
	will-change: top, left, width, height;
}

.site-tour-highlight--pulse {
	animation: site-tour-pulse 1.6s ease-in-out infinite;
}

@keyframes site-tour-pulse {
	0%,
	100% {
		box-shadow:
			0 0 0 4px rgba(59, 130, 246, 0.18),
			0 0 12px rgba(59, 130, 246, 0.45);
	}
	50% {
		box-shadow:
			0 0 0 10px rgba(59, 130, 246, 0.05),
			0 0 22px rgba(59, 130, 246, 0.7);
	}
}

@media (prefers-reduced-motion: reduce) {
	.site-tour-highlight--pulse {
		animation: none;
	}
	.site-tour-card-wrap {
		transition: none !important;
	}
}
</style>
