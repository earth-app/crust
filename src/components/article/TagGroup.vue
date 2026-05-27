<template>
	<div ref="root">
		<LazyInfoCardGroup
			:title="`${capitalizeFully(tag.replace(/_/g, ' '))} Articles`"
			:description="`Explore articles related to the ${tag.replace(/_/g, ' ').toLowerCase()} tag`"
			icon="mdi:tag"
			hydrate-on-visible
		>
			<LazyArticleCard
				v-for="article in list.items"
				:key="article.id"
				:article="article"
				class="motion-preset-fade-md"
				hydrate-on-visible
			/>
			<LazyInfoCardSkeleton
				v-for="n in list.remaining"
				:key="`tag-skel-${tag}-${n}`"
				content-size="small"
				hydrate-on-visible
			/>
		</LazyInfoCardGroup>
	</div>
</template>

<script setup lang="ts">
import { capitalizeFully, valid } from 'utils';

const props = defineProps<{ tag: string }>();

const list = useIncrementalList<Article>({ staggerMs: 80, initialExpectedCount: 2 });
const root = ref<HTMLElement | null>(null);
let loaded = false;

function loadTag() {
	if (loaded) return;
	loaded = true;

	void list.load(async () => {
		const { fetchRandom } = useArticles();
		const res = await fetchRandom(15, undefined, props.tag);
		if (valid(res)) return res.data;
		console.error(`Failed to load articles for tag ${props.tag}:`, res.message);
		return null;
	});
}

const { stop } = useIntersectionObserver(
	root,
	(entries) => {
		if (entries[0]?.isIntersecting) {
			stop();
			loadTag();
		}
	},
	{ rootMargin: '300px' }
);
</script>
