<template>
	<div class="relative w-full">
		<!-- Command shield container -->
		<div
			v-if="activeCommand"
			class="flex items-center gap-2 mb-2"
		>
			<div
				class="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-md text-sm"
			>
				<span>{{ activeCommand.label }}</span>
				<button
					@click="clearActiveCommand"
					class="ml-1 text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100"
				>
					×
				</button>
			</div>
		</div>

		<UInput
			v-model="query"
			:placeholder="
				activeCommand
					? `Enter ${activeCommand.label.split(' ')[1] || 'query'}...`
					: 'Coming Soon...'
			"
			class="w-full"
			@focus="handleFocus"
			@blur="handleBlur"
			@keydown="handleKeydown"
			:ui="{ base: 'text-xs sm:text-sm', leadingIcon: 'size-4 sm:size-5' }"
			ref="inputRef"
			disabled
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
	type: 'action' | 'search';
	action: (query: string) => void;
}

// Active command state
const activeCommand = ref<Command | null>(null);

const commands = ref<Command[]>([
	{
		label: 'randomize',
		value: 'randomize',
		type: 'action',
		action: () => executeRandomize()
	},
	{
		label: 'search users',
		value: 'search_users',
		type: 'search',
		action: (query: string) => executeUserSearch(query)
	},
	{
		label: 'search articles',
		value: 'search_articles',
		type: 'search',
		action: (query: string) => executeArticleSearch(query)
	}
]);

const filteredCommands = computed(() => {
	// Don't show commands if one is already active
	if (activeCommand.value) return [];

	if (!query.value) return commands.value;
	return commands.value.filter((cmd) =>
		cmd.label.toLowerCase().includes(query.value.toLowerCase())
	);
});

// Reset selected index when filtered commands change
watch(filteredCommands, () => {
	selectedIndex.value = -1;
});

// Command execution functions
function executeRandomize() {
	console.log('Executing randomize command');
	// TODO: Implement random content generation
}

function executeUserSearch(queryText: string) {
	console.log('Searching users with query:', queryText);
	// TODO: Implement user search
}

function executeArticleSearch(queryText: string) {
	console.log('Searching articles with query:', queryText);
	// TODO: Implement article search
}

// Active command management
function setActiveCommand(command: Command) {
	activeCommand.value = command;
	query.value = '';
	showDropdown.value = false;
	selectedIndex.value = -1;
}

function clearActiveCommand() {
	activeCommand.value = null;
	query.value = '';
}

function selectCommand(item: Command) {
	if (item.type === 'action') {
		// Execute immediately for action commands
		item.action('');
		query.value = '';
		showDropdown.value = false;
		selectedIndex.value = -1;
	} else {
		// Create shield for search commands
		setActiveCommand(item);
	}
}

function handleFocus() {
	// Only show dropdown if no active command
	if (!activeCommand.value) {
		showDropdown.value = true;
		selectedIndex.value = -1;
	}
}

function handleKeydown(event: KeyboardEvent) {
	// Handle backspace to remove active command when input is empty
	if (event.key === 'Backspace' && activeCommand.value && !query.value) {
		event.preventDefault();
		clearActiveCommand();
		return;
	}

	// Handle enter to execute search command with query
	if (event.key === 'Enter' && activeCommand.value && activeCommand.value.type === 'search') {
		event.preventDefault();
		activeCommand.value.action(query.value);
		clearActiveCommand();
		return;
	}

	// Handle escape to clear active command or close dropdown
	if (event.key === 'Escape') {
		event.preventDefault();
		if (activeCommand.value) {
			clearActiveCommand();
		} else {
			showDropdown.value = false;
			selectedIndex.value = -1;
		}
		return;
	}

	// Regular dropdown navigation (only when no active command)
	if (!activeCommand.value && showDropdown.value && filteredCommands.value.length > 0) {
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
		}
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
