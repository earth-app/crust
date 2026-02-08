import { makeServerRequest } from '~/shared/util';

export const SITE_NAME = 'The Earth App';
export const SITE_DESCRIPTION = 'Explore with real people';
export const THEME_COLOR = '#174f96';

export function useTimeOnPage(field: string) {
	const timeOnPage = ref(0);

	const startTimer = async () => {
		const res = await makeServerRequest<void>(null, '/api/user/timer', useCurrentSessionToken(), {
			method: 'POST',
			body: { action: 'start', field }
		});

		if (!res.success) {
			console.error('Failed to start timer:', res.message);
			return;
		}

		timeOnPage.value = 0;
	};

	const stopTimer = async () => {
		const res = await makeServerRequest<{ durationMs: number }>(
			null,
			'/api/user/timer',
			useCurrentSessionToken(),
			{
				method: 'POST',
				body: { action: 'stop', field }
			}
		);

		if (!res.success || !res.data) {
			console.error('Failed to stop timer:', res.message);
			return;
		}

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
		startTimer,
		stopTimer
	};
}
