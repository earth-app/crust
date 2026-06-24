<template>
	<div class="flex flex-col gap-1.5">
		<NuxtLink
			:to="href"
			class="text-xs font-mono text-blue-500 hover:underline self-start"
			>{{ label }}: {{ id }}</NuxtLink
		>
		<ArticleCard
			v-if="kind === 'article' && article"
			:article="article"
		/>
		<EventCard
			v-else-if="kind === 'event' && event"
			:event="event"
		/>
		<span
			v-else-if="absent"
			class="text-xs text-muted italic"
		>
			Content no longer available (auto-deleted) — the step remains recorded.
		</span>
	</div>
</template>

<script setup lang="ts">
const props = defineProps<{
	kind: 'article' | 'event';
	id: string;
}>();

const articleStore = useArticleStore();
const eventStore = useEventStore();

// stores expose a three-state get (undefined = unloaded, null = confirmed gone, value = loaded)
const article = computed(() => (props.kind === 'article' ? articleStore.get(props.id) : undefined));
const event = computed(() => (props.kind === 'event' ? eventStore.get(props.id) : undefined));

const tried = ref(false);
const absent = computed(() => tried.value && !article.value && !event.value);

const label = computed(() => (props.kind === 'article' ? 'Article' : 'Event'));
const href = computed(() =>
	props.kind === 'article' ? `/articles/${props.id}` : `/events/${props.id}`
);

onMounted(async () => {
	try {
		if (props.kind === 'article') await articleStore.fetchArticle(props.id);
		else await eventStore.fetchEvent(props.id);
	} finally {
		tried.value = true;
	}
});
</script>
