<template>
	<div
		class="cursor-pointer space-y-1"
		@click="startEditing"
	>
		<template v-if="!editing">
			<span :class="['text-gray-800 dark:text-white', props.class]">
				{{ props.modelValue || props.placeholder || '—' }}
			</span>
			<UIcon
				name="mdi:pencil-outline"
				size="16"
			/>
		</template>
		<template v-else>
			<UInput
				v-model="localValue"
				:type="props.type"
				:size="props.size"
				autofocus
				ref="inputRef"
				:class="props.inputClass"
				:loading="loading"
				@blur="finishEditing"
				@keyup.enter="finishEditing"
				@keyup.esc="cancelEditing"
			/>
		</template>
	</div>
</template>

<script setup lang="ts">
import { UInput } from '#components';
import { ref, watch, type InputTypeHTMLAttribute } from 'vue';

const props = withDefaults(
	defineProps<{
		modelValue: string | number;
		type?: InputTypeHTMLAttribute;
		placeholder?: string;
		disabled?: boolean;
		size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
		class?: string;
		inputClass?: string;
		onFinish?: (value: string | number) => boolean | string | Promise<string | boolean>;
	}>(),
	{
		modelValue: ''
	}
);

const emit = defineEmits<{
	(e: 'update:modelValue', value: string | number): void;
	(e: 'edit-start'): void;
	(e: 'edit-end'): void;
}>();

const editing = ref(false);
const localValue = ref(props.modelValue);
const loading = ref(false);
const inputRef = ref<HTMLInputElement>();

watch(
	() => props.modelValue,
	(val) => {
		if (!editing.value) localValue.value = val;
	}
);

function startEditing() {
	if (props.disabled) return;
	editing.value = true;
	emit('edit-start');
}

async function finishEditing() {
	emit('update:modelValue', localValue.value);

	if (localValue.value === props.modelValue) {
		editing.value = false;
		emit('edit-end');
		return;
	}

	if (props.onFinish) {
		try {
			loading.value = true;
			const result = await props.onFinish(localValue.value);
			loading.value = false;

			if (result !== true) {
				const toast = useToast();
				toast.add({
					title: 'Error',
					description: 'Invalid value provided.',
					color: 'error',
					icon: 'mdi:alert-circle',
					duration: 3000
				});
			}
		} catch (err) {
			loading.value = false;
			console.error('Error updating value:', err);

			const toast = useToast();
			toast.add({
				title: 'Error',
				description: err instanceof Error ? err.message : 'An unexpected error occurred.',
				color: 'error',
				icon: 'mdi:alert-circle',
				duration: 3000
			});
		}
	}

	editing.value = false;
	emit('edit-end');
}

function cancelEditing() {
	localValue.value = props.modelValue;
	editing.value = false;
	emit('edit-end');
}
</script>
