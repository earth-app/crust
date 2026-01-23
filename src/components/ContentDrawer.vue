<template>
	<UDrawer
		should-scale-background
		set-background-color-on-scale
		:overlay="false"
		direction="left"
		inset
		v-model:open="open"
	>
		<template #content>
			<div class="flex flex-col items-center min-w-140 max-w-150 overflow-y-auto">
				<h2 class="text-2xl font-bold p-4">
					{{ title }}
				</h2>
				<UInput
					v-model="search"
					type="search"
					placeholder="Search..."
					class="mb-4 mx-4 w-11/12"
					icon="mdi:magnify"
				/>
				<div class="grid grid-cols-1 gap-4 w-full p-4">
					<slot :search="search" />
				</div>

				<div
					v-if="isLoading"
					class="text-center py-4"
				>
					<UIcon name="eos-icons:loading" />
				</div>

				<div
					ref="loadMoreRef"
					class="h-1"
				></div>
			</div>
		</template>
	</UDrawer>
</template>

<script setup lang="ts">
const props = defineProps<{
	title: string;
	isLoading?: boolean;
}>();

const emit = defineEmits<{
	(event: 'loadMore'): void;
}>();

const open = ref(false);
const search = ref('');
const loadMoreRef = ref<HTMLElement | null>(null);

let observer: IntersectionObserver | null = null;

watch(open, (isOpen) => {
	if (isOpen && loadMoreRef.value) {
		nextTick(() => {
			observer = new IntersectionObserver(
				(entries) => {
					if (entries[0]?.isIntersecting && props.isLoading !== true) {
						emit('loadMore');
					}
				},
				{ threshold: 0.1 }
			);
			if (loadMoreRef.value) {
				observer.observe(loadMoreRef.value);
			}
		});
	} else if (!isOpen && observer) {
		observer.disconnect();
		observer = null;
	}
});

onUnmounted(() => {
	if (observer) {
		observer.disconnect();
		observer = null;
	}
});

export interface ContentDrawerRef {
	open: () => void;
	close: () => void;
	search: Ref<string>;
}

defineExpose<ContentDrawerRef>({
	open: () => {
		open.value = true;
	},
	close: () => {
		open.value = false;
	},
	search: search
});
</script>
