<template>
	<div class="relative min-w-30 w-full max-w-120">
		<UInput
			v-model="query"
			placeholder="Discover..."
			class="w-full"
			@focus="handleFocus"
			@blur="handleBlur"
			@keydown="handleKeydown"
			ref="inputRef"
			icon="mdi:compass-outline"
		/>

		<transition name="fade">
			<div
				v-if="showDropdown && filteredCommands.length > 0"
				class="absolute w-full z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto"
				ref="dropdownRef"
			>
				<div
					v-for="(command, index) in filteredCommands"
					:key="command.value"
					class="px-3 py-2 cursor-pointer text-sm transition-colors"
					:class="{
						'bg-gray-100 dark:bg-gray-700': index === selectedIndex,
						'hover:bg-gray-50 dark:hover:bg-gray-600': index !== selectedIndex
					}"
					@click="selectCommand(command)"
					@mouseenter="selectedIndex = index"
				>
					{{ command.label }}
				</div>
			</div>
		</transition>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

const query = ref('');
const showDropdown = ref(false);
const selectedIndex = ref(-1);

interface Command {
	label: string;
	value: string;
}

const commands = ref<Command[]>([]);

const filteredCommands = computed(() => {
	if (!query.value) return commands.value;
	return commands.value.filter((cmd) =>
		cmd.label.toLowerCase().includes(query.value.toLowerCase())
	);
});

// Reset selected index when filtered commands change
watch(filteredCommands, () => {
	selectedIndex.value = -1;
});

function selectCommand(item: Command) {
	query.value = item.label;
	showDropdown.value = false;
	selectedIndex.value = -1;
}

function handleFocus() {
	showDropdown.value = true;
	selectedIndex.value = -1;
}

function handleKeydown(event: KeyboardEvent) {
	if (!showDropdown.value || filteredCommands.value.length === 0) return;

	switch (event.key) {
		case 'ArrowDown':
			event.preventDefault();
			selectedIndex.value = Math.min(selectedIndex.value + 1, filteredCommands.value.length - 1);
			break;
		case 'ArrowUp':
			event.preventDefault();
			selectedIndex.value = Math.max(selectedIndex.value - 1, -1);
			break;
		case 'Enter':
			event.preventDefault();
			if (selectedIndex.value >= 0 && selectedIndex.value < filteredCommands.value.length) {
				const selectedCommand = filteredCommands.value[selectedIndex.value];
				if (selectedCommand) {
					selectCommand(selectedCommand);
				}
			}
			break;
		case 'Escape':
			event.preventDefault();
			showDropdown.value = false;
			selectedIndex.value = -1;
			break;
	}
}

const inputRef = ref();
const dropdownRef = ref();
let blurTimeoutId: ReturnType<typeof setTimeout> | null = null;

function handleBlur(event: FocusEvent) {
	// Check if the focus is moving to the dropdown
	blurTimeoutId = setTimeout(() => {
		const relatedTarget = event.relatedTarget as HTMLElement;
		if (dropdownRef.value && relatedTarget && dropdownRef.value.contains(relatedTarget)) {
			return; // Don't hide dropdown if focus is moving to dropdown
		}
		showDropdown.value = false;
		selectedIndex.value = -1;
	}, 150);
}

function handleClickOutside(event: MouseEvent) {
	const target = event.target as HTMLElement;
	if (
		inputRef.value &&
		dropdownRef.value &&
		!inputRef.value.$el.contains(target) &&
		!dropdownRef.value.contains(target)
	) {
		showDropdown.value = false;
		selectedIndex.value = -1;
	}
}

onMounted(() => {
	document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
	document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}
</style>
