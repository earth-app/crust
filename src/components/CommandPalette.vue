<template>
	<UModal
		v-model:open="paletteOpen"
		:dismissible="true"
		title="Command Palette"
		description="Jump to any page or search for content"
		:ui="{ content: 'sm:max-w-2xl' }"
	>
		<template #body>
			<div class="flex flex-col gap-3">
				<UInput
					ref="searchInput"
					v-model="query"
					autofocus
					placeholder="Type a page name, command, or content keyword…"
					icon="mdi:magnify"
					size="lg"
					class="w-full"
					@keydown.down.prevent="move(1)"
					@keydown.up.prevent="move(-1)"
					@keydown.enter.prevent="executeActive"
				/>
				<div
					class="max-h-96 overflow-y-auto -mx-2 px-2"
					role="listbox"
					aria-label="Command results"
				>
					<div
						v-if="filteredResults.length === 0"
						class="text-center text-sm text-muted py-6"
					>
						No matches. Try a page name or keyword.
					</div>
					<button
						v-for="(r, i) in filteredResults"
						:key="r.id"
						type="button"
						role="option"
						:aria-selected="i === active"
						class="w-full text-left flex items-center gap-3 px-3 py-2 rounded-md transition-colors"
						:class="
							i === active
								? 'bg-primary/15 text-primary'
								: 'hover:bg-elevated focus-visible:bg-elevated'
						"
						@click="execute(r)"
						@mouseenter="active = i"
					>
						<UIcon
							:name="r.icon"
							class="size-5 shrink-0"
						/>
						<div class="flex-1 min-w-0">
							<p class="text-sm font-medium truncate">{{ r.label }}</p>
							<p
								v-if="r.hint"
								class="text-xs text-muted truncate"
							>
								{{ r.hint }}
							</p>
						</div>
						<kbd
							v-if="r.shortcut"
							class="text-[10px] font-mono uppercase text-muted border border-default rounded px-1.5 py-0.5"
							>{{ r.shortcut }}</kbd
						>
					</button>
				</div>
				<div class="flex justify-between items-center text-xs text-muted px-1">
					<span>
						<kbd class="font-mono">↑↓</kbd> navigate · <kbd class="font-mono">↵</kbd> select ·
						<kbd class="font-mono">esc</kbd> close
					</span>
					<button
						type="button"
						class="text-primary hover:underline"
						@click="openHelp"
					>
						All shortcuts
					</button>
				</div>
			</div>
		</template>
	</UModal>

	<UModal
		v-model:open="helpOpen"
		title="Keyboard Shortcuts"
		description="Power-user navigation"
	>
		<template #body>
			<ul class="flex flex-col gap-2">
				<li
					v-for="s in shortcuts"
					:key="s.keys"
					class="flex items-center justify-between"
				>
					<span class="text-sm">{{ s.label }}</span>
					<kbd
						class="text-xs font-mono uppercase text-muted border border-default rounded px-2 py-0.5"
						>{{ s.keys }}</kbd
					>
				</li>
			</ul>
		</template>
	</UModal>
</template>

<script setup lang="ts">
import { initShortcuts, SHORTCUT_LIST, useShortcuts } from '~/composables/useShortcuts';

interface PaletteResult {
	id: string;
	label: string;
	icon: string;
	hint?: string;
	shortcut?: string;
	to?: string;
	action?: () => void;
}

const router = useRouter();
const { paletteOpen, helpOpen, closePalette, openHelp } = useShortcuts();
initShortcuts(router);

const query = ref('');
const active = ref(0);
const shortcuts = SHORTCUT_LIST;

// when the palette closes, reset query+active so the next open feels fresh
watch(paletteOpen, (open) => {
	if (!open) {
		query.value = '';
		active.value = 0;
	}
});

const STATIC_RESULTS: PaletteResult[] = [
	{ id: 'home', label: 'Home', icon: 'mdi:home', to: '/', shortcut: 'g h' },
	{
		id: 'activities',
		label: 'Activities',
		icon: 'mdi:run',
		to: '/activities',
		shortcut: 'g a'
	},
	{
		id: 'articles',
		label: 'Articles',
		icon: 'mdi:newspaper',
		to: '/articles',
		shortcut: 'g r'
	},
	{
		id: 'prompts',
		label: 'Prompts',
		icon: 'mdi:lightbulb-on-outline',
		to: '/prompts',
		shortcut: 'g p'
	},
	{ id: 'events', label: 'Events', icon: 'mdi:calendar-star', to: '/events', shortcut: 'g e' },
	{
		id: 'profile',
		label: 'Your Profile',
		icon: 'mdi:account-circle',
		to: '/profile',
		shortcut: 'g m'
	},
	{
		id: 'quests',
		label: 'Your Quests',
		icon: 'mdi:map-marker-path',
		to: '/profile/quests',
		shortcut: 'g q'
	},
	{
		id: 'notifications',
		label: 'Notifications',
		icon: 'mdi:bell',
		to: '/profile/notifications'
	},
	{ id: 'about', label: 'About', icon: 'mdi:information-outline', to: '/about' },
	{
		id: 'new-article',
		label: 'New Article',
		hint: 'Requires Writer plan or above',
		icon: 'mdi:pen-plus',
		to: '/articles/new'
	},
	{
		id: 'new-prompt',
		label: 'New Prompt',
		icon: 'mdi:lightbulb-plus-outline',
		to: '/prompts/new'
	},
	{
		id: 'help',
		label: 'Keyboard shortcuts',
		icon: 'mdi:keyboard-outline',
		shortcut: '?',
		action: () => {
			closePalette();
			openHelp();
		}
	}
];

const filteredResults = computed<PaletteResult[]>(() => {
	const q = query.value.trim().toLowerCase();
	if (!q) return STATIC_RESULTS;
	return STATIC_RESULTS.filter(
		(r) => r.label.toLowerCase().includes(q) || r.hint?.toLowerCase().includes(q)
	);
});

watch(filteredResults, () => {
	active.value = 0;
});

function move(delta: number) {
	const max = filteredResults.value.length - 1;
	if (max < 0) return;
	active.value = (active.value + delta + max + 1) % (max + 1);
}

function execute(result: PaletteResult) {
	closePalette();
	if (result.action) {
		result.action();
		return;
	}
	if (result.to) router.push(result.to);
}

function executeActive() {
	const target = filteredResults.value[active.value];
	if (target) execute(target);
}
</script>
