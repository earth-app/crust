<template>
	<div
		v-if="shouldShowIntention"
		class="w-full flex justify-center px-4 mt-4"
		:class="prefersReducedMotion ? '' : 'motion-preset-fade-md'"
	>
		<div
			class="relative w-full max-w-2xl rounded-xl border border-default bg-elevated/60 p-4 sm:p-5"
		>
			<UButton
				icon="mdi:close"
				color="neutral"
				variant="ghost"
				size="xs"
				class="absolute top-2 right-2"
				aria-label="Dismiss"
				@click="dismissIntention"
			/>

			<div class="flex items-center gap-2">
				<UIcon
					name="mdi:weather-sunny"
					class="size-5 text-amber-500"
				/>
				<h3 class="text-sm sm:text-base font-semibold">What Brings You Here Today?</h3>
			</div>
			<p class="mt-1 text-xs sm:text-sm text-muted">
				A quick intention keeps this time yours. No wrong answer.
			</p>

			<div class="mt-3 flex flex-wrap gap-2">
				<UButton
					v-for="option in intentions"
					:key="option.value"
					:icon="option.icon"
					color="neutral"
					variant="soft"
					size="sm"
					@click="choose(option.value)"
				>
					{{ option.label }}
				</UButton>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { SessionIntentionValue } from '~/composables/useSession';

const emit = defineEmits<{
	select: [value: SessionIntentionValue];
}>();

const { shouldShowIntention, intentions, setIntention, dismissIntention } = useSessionIntention();
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

function choose(value: SessionIntentionValue) {
	setIntention(value);
	emit('select', value);
}
</script>
