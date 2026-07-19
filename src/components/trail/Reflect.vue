<template>
	<div class="flex flex-col gap-5 py-6 px-4 max-w-xl mx-auto">
		<div class="flex flex-col items-center text-center gap-2">
			<div class="flex items-center justify-center size-14 rounded-full bg-primary/10 text-primary">
				<UIcon
					name="mdi:book-heart-outline"
					class="size-8"
				/>
			</div>
			<h2 class="text-lg font-semibold">A Moment to Reflect</h2>
			<p class="text-base opacity-90 wrap-break-word">{{ reflectionPrompt }}</p>
			<span class="text-xs opacity-60">Just for you. Your journal is private.</span>
		</div>

		<UTextarea
			v-model="note"
			:rows="4"
			:maxlength="600"
			autoresize
			placeholder="A few words on what you noticed..."
			class="w-full"
		/>

		<div class="flex flex-col gap-2">
			<span class="text-sm font-medium">How Did It Feel?</span>
			<div class="flex flex-wrap gap-2">
				<UButton
					v-for="m in moods"
					:key="m.mood"
					:color="mood === m.mood ? 'primary' : 'neutral'"
					:variant="mood === m.mood ? 'solid' : 'soft'"
					size="sm"
					:icon="m.icon"
					@click="mood = mood === m.mood ? undefined : m.mood"
					>{{ m.label }}</UButton
				>
			</div>
		</div>

		<label
			class="flex items-center justify-between gap-3 rounded-lg border border-default px-3 py-2"
		>
			<span class="flex flex-col">
				<span class="text-sm font-medium">Grow My Shared Garden</span>
				<span class="text-xs opacity-60">Add this time to the garden you share with friends</span>
			</span>
			<USwitch v-model="shareToGarden" />
		</label>

		<div class="flex items-center justify-between gap-2">
			<UButton
				variant="ghost"
				color="neutral"
				@click="save(true)"
				>Skip for Now</UButton
			>
			<UButton
				color="primary"
				icon="mdi:check"
				@click="save(false)"
				>Save Reflection</UButton
			>
		</div>
	</div>
</template>

<script setup lang="ts">
const props = defineProps<{
	reflectionPrompt: string;
	practice: TrailPractice;
	photoCount?: number;
}>();

const emit = defineEmits<{
	save: [reflection: TrailReflection];
}>();

const moods = computed(() => TRAIL_MOODS.map((m) => trailMoodMeta(m)!).filter(Boolean));

const note = ref('');
const mood = ref<TrailMood | undefined>(undefined);
const shareToGarden = ref(true);

function save(skip: boolean) {
	const reflection: TrailReflection = {
		at: new Date().toISOString(),
		sharedToGarden: shareToGarden.value,
		...(props.photoCount ? { photoCount: props.photoCount } : {})
	};
	if (!skip) {
		const trimmed = note.value.trim();
		if (trimmed) reflection.note = trimmed;
		if (mood.value) reflection.mood = mood.value;
	}
	emit('save', reflection);
}
</script>
