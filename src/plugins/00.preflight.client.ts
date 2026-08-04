import { useBackendStore } from 'stores/backend';
import { setRequestOutcomeListener } from '~/shared/utils/backend';

export default defineNuxtPlugin(() => {
	const backend = useBackendStore();

	setRequestOutcomeListener((status) => backend.reportFailure(status));

	void backend.preflight().then(() => {
		if (backend.isBlocked) backend.startRecoveryPolling();
	});

	// a device coming back online is the most likely moment for the answer to have changed
	if (typeof window !== 'undefined') {
		window.addEventListener('online', () => void backend.preflight(true));
	}
});
