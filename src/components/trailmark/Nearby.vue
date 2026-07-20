<template>
	<div class="flex flex-col gap-5 w-full">
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
			<div
				id="trailmark-nearby"
				class="flex flex-col"
			>
				<h2 class="text-xl font-semibold">Trailmarks Nearby</h2>
				<p class="text-sm opacity-70">Short, kind notes left by people who stood where you are.</p>
			</div>
			<div class="flex items-center gap-2">
				<div
					id="trailmark-radius"
					class="flex items-center gap-2"
				>
					<span class="text-xs opacity-60">Within</span>
					<USelect
						v-model="radius"
						:items="radiusOptions"
						size="sm"
						class="w-28"
					/>
				</div>
				<UButton
					icon="mdi:progress-question"
					color="neutral"
					variant="ghost"
					size="sm"
					aria-label="Replay Trailmarks Tour"
					@click="startTour('trailmarks')"
				/>
			</div>
		</div>

		<div id="trailmark-composer">
			<TrailmarkComposer @created="onCreated" />
		</div>

		<ClientOnly>
			<SiteTour
				:steps="trailmarksTour"
				tour-id="trailmarks"
				name="Trailmarks Tour"
				:pulse="true"
			/>
		</ClientOnly>

		<UAlert
			v-if="permView.blocked"
			color="warning"
			variant="subtle"
			:icon="permView.icon"
			:title="permView.label"
			:description="permView.description"
			:actions="[
				{
					label: 'Re-check Location',
					color: 'warning',
					variant: 'solid',
					icon: 'mdi:refresh',
					onClick: refreshLocation
				}
			]"
		/>

		<div
			v-else-if="!locationReady && !locationError"
			class="flex flex-col items-center gap-2 py-10 text-center opacity-70"
		>
			<UIcon
				name="mdi:crosshairs-gps"
				class="size-8 motion-safe:animate-pulse"
			/>
			<p class="text-sm">Finding Your Location...</p>
			<UButton
				variant="ghost"
				size="sm"
				color="neutral"
				icon="mdi:refresh"
				@click="refreshLocation"
				>Re-check Location</UButton
			>
		</div>

		<UAlert
			v-else-if="locationError"
			color="warning"
			variant="subtle"
			icon="mdi:map-marker-alert-outline"
			title="Location Needed"
			:description="locationError"
			:actions="[
				{
					label: 'Re-check Location',
					color: 'warning',
					variant: 'solid',
					icon: 'mdi:refresh',
					onClick: refreshLocation
				}
			]"
		/>

		<div
			v-else-if="loading && !nearby.length"
			class="flex flex-col gap-3"
		>
			<USkeleton
				v-for="n in 3"
				:key="n"
				class="h-28 rounded-xl"
			/>
		</div>

		<div
			v-else-if="nearby.length"
			class="flex flex-col gap-3"
		>
			<TrailmarkCard
				v-for="mark in nearby"
				:key="mark.id"
				:mark="mark"
				:distance-meters="distanceOf(mark)"
			/>
		</div>

		<div
			v-else
			class="flex flex-col items-center gap-2 py-12 text-center opacity-70"
		>
			<UIcon
				name="mdi:map-marker-off-outline"
				class="size-10"
			/>
			<p class="text-sm">No Notes Nearby Yet. Be the First to Leave One.</p>
		</div>
	</div>
</template>

<script setup lang="ts">
const { nearby, loading, fetchNearby } = useTrailmarks();
const { lat, lng, error: locationError, fetchLocation } = useQuestGeolocation();
const { state: permState, view: permView, recheck: recheckPermission } = useGeoPermission();
const { startTour, startTourIfNew } = useSiteTour();

// #region tour
const trailmarksTour = computed<SiteTourStep[]>(() => [
	{
		id: 'trailmark-nearby',
		title: 'Trailmarks Nearby',
		description:
			'Trailmarks are short, encouraging notes people leave at real places for whoever comes next. When one lifts you, you thank the note itself - never the person - so kindness stays quiet and pressure-free.',
		footer: 'A small message from a stranger who stood right where you are.',
		icon: 'mdi:map-marker-radius-outline',
		waitFor: 'trailmark-nearby'
	},
	{
		id: 'trailmark-composer',
		title: 'Leave One From Here',
		description:
			'Write a brief, kind note tied to the spot you are standing in right now. Someone passing through later will find it exactly where you left it.',
		footer: 'Keep it warm and welcoming - it is a gift to a stranger.',
		icon: 'mdi:map-marker-plus-outline',
		placement: 'bottom'
	},
	{
		id: 'trailmark-radius',
		title: 'Widen or Narrow Your Search',
		description:
			'Change how far out to look for notes. Tighten the radius for what is right around you, or widen it to discover marks a little further afield.',
		footer: 'Explore close by, then reach further when you wander.',
		icon: 'mdi:map-marker-distance'
	}
]);
// #endregion

const radiusOptions = [
	{ label: '250 m', value: 250 },
	{ label: '500 m', value: 500 },
	{ label: '1 km', value: 1000 },
	{ label: '2 km', value: 2000 }
];
const radius = ref(500);

const locationReady = computed(() => lat.value !== null && lng.value !== null);

function distanceOf(mark: Trailmark): number | undefined {
	if (lat.value === null || lng.value === null) return undefined;
	return trailmarkDistanceMeters({ lat: lat.value, lng: lng.value }, mark.geo);
}

async function load(force = false) {
	if (lat.value === null || lng.value === null) return;
	await fetchNearby({ lat: lat.value, lng: lng.value, radius: radius.value }, force);
}

function locate() {
	fetchLocation();
}

// re-read the live permission, then attempt a fix; works even without the Permissions
// API since getCurrentPosition itself triggers the browser prompt
async function refreshLocation() {
	await recheckPermission();
	locate();
}

function onCreated() {
	void load(true);
}

watch([lat, lng], () => void load());
watch(radius, () => void load(true));

// granting in the browser flips the permission live; grab a fix automatically once allowed
watch(permState, (s) => {
	if (s === 'granted' && !locationReady.value) locate();
});

onMounted(() => {
	fetchLocation();
	startTourIfNew('trailmarks');
});
</script>
