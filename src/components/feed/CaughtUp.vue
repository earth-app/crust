<template>
	<div
		class="w-full flex justify-center px-4 my-10"
		:class="prefersReducedMotion ? '' : 'motion-preset-fade-lg'"
		role="status"
	>
		<div
			class="relative w-full max-w-md text-center rounded-2xl border border-default bg-linear-to-br from-brand-50 via-default to-brand-100/60 dark:from-elevated dark:via-elevated dark:to-brand-950/30 p-6 shadow-sm"
		>
			<div
				class="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-success/10 e-text-brand"
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
