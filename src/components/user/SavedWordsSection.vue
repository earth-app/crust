<template>
	<div
		id="saved-words"
		class="flex flex-col w-full max-w-3xl mx-auto items-center mb-8"
	>
		<USeparator class="my-4" />
		<div class="flex items-center justify-between w-full mb-2">
			<h2 class="text-xl font-medium flex items-center gap-2">
				<UIcon
					name="mdi:book-alphabet"
					class="size-5 text-info"
				/>
				My Words
			</h2>
			<UButton
				v-if="list.length > 0"
				color="error"
				variant="ghost"
				size="sm"
				icon="mdi:delete-sweep"
				@click="confirmClear"
			>
				Clear
			</UButton>
		</div>

		<p class="text-sm opacity-70 mb-3 text-center">
			Words you've saved from Word of the Day. Stored on this device, up to {{ cap }} entries.
		</p>

		<div
			v-if="list.length === 0"
			class="w-full rounded-xl border border-black/20 dark:border-white/10 px-6 py-10 text-center"
		>
			<UIcon
				name="mdi:bookmark-outline"
				class="size-10 text-muted mb-2"
			/>
			<p class="text-sm font-medium m-0">No saved words yet</p>
			<p class="text-xs opacity-70 mt-1">
				Tap Save Word on a Word of the Day card and it will appear here.
			</p>
		</div>

		<ul
			v-else
			class="w-full flex flex-col gap-2"
		>
			<li
				v-for="word in list"
				:key="word.word"
				class="flex items-start justify-between gap-3 rounded-lg border border-black/10 dark:border-white/10 px-3 py-2"
			>
				<div class="flex flex-col min-w-0">
					<div class="flex items-baseline gap-2 flex-wrap">
						<span class="text-base font-semibold">{{ word.word }}</span>
						<span class="text-xs italic opacity-70">{{ word.partOfSpeech }}</span>
						<span
							v-if="word.savedAt"
							class="text-[10px] uppercase tracking-wide opacity-50"
							>{{ formatSavedAt(word.savedAt) }}</span
						>
					</div>
					<p class="text-sm opacity-90 m-0 mt-1 break-words">{{ word.definition }}</p>
				</div>
				<UButton
					color="error"
					variant="ghost"
					size="sm"
					icon="mdi:bookmark-off-outline"
					aria-label="Remove saved word"
					@click="remove(word.word)"
				/>
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';

const { list, remove, clearAll, cap } = useSavedWords();
const toast = useToast();

function formatSavedAt(ts: number): string {
	return DateTime.fromMillis(ts).toRelative({ style: 'short' }) ?? '';
}

function confirmClear() {
	if (!window.confirm('Clear all saved words? This only affects this device.')) return;
	clearAll();
	toast.add({
		title: 'Saved words cleared',
		icon: 'mdi:check',
		color: 'success',
		duration: 3000
	});
}
</script>
