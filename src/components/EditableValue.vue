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
			<UAlert
				v-if="error"
				color="error"
				variant="subtle"
				icon="i-heroicons-exclamation-triangle"
				:title="error"
				class="text-sm"
			/>
		</template>
	</div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, type InputTypeHTMLAttribute } from 'vue';
import { UInput, UAlert } from '#components';

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
const error = ref<string | null>(null);
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
	error.value = null;
	emit('edit-start');
}

async function finishEditing() {
	emit('update:modelValue', localValue.value);

	if (localValue.value === props.modelValue) {
		editing.value = false;
		error.value = null;
		emit('edit-end');
		return;
	}

	if (props.onFinish) {
		loading.value = true;
		const result = await props.onFinish(localValue.value);
		loading.value = false;

		if (result !== true) {
			error.value = typeof result === 'string' ? result : 'Invalid input.';
			return;
		}
	}

	editing.value = false;
	error.value = null;
	emit('edit-end');
}

function cancelEditing() {
	localValue.value = props.modelValue;
	editing.value = false;
	error.value = null;
	emit('edit-end');
}
</script>
