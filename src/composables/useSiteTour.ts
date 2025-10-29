export type SiteTourStep = {
	id: string;
	title: string;
	description: string;
	footer?: string;
	url?: string;
	anonymous?: boolean;
};

export type SiteTour = {
	id: string;
	name: string;
	steps: SiteTourStep[];
};

const activeTourId = ref<string | null>(null);
const tours = ref<Map<string, SiteTour>>(new Map());

export const useSiteTour = () => {
	const registerTour = (tour: SiteTour) => {
		tours.value.set(tour.id, tour);
	};

	const unregisterTour = (tourId: string) => {
		tours.value.delete(tourId);
	};

	const startTour = (tourId: string) => {
		if (tours.value.has(tourId)) {
			activeTourId.value = tourId;

			const name = tours.value.get(tourId)?.name || 'Unknown Tour';
			console.log(`Starting tour: ${name}`);
		} else {
			console.warn(`Tour with id "${tourId}" not found.`);
		}
	};

	const stopTour = () => {
		activeTourId.value = null;
	};

	const getActiveTour = () => {
		if (activeTourId.value) {
			return tours.value.get(activeTourId.value);
		}
		return null;
	};

	const isActiveTour = (tourId: string) => {
		return activeTourId.value === tourId;
	};

	return {
		activeTourId: readonly(activeTourId),
		registerTour,
		unregisterTour,
		startTour,
		stopTour,
		getActiveTour,
		isActiveTour
	};
};
