<template>
	<div class="w-4/5 min-w-150">
		<UFormField
			label="Location"
			name="location"
			help="Enter coordinates or search for a location"
		>
			<div class="space-y-2 space-x-4 w-full">
				<UInput
					v-model="coordinatesInput"
					placeholder="e.g., 40.7128, -74.0060"
					@update:modelValue="handleCoordinatesChange"
					@blur="handleCoordinatesBlur"
					:color="coordinatesValid === false ? 'error' : undefined"
					class="w-1/3 min-w-60"
				>
					<template #leading>
						<UIcon name="mdi:map-marker" />
					</template>
				</UInput>
				<span
					v-if="coordinatesValid === false"
					class="text-xs text-red-500"
				>
					Invalid coordinates format. Use: latitude, longitude
				</span>

				<UInputMenu
					v-model="selection"
					:items="results"
					:icon="getIconForType(selection?.types || [])"
					:loading="loading"
					placeholder="Or search for a location..."
					@update:searchTerm="handleSearchChange"
					class="w-2/3 min-w-120"
				>
					<template #item="{ item }">
						<div class="flex items-center justify-between w-full">
							<div class="flex items-center gap-2">
								<UIcon
									:name="getIconForType(item.types)"
									class="min-h-5 min-w-5"
								/>
								<div>
									<div class="font-medium">{{ item.label }}</div>
									<div
										v-if="item.subtitle"
										class="text-xs text-gray-500"
									>
										{{ item.subtitle }}
									</div>
								</div>
							</div>
						</div>
					</template>
				</UInputMenu>
			</div>
		</UFormField>
	</div>
</template>

<script setup lang="ts">
import type { EventAutocompleteSuggestion } from '~/shared/types/event';

const props = defineProps<{
	modelValue: {
		latitude: number;
		longitude: number;
	} | null;
	fields?: Record<string, any>;
}>();

const emit = defineEmits<{
	'update:modelValue': [value: { latitude: number; longitude: number } | null];
	'update:fields': [value: Record<string, any>];
}>();

const {
	autocomplete,
	geocode,
	reverseGeocode: reverseGeocodeFromComposable,
	retrieveLocation
} = useGeocoding();
const toast = useToast();

type LocationItem = {
	label: string;
	subtitle?: string;
	latitude: number;
	longitude: number;
	full_name: string;
	types: string[];
};

const session = crypto.randomUUID();
const selection = ref<LocationItem | undefined>(undefined);
const results = ref<LocationItem[]>([]);
const loading = ref(false);
const searchTerm = ref('');

// Coordinates input
const coordinatesInput = ref('');
const coordinatesValid = ref<boolean | null>(null);

const typeIconMap: Record<string, string> = {
	locality: 'mdi:city',
	country: 'mdi:flag',
	administrative_area_level_1: 'mdi:map-marker-radius',
	administrative_area_level_2: 'mdi:map-marker-radius',
	postal_code: 'mdi:mailbox',
	street_address: 'mdi:road',
	route: 'mdi:road',
	establishment: 'mdi:store',
	point_of_interest: 'mdi:star',
	park: 'mdi:tree',
	restaurant: 'mdi:food',
	cafe: 'mdi:coffee',
	school: 'mdi:school',
	university: 'mdi:school',
	airport: 'mdi:airplane',
	train_station: 'mdi:train',
	transit_station: 'mdi:bus'
};

function getIconForType(types: string[]): string {
	if (!types || types.length === 0) return 'mdi:earth';

	for (const type of types) {
		if (typeIconMap[type]) {
			return typeIconMap[type];
		}
	}

	return 'mdi:earth';
}

function formatDistance(meters: number | undefined): string | undefined {
	if (meters === undefined) return undefined;

	if (meters < 1000) {
		return `${Math.round(meters)}m away`;
	} else {
		return `${(meters / 1000).toFixed(1)}km away`;
	}
}

// Initialize from modelValue
onMounted(() => {
	retrieveLocation();

	if (props.modelValue) {
		coordinatesInput.value = `${props.modelValue.latitude}, ${props.modelValue.longitude}`;
		coordinatesValid.value = true;

		// Reverse geocode to get address
		reverseGeocode(props.modelValue.latitude, props.modelValue.longitude);
	}
});

// Watch for external changes to modelValue
watch(
	() => props.modelValue,
	(newValue) => {
		if (newValue && !selection.value) {
			coordinatesInput.value = `${newValue.latitude}, ${newValue.longitude}`;
			coordinatesValid.value = true;
		}
	},
	{ deep: true }
);

