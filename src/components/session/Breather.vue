<template>
	<div
		v-if="shouldShowExitCue"
		class="w-full flex justify-center px-4 my-6"
		:class="prefersReducedMotion ? '' : 'motion-preset-fade-md'"
	>
		<div
			class="relative w-full max-w-2xl rounded-xl border border-teal-200/70 dark:border-teal-900/40 bg-linear-to-br from-teal-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-900 dark:to-teal-950/30 p-4 sm:p-5"
		>
			<UButton
				icon="mdi:close"
				color="neutral"
				variant="ghost"
				size="xs"
				class="absolute top-2 right-2"
				aria-label="Dismiss"
				@click="dismissExitCue"
			/>

			<div class="flex items-center gap-2">
				<UIcon
					name="mdi:walk"
					class="size-5 text-teal-600 dark:text-teal-300"
				/>
				<h3 class="text-sm sm:text-base font-semibold">Been Here a While?</h3>
			</div>
			<p class="mt-1 text-xs sm:text-sm text-muted">
				This is a good moment to step away. A Curiosity Trail can turn the next few minutes into
				time outside.
			</p>

			<div class="mt-3 flex flex-wrap gap-2">
				<UButton
					color="primary"
					variant="soft"
					size="sm"
					icon="mdi:map-marker-path"
					to="/trails"
					@click="dismissExitCue"
				>
					Find a Trail
				</UButton>
				<UButton
					color="neutral"
					variant="ghost"
					size="sm"
					@click="dismissExitCue"
				>
					Maybe Later
				</UButton>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
const { shouldShowExitCue, dismissExitCue } = useSessionIntention();
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
</script>
