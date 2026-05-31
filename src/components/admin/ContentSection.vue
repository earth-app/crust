<template>
	<div class="flex flex-col gap-3">
		<div class="flex items-start justify-between gap-3 flex-wrap">
			<div>
				<h2 class="text-xl font-semibold">Content Moderation</h2>
				<p class="text-sm text-muted mt-1">
					Browse and remove user-submitted content. Deletion is permanent.
				</p>
			</div>
			<USelect
				v-model="kind"
				:items="[
					{ label: 'Prompts', value: 'prompts', icon: 'mdi:comment-question' },
					{ label: 'Events', value: 'events', icon: 'mdi:calendar-star' },
					{ label: 'Articles', value: 'articles', icon: 'mdi:newspaper' }
				]"
				class="w-40"
			/>
		</div>

		<div class="flex gap-2">
			<UInput
				v-model="search"
				placeholder="Search..."
				icon="mdi:magnify"
				class="flex-1"
			/>
			<UButton
				color="primary"
				@click="load"
				:loading="loading"
				icon="mdi:reload"
				>Fetch</UButton
			>
		</div>

		<div class="rounded-lg border border-default divide-y divide-default max-h-96 overflow-y-auto">
			<div
				v-if="!loading && items.length === 0"
				class="p-4 text-center text-sm text-muted"
			>
				Nothing here. Try a different search.
			</div>
			<div
				v-for="item in items"
				:key="item.id"
				class="flex items-center justify-between gap-3 px-3 py-2"
			>
				<NuxtLink
					:to="`/${kind}/${item.id}`"
					class="flex items-center gap-2 min-w-0 flex-1 hover:underline"
					target="_blank"
				>
					<UAvatar
						v-if="getOwnerAvatar(item)"
						:src="getOwnerAvatar(item) || undefined"
						size="sm"
					/>
					<div class="min-w-0">
						<p class="font-medium truncate">{{ getTitle(item) }}</p>
						<p
							v-if="getOwnerUsername(item)"
							class="text-xs text-muted"
						>
							@{{ getOwnerUsername(item) }}
						</p>
					</div>
				</NuxtLink>
				<UButton
					size="xs"
					color="error"
					variant="soft"
					icon="mdi:delete-outline"
					:loading="busy[item.id] === true"
					@click="del(item)"
					>Delete</UButton
				>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
type AnyItem = {
	id: string;
	prompt?: string;
	title?: string;
	name?: string;
	owner?: { account?: { avatar_url?: string; username?: string }; username?: string };
	author?: { account?: { avatar_url?: string; username?: string }; username?: string };
	host?: { account?: { avatar_url?: string; username?: string }; username?: string };
};

const props = withDefaults(defineProps<{ kind?: 'prompts' | 'events' | 'articles' }>(), {
	kind: 'prompts'
});

const kind = ref<'prompts' | 'events' | 'articles'>(props.kind);
const search = ref('');
const items = ref<AnyItem[]>([]);
const loading = ref(false);
const busy = reactive<Record<string, boolean>>({});
const authStore = useAuthStore();
const toast = useToast();

watch(kind, () => {
	items.value = [];
});

async function load() {
	loading.value = true;
	try {
		if (kind.value === 'prompts') {
			const { fetchAll } = usePrompts();
			const res = await fetchAll(50, search.value);
			if (res.data) items.value = res.data as any;
		} else if (kind.value === 'events') {
			const { fetchAll } = useEvents();
			const res = await fetchAll(50, search.value);
			if (res.data) items.value = res.data as any;
		} else if (kind.value === 'articles') {
			const { fetchAll } = useArticles();
			const res = await fetchAll(50, search.value);
			if (res.data) items.value = res.data as any;
		}
	} finally {
		loading.value = false;
	}
}

function getTitle(item: AnyItem): string {
	return item.prompt || item.title || item.name || item.id;
}

function getOwnerUsername(item: AnyItem): string | undefined {
	return (
		item.owner?.username ||
		item.owner?.account?.username ||
		item.author?.username ||
		item.author?.account?.username ||
		item.host?.username ||
		item.host?.account?.username
	);
}

function getOwnerAvatar(item: AnyItem): string | undefined {
	return (
		item.owner?.account?.avatar_url ||
		item.author?.account?.avatar_url ||
		item.host?.account?.avatar_url
	);
}

async function del(item: AnyItem) {
	if (!confirm(`Permanently delete this ${kind.value.slice(0, -1)}?`)) return;
	busy[item.id] = true;
	try {
		const path =
			kind.value === 'prompts'
				? `/v2/prompts/${item.id}`
				: kind.value === 'events'
					? `/v2/events/${item.id}`
					: `/v2/articles/${item.id}`;
		const res = await makeClientAPIRequest<void>(path, authStore.sessionToken, {
			method: 'DELETE'
		});
		if (res.success) {
			items.value = items.value.filter((x) => x.id !== item.id);
			toast.add({
				title: 'Deleted',
				description: getTitle(item),
				color: 'success',
				icon: 'mdi:delete-outline',
				duration: 2500
			});
		} else {
			toast.add({
				title: 'Failed',
				description: res.message || 'Unknown error',
				color: 'error',
				icon: 'mdi:alert-circle',
				duration: 4000
			});
		}
	} finally {
		busy[item.id] = false;
	}
}

onMounted(load);
</script>
