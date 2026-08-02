<template>
	<div
		role="status"
		aria-live="polite"
		class="flex flex-col items-center justify-center w-full h-full min-h-64 py-8"
	>
		<span class="sr-only">Loading</span>
		<div class="relative">
			<LazyNuxtImg
				src="/cloud.png"
				alt="Loading..."
				format="webp"
				class="w-32 h-32 object-contain"
				quality="70"
				crossorigin="anonymous"
				:preload="{ fetchPriority: 'high' }"
				hydrate-on-visible
			/>
			<UIcon
				name="mdi:loading"
				class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl text-muted animate-spin"
			/>
		</div>
	</div>
</template>
