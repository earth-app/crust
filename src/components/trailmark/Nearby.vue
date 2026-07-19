<template>
	<div class="flex flex-col gap-5 w-full">
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
			<div class="flex flex-col">
				<h2 class="text-xl font-semibold">Trailmarks Nearby</h2>
				<p class="text-sm opacity-70">Short, kind notes left by people who stood where you are.</p>
			</div>
			<div class="flex items-center gap-2">
				<span class="text-xs opacity-60">Within</span>
				<USelect
					v-model="radius"
					:items="radiusOptions"
					size="sm"
					class="w-28"
				/>
			</div>
		</div>

		<TrailmarkComposer @created="onCreated" />

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
});
</script>
