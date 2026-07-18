<template>
	<div
		class="w-full flex justify-center px-4 my-10"
		:class="prefersReducedMotion ? '' : 'motion-preset-fade-lg'"
		role="status"
	>
		<div
			class="relative w-full max-w-md text-center rounded-2xl border border-emerald-200/70 dark:border-emerald-900/40 bg-linear-to-br from-emerald-50 via-white to-teal-50 dark:from-gray-900 dark:via-gray-900 dark:to-emerald-950/30 p-6 shadow-sm"
		>
			<div
				class="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
			>
				<UIcon
					:name="prefersReducedMotion ? 'mdi:check-circle-outline' : 'mdi:leaf'"
					class="size-7"
					:class="prefersReducedMotion ? '' : 'motion-preset-pop'"
				/>
			</div>

			<h3 class="text-lg font-semibold">You're All Caught Up</h3>
			<p class="mt-1 text-sm text-muted">
				A good stopping point. You've explored plenty for now, and the app will still be here later.
			</p>

			<div class="mt-5 flex flex-col gap-2">
				<UButton
					block
					color="primary"
					icon="mdi:pine-tree"
					to="/trails"
					@click="emit('go-outside')"
				>
					Take It Outside
				</UButton>
				<UButton
					block
					color="neutral"
					variant="soft"
					icon="mdi:calendar-heart"
					to="/profile"
				>
					See Your Week
				</UButton>
				<UButton
					block
					color="neutral"
					variant="ghost"
					size="sm"
					@click="emit('keep-browsing')"
				>
					Keep Browsing
				</UButton>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
const emit = defineEmits<{
	'keep-browsing': [];
	'go-outside': [];
}>();

const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
</script>