// Handle coordinates input change (validation only)
function handleCoordinatesChange(value: string) {
	if (!value || value.trim() === '') {
		coordinatesValid.value = null;
		return;
	}

	// Remove all spaces and split by comma
	const cleaned = value.replace(/\s/g, '');
	const parts = cleaned.split(',');

	if (parts.length !== 2 || !parts[0] || !parts[1]) {
		coordinatesValid.value = false;
		return;
	}

	const lat = parseFloat(parts[0]);
	const lng = parseFloat(parts[1]);

	if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
		coordinatesValid.value = false;
		return;
	}

	coordinatesValid.value = true;
}

// Handle coordinates blur (update only when valid and unfocused)
async function handleCoordinatesBlur() {
	if (coordinatesValid.value !== true) {
		return;
	}

	const value = coordinatesInput.value;
	if (!value || value.trim() === '') {
		return;
	}

	// Remove all spaces and split by comma
	const cleaned = value.replace(/\s/g, '');
	const parts = cleaned.split(',');

	if (parts.length !== 2 || !parts[0] || !parts[1]) {
		return;
	}

	const lat = parseFloat(parts[0]);
	const lng = parseFloat(parts[1]);

	if (isNaN(lat) || isNaN(lng)) {
		return;
	}

	// Check if the coordinates have actually changed
	if (props.modelValue && props.modelValue.latitude === lat && props.modelValue.longitude === lng) {
		return; // No change, do nothing
	}

	// Update location
	emit('update:modelValue', {
		latitude: lat,
		longitude: lng
	});

	// Reverse geocode to populate the address and selection
	await reverseGeocode(lat, lng);
}

// Handle search term change
let searchTimeout: NodeJS.Timeout | null = null;
async function handleSearchChange(term: string) {
	searchTerm.value = term;

	if (!term || term.trim() === '') {
		results.value = [];
		return;
	}

	// Debounce search
	if (searchTimeout) {
		clearTimeout(searchTimeout);
	}

	searchTimeout = setTimeout(async () => {
		await performSearch(term);
	}, 300);
}

async function performSearch(term: string) {
	loading.value = true;

	try {
		const res = await autocomplete(term, session);

		if (res.success && 'data' in res && res.data) {
			const suggestions = res.data;

			results.value = suggestions.map((suggestion: EventAutocompleteSuggestion) => ({
				label: suggestion.name,
				subtitle: suggestion.address || formatDistance(suggestion.distance_meters),
				latitude: 0, // Will be geocoded when selected
				longitude: 0,
				full_name: suggestion.full_name,
				types: suggestion.types || []
			}));
		} else {
			results.value = [];
		}
	} catch (error) {
		console.error('Autocomplete error:', error);
		toast.add({
			title: 'Error',
			icon: 'mdi:alert-circle',
			description: 'Failed to fetch location suggestions',
			color: 'error',
			duration: 3000
		});
		results.value = [];
	} finally {
		loading.value = false;
	}
}

// Watch for selection changes
watch(selection, async (newSelection) => {
	if (!newSelection) return;

	// Geocode the selected location
	const res = await geocode(newSelection.full_name);

	if (res.success && 'data' in res && res.data) {
		// Update coordinates
		emit('update:modelValue', {
			latitude: res.data.latitude,
			longitude: res.data.longitude
		});

		// Update coordinates input
		coordinatesInput.value = `${res.data.latitude}, ${res.data.longitude}`;
		coordinatesValid.value = true;

		// Update fields with address
		const updatedFields = { ...(props.fields || {}) };
		updatedFields['address'] = newSelection.full_name;
		emit('update:fields', updatedFields);
	} else {
		console.error('Geocoding error:', res.message);
		toast.add({
			title: 'Error',
			description: res.message || 'Failed to geocode selected location',
			color: 'error',
			duration: 3000
		});
	}
});

async function reverseGeocode(lat: number, lng: number) {
	const res = await reverseGeocodeFromComposable(lat, lng);

	if (res.success && 'data' in res && res.data) {
		// Update fields with address
		const updatedFields = { ...(props.fields || {}) };
		updatedFields['address'] = res.data.address;
		emit('update:fields', updatedFields);

		// Update selection display
		selection.value = {
			label: res.data.address,
			subtitle: undefined,
			latitude: lat,
			longitude: lng,
			full_name: res.data.address,
			types: []
		};
	} else {
		console.error('Reverse geocoding error:', res.message);
	}
}
</script>
