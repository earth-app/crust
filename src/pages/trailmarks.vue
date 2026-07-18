<template>
	<div class="flex flex-col w-full max-w-3xl mx-auto px-4 mt-24 sm:mt-6 pb-16">
		<ClientOnly>
			<TrailmarkNearby />
			<template #fallback>
				<div class="flex flex-col items-center gap-2 py-16 opacity-70">
					<UIcon
						name="mdi:map-marker-radius-outline"
						class="size-8"
					/>
					<p class="text-sm">Loading Trailmarks...</p>
				</div>
			</template>
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
useSeoMeta({
	title: 'Trailmarks',
	description:
		'Leave a short, kind note at a place and discover the notes left by people who passed through before you.'
});
</script>
