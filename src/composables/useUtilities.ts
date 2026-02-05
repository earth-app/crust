export const SITE_NAME = 'The Earth App';
export const SITE_DESCRIPTION = 'Explore with real people';
export const THEME_COLOR = '#174f96';

export function useTimeOnPage() {
	const timeOnPage = ref(0);
	const interval = ref<NodeJS.Timeout | null>(null);

	const startTimer = () => {
		if (interval.value) return; // already running
		interval.value = setInterval(() => {
			timeOnPage.value += 1;
		}, 1000);
	};

	const stopTimer = () => {
		if (interval.value) {
			clearInterval(interval.value);
			interval.value = null;
		}
	};

	// pause when tab is not active
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') {
			stopTimer();
		} else {
			startTimer();
		}
	});

	// pause when tabbing out of the window
	window.addEventListener('focus', startTimer);
	window.addEventListener('blur', stopTimer);

	onMounted(() => {
		startTimer();
	});

	onUnmounted(() => {
		stopTimer();
	});

	return {
		timeOnPage,
		startTimer,
		stopTimer
	};
}
