// bootstraps the badge-unlock listener once on client mount. websocket plugin
// also calls onIncomingNotification directly for live events; this plugin
// arms the localStorage-watermark polling fallback for missed pushes.
export default defineNuxtPlugin((nuxtApp) => {
	nuxtApp.hook('app:mounted', () => {
		if (!import.meta.client) return;
		const { start } = useBadgeUnlockListener();
		start();
	});
});
