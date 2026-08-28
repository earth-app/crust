<template>
	<UCard
		v-if="memories.length > 0"
		id="user-memories"
		variant="soft"
		class="relative w-full max-w-2xl mx-4 overflow-hidden bg-linear-to-br from-secondary/10 via-primary/5 to-transparent"
	>
		<div class="flex items-center gap-2 mb-1">
			<UIcon
				name="mdi:calendar-heart"
				class="size-6 text-secondary"
			/>
			<h3 class="text-lg font-semibold">On This Day</h3>
		</div>
		<p class="text-sm text-muted mb-3">You were out doing this on the same day, an earlier year.</p>

		<img
			v-if="photo"
			id="memory-photo"
			:src="photo"
			alt="A photo you took on this day"
			class="w-full max-h-64 object-cover rounded-lg border border-default mb-3"
		/>

		<ul class="flex flex-col gap-2">
			<li
				v-for="memory in memories"
				:key="`${memory.kind}-${memory.id}-${memory.completedAt}`"
				class="flex items-start gap-3 p-3 rounded-lg bg-default border border-default"
			>
				<UIcon
					:name="memory.icon || fallbackIcon(memory)"
					class="size-5 shrink-0 mt-0.5 text-muted"
				/>
				<div class="min-w-0">
					<p class="text-sm font-medium wrap-break-word">{{ memory.title }}</p>
					<p class="text-xs text-muted">{{ yearsLabel(memory.yearsAgo) }}</p>
					<p
						v-if="memory.note"
						class="text-xs text-muted italic wrap-break-word mt-1"
					>
						{{ memory.note }}
					</p>
				</div>
			</li>
		</ul>
	</UCard>
</template>

<script setup lang="ts">
import type { Memory } from 'types/memories';

const { list } = useMemories();
const authStore = useAuthStore();
const userStore = useUserStore();

const memories = ref<Memory[]>([]);
const photo = ref('');

function yearsLabel(years: number): string {
	return years === 1 ? '1 Year Ago Today' : `${years} Years Ago Today`;
}

function fallbackIcon(memory: Memory): string {
	return memory.kind === 'trail' ? 'mdi:map-marker-path' : 'mdi:sword-cross';
}

// the photo is whatever the existing quest history endpoint already serves; nothing new stores it
async function loadPhoto() {
	const uid = authStore.currentUser?.id;
	const kept = memories.value.find((memory) => memory.kind === 'quest' && memory.photo);
	if (!uid || !kept) return;

	// one thumbnail is all this tile shows; the full entry inlines every image step as base64
	const entry = await userStore.fetchQuestHistoryEntry(uid, kept.id, { firstImageOnly: true });
	const flat = (entry?.progress ?? []).flat();
	photo.value = flat.find((step) => step?.data?.startsWith('data:image'))?.data ?? '';
}

onMounted(async () => {
	try {
		const res = await list();
		if (!valid(res) || !res.data.memories?.length) return;

		memories.value = res.data.memories;
		await loadPhoto();
	} catch {
		// a surface you find: if it cannot load, it is simply not there
	}
});
</script>
