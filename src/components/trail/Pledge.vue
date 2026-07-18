<template>
	<div class="flex flex-col gap-4 p-4 rounded-xl border border-primary/30 bg-primary/5 my-3">
		<div class="flex items-start gap-3">
			<UIcon
				name="mdi:hand-heart-outline"
				class="size-8 text-primary shrink-0 mt-0.5"
			/>
			<div class="flex flex-col">
				<h3 class="font-semibold text-base">Make Your Pledge</h3>
				<p class="text-sm opacity-80">
					An if-then plan makes you far more likely to follow through. Set your trigger and this
					trail becomes a promise to yourself.
				</p>
			</div>
		</div>

		<div class="flex flex-col gap-3">
			<label class="flex flex-col gap-1">
				<span class="text-sm font-medium">When</span>
				<UInput
					v-model="whenText"
					placeholder="I finish my morning coffee"
					icon="mdi:clock-outline"
					:maxlength="120"
					size="lg"
				/>
			</label>
			<label class="flex flex-col gap-1">
				<span class="text-sm font-medium">Where <span class="opacity-50">(Optional)</span></span>
				<UInput
					v-model="whereText"
					placeholder="the park by my house"
					icon="mdi:map-marker-outline"
					:maxlength="120"
					size="lg"
				/>
			</label>

			<p
				v-if="whenText.trim()"
				class="text-sm italic opacity-80"
			>
				“When {{ whenText.trim()
				}}<template v-if="whereText.trim()"> at {{ whereText.trim() }}</template
				>, I'll set out on {{ trailTitle }}.”
			</p>
		</div>

		<UButton
			color="primary"
			size="lg"
			block
			icon="mdi:map-marker-path"
			:disabled="!whenText.trim()"
			@click="submit"
			>Accept &amp; Begin</UButton
		>
	</div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ trailTitle?: string }>(), { trailTitle: 'this trail' });

const emit = defineEmits<{
	accept: [pledge: { when: string; where?: string }];
}>();

const whenText = ref('');
const whereText = ref('');

function submit() {
	const when = whenText.value.trim();
	if (!when) return;
	const where = whereText.value.trim();
	emit('accept', { when, ...(where ? { where } : {}) });
}
</script>
