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
				<LazyUInput
					v-model="search"
					type="search"
					placeholder="Search..."
					class="mb-4 mx-4 w-11/12"
					icon="mdi:magnify"
					hydrate-on-interaction
				/>
				<div class="grid grid-cols-1 gap-4 w-full p-4">
					<slot :search="search" />
				</div>

				<div
					v-if="isLoading"
					class="flex justify-center py-4"
				>
					<Loading />
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
let emitLoadMoreRaf: number | null = null;

const queueLoadMoreEmit = () => {
	if (!import.meta.client) return;
	if (props.isLoading === true) return;
	if (emitLoadMoreRaf !== null) return;

	emitLoadMoreRaf = window.requestAnimationFrame(() => {
		emitLoadMoreRaf = null;
		if (props.isLoading === true) return;
		emit('loadMore');
	});
};

if (import.meta.client) {
	watch(open, (isOpen) => {
		if (isOpen && loadMoreRef.value) {
			nextTick(() => {
				observer = new IntersectionObserver(
					(entries) => {
						if (entries[0]?.isIntersecting) {
							queueLoadMoreEmit();
						}
					},
					{ rootMargin: '200px 0px 200px 0px', threshold: 0.01 }
				);
				if (loadMoreRef.value) {
					observer.observe(loadMoreRef.value);
				}
			});
		} else if (!isOpen && observer) {
			observer.disconnect();
			observer = null;
			if (emitLoadMoreRaf !== null) {
				window.cancelAnimationFrame(emitLoadMoreRaf);
				emitLoadMoreRaf = null;
			}
		}
	});
}

onUnmounted(() => {
	if (import.meta.client && emitLoadMoreRaf !== null) {
		window.cancelAnimationFrame(emitLoadMoreRaf);
		emitLoadMoreRaf = null;
	}

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
