<template>
	<span class="relative inline-flex">
		<UButton
			:color="isThanked ? 'success' : 'primary'"
			:variant="isThanked ? 'soft' : 'outline'"
			size="sm"
			:icon="isThanked ? 'mdi:hand-heart' : 'mdi:hand-heart-outline'"
			:disabled="isThanked || busy"
			:loading="busy"
			@click="onThank"
			>{{ isThanked ? 'Thanked' : 'Thank This Note' }}</UButton
		>
		<UiSparkleBurst
			:trigger="burst"
			:count="18"
			color="success"
		/>
	</span>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ id: string; thanked?: boolean }>(), { thanked: false });

const emit = defineEmits<{
	thanked: [];
}>();

const { thank, hasThanked } = useTrailmarks();
const toast = useToast();

const isThanked = ref(props.thanked || hasThanked(props.id));
const busy = ref(false);
const burst = ref(0);

async function onThank() {
	if (isThanked.value || busy.value) return;
	busy.value = true;
	try {
		const res = await thank(props.id);
		if (res.success) {
			isThanked.value = true;
			burst.value++;
			emit('thanked');
			toast.add({
				title: res.alreadyThanked ? 'Already Thanked' : 'Thanks Sent',
				description: res.alreadyThanked
					? 'You have already thanked this note.'
					: 'Your quiet appreciation reached the author.',
				icon: 'mdi:hand-heart',
				color: 'success',
				duration: 3000
			});
		} else {
			toast.add({
				title: 'Could Not Send Thanks',
				description: res.error,
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 4000
			});
		}
	} finally {
		busy.value = false;
	}
}

watch(
	() => props.thanked,
	(t) => {
		if (t) isThanked.value = true;
	}
);
</script>
