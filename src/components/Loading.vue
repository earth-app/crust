<template>
	<div class="flex flex-col items-center justify-center w-full h-full min-h-64 py-8">
		<div class="relative">
			<NuxtImg
				src="/cloud.png"
				alt="Loading..."
				format="webp"
				class="w-32 h-32 object-contain"
				quality="70"
				crossorigin="anonymous"
				:preload="{ fetchPriority: 'high' }"
			/>
			<UIcon
				name="mdi:loading"
				class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl text-black animate-spin"
			/>
		</div>
	</div>
</template>
