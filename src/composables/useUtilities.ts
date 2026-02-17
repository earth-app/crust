import { makeServerRequest } from '~/shared/util';
import { useAuthStore } from '~/stores/auth';

export const SITE_NAME = 'The Earth App';
export const SITE_DESCRIPTION = 'Explore with real people';
export const THEME_COLOR = '#174f96';

export function useTimeOnPage(field: string) {
	const authStore = useAuthStore();
	const timeOnPage = ref(0);
	const isTimerRunning = ref(false);

	const startTimer = async () => {
		if (isTimerRunning.value) return; // timer already running

		const res = await makeServerRequest<void>(null, '/api/user/timer', authStore.sessionToken, {
			method: 'POST',
			body: { action: 'start', field }
		});

		if (!res.success) {
			console.error('Failed to start timer:', res.message);
			return;
		}

		isTimerRunning.value = true;
	};

	const stopTimer = async () => {
		if (!isTimerRunning.value) return; // timer not started

		const res = await makeServerRequest<{ durationMs: number }>(
			null,
			'/api/user/timer',
			authStore.sessionToken,
			{
				method: 'POST',
				body: { action: 'stop', field }
			}
		);

		if (!res.success || !res.data) {
			console.error('Failed to stop timer:', res.message);
			return;
		}

		isTimerRunning.value = false;
		timeOnPage.value += res.data.durationMs;
	};

	onMounted(() => {
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
	});

	return {
		timeOnPage,
		isTimerRunning,
		startTimer,
		stopTimer
	};
}
