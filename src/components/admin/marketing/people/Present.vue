<template>
	<Teleport to="body">
		<Transition name="present-fade">
			<div
				v-if="modelValue"
				class="present-backdrop fixed inset-0 z-9990 flex flex-col items-center justify-center gap-6 p-6 overflow-auto"
				role="dialog"
				aria-modal="true"
				:aria-label="label || 'Preview'"
			>
				<div class="absolute top-4 left-4 flex items-center gap-2">
					<UBadge
						color="primary"
						variant="subtle"
						icon="mdi:movie-open-play"
						>Preview Only</UBadge
					>
					<span
						v-if="label"
						class="text-sm text-muted"
						>{{ label }}</span
					>
				</div>
				<div class="absolute top-4 right-4 flex items-center gap-2">
					<AdminMarketingExportBar
						:target="previewEl"
						:filename="label || 'people-preview'"
					/>
					<UButton
						icon="mdi:close"
						color="neutral"
						variant="soft"
						aria-label="Exit Present Mode"
						@click="close"
						>Exit</UButton
					>
				</div>
				<div
					ref="previewEl"
					class="w-full max-w-2xl"
				>
					<slot />
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
	modelValue: boolean;
	label?: string;
}>();

const emit = defineEmits<{
	(event: 'update:modelValue', value: boolean): void;
}>();

const previewEl = ref<HTMLElement | null>(null);

const close = () => emit('update:modelValue', false);

const onKey = (e: KeyboardEvent) => {
	if (e.key === 'Escape') close();
};

watch(
	() => props.modelValue,
	(open) => {
		if (!import.meta.client) return;
		if (open) {
			document.addEventListener('keydown', onKey);
			document.body.style.overflow = 'hidden';
		} else {
			document.removeEventListener('keydown', onKey);
			document.body.style.overflow = '';
		}
	}
);

onBeforeUnmount(() => {
	if (!import.meta.client) return;
	document.removeEventListener('keydown', onKey);
	document.body.style.overflow = '';
});
</script>

<style scoped>
.present-backdrop {
	background: radial-gradient(circle at 50% 30%, rgba(30, 41, 59, 0.9), rgba(2, 6, 23, 0.98));
}

:root.light .present-backdrop {
	background: radial-gradient(
		circle at 50% 30%,
		rgba(241, 245, 249, 0.96),
		rgba(226, 232, 240, 0.99)
	);
}

.present-fade-enter-active,
.present-fade-leave-active {
	transition: opacity 200ms ease;
}

.present-fade-enter-from,
.present-fade-leave-to {
	opacity: 0;
}
</style>
