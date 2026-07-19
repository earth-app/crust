<template>
	<div class="relative flex flex-col items-center text-center gap-5 py-8 px-4 max-w-xl mx-auto">
		<UiSparkleBurst
			:trigger="burst"
			:count="36"
			color="warning"
		/>

		<div
			class="flex items-center justify-center size-16 rounded-full bg-warning/10 text-warning transition-all duration-500 ease-out motion-reduce:transition-none"
			:class="shown ? 'scale-100 opacity-100' : 'scale-75 opacity-0'"
		>
			<UIcon
				name="mdi:white-balance-sunny"
				class="size-9"
			/>
		</div>

		<div class="flex flex-col gap-2">
			<h2 class="text-lg font-semibold">A Small Wonder</h2>
			<p class="text-base opacity-90 wrap-break-word whitespace-pre-line">{{ reveal }}</p>
		</div>

		<div
			v-if="minutes > 0"
			class="flex items-center gap-2 text-sm text-success"
		>
			<UIcon
				name="mdi:leaf"
				class="size-4"
			/>
			<span>+{{ minutes }} Nature Minutes, just for being out there</span>
		</div>

		<div
			v-if="personalBest"
			class="flex items-center gap-2 text-sm text-primary"
		>
			<UIcon
				name="mdi:trophy-outline"
				class="size-4"
			/>
			<span>Your Longest Week Outside Yet</span>
		</div>

		<UButton
			color="success"
			size="lg"
			icon="mdi:flag-checkered"
			class="mt-1"
			@click="emit('finish')"
			>Finish</UButton
		>
	</div>
</template>

<script setup lang="ts">
withDefaults(
	defineProps<{
		reveal: string;
		minutes?: number;
		personalBest?: boolean;
	}>(),
	{ minutes: 0, personalBest: false }
);

const emit = defineEmits<{
	finish: [];
}>();

const burst = ref(0);
const shown = ref(false);
onMounted(() => {
	burst.value++;
	requestAnimationFrame(() => {
		shown.value = true;
	});
});
</script>
