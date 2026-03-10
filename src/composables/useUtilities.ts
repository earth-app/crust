import { useAuthStore } from '~/stores/auth';

export function useTimeOnPage(field: string) {
	const authStore = useAuthStore();
	const timeOnPage = ref(0);
	const isTimerRunning = ref(false);
	const timerPending = ref(false);

	const startTimer = async () => {
		if (isTimerRunning.value || timerPending.value) return;
		timerPending.value = true;

		try {
			const res = await makeServerRequest<void>(null, '/api/user/timer', authStore.sessionToken, {
				method: 'POST',
				body: { action: 'start', field }
			});

			if (!res.success) {
				console.error('Failed to start timer:', res.message);
				return;
			}

			isTimerRunning.value = true;
		} finally {
			timerPending.value = false;
		}
	};

	const stopTimer = async () => {
		if (!isTimerRunning.value || timerPending.value) return;
		timerPending.value = true;

		try {
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
		} finally {
			timerPending.value = false;
		}
	};

	const onVisibilityChange = () => {
		if (document.visibilityState === 'hidden') {
			stopTimer();
		} else {
			startTimer();
		}
	};

	onMounted(() => {
		// visibilitychange covers both tab-switching and window focus/blur;
		// using it alone avoids the double-fire that occurs when pairing it with focus/blur.
		document.addEventListener('visibilitychange', onVisibilityChange);
	});

	onUnmounted(() => {
		document.removeEventListener('visibilitychange', onVisibilityChange);
	});

	return {
		timeOnPage,
		isTimerRunning,
		startTimer,
		stopTimer
	};
}
