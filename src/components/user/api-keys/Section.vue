<template>
	<section
		id="api-keys"
		class="flex flex-col items-center w-full max-w-4xl"
	>
		<h3 class="text-2xl font-semibold text-gray-200 light:text-gray-600 mt-8">API Keys</h3>
		<div class="text-sm opacity-80 text-center max-w-2xl mb-4">
			API keys let scripts and tools act on your behalf. Each key has a scoped permission set and an
			optional expiration. You can never view a key after it is generated.
		</div>

		<div
			class="flex flex-col px-4 pt-3 pb-2 border-t-4 border-black dark:border-white w-full max-w-4xl gap-3"
		>
			<div class="flex items-center justify-between flex-wrap gap-2">
				<div class="text-sm opacity-80">
					<span class="font-semibold">{{ active }}</span> active
					<span v-if="Number.isFinite(max)">
						/ {{ max >= Number.MAX_SAFE_INTEGER ? '∞' : max }} allowed
					</span>
				</div>
				<div class="flex items-center gap-2">
					<UButton
						v-if="keys.length > 0"
						icon="mdi:delete-sweep"
						color="error"
						variant="ghost"
						size="sm"
						@click="onRevokeAll"
					>
						Revoke All
					</UButton>
					<UButton
						icon="mdi:plus"
						color="primary"
						size="sm"
						:disabled="atLimit"
						@click="openCreate = true"
					>
						Generate Key
					</UButton>
				</div>
			</div>

			<div
				v-if="atLimit"
				class="text-xs text-amber-500"
			>
				You've reached the maximum number of active keys for your tier. Revoke one before creating
				another.
			</div>

			<div
				v-if="!emailVerified"
				class="text-xs text-amber-500 flex items-center gap-2"
			>
				<UIcon name="mdi:alert" />
				You need a verified email address before you can generate API keys.
			</div>

			<UserApiKeysList
				:keys="keys"
				@revoke="handleRevoke"
				@edit="onEdit"
			/>
		</div>

		<UserApiKeysCreateModal
			v-model:open="openCreate"
			:catalog="catalog"
			@created="onCreated"
		/>

		<UserApiKeysRevealModal
			v-model:open="openReveal"
			:created="newlyCreated"
		/>

		<UserApiKeysEditModal
			v-model:open="openEdit"
			:api-key="editing"
			:catalog="catalog"
		/>
	</section>
</template>

<script setup lang="ts">
import type { ApiKey, ApiKeyCreated } from 'types/apiKeys';

defineProps<{
	emailVerified?: boolean;
}>();

const { keys, active, max, fetchKeys, fetchCatalog, catalog, revokeKey, revokeAllKeys } =
	useApiKeys();
const toast = useToast();

const openCreate = ref(false);
const openReveal = ref(false);
const openEdit = ref(false);
const newlyCreated = ref<ApiKeyCreated | null>(null);
const editing = ref<ApiKey | null>(null);

const atLimit = computed(() => max.value !== Number.MAX_SAFE_INTEGER && active.value >= max.value);

onMounted(async () => {
	await Promise.allSettled([fetchKeys(), fetchCatalog()]);
});

function onCreated(key: ApiKeyCreated) {
	newlyCreated.value = key;
	openReveal.value = true;
}

function onEdit(key: ApiKey) {
	editing.value = key;
	openEdit.value = true;
}

async function handleRevoke(key: ApiKey) {
	const res = await revokeKey(key.id);
	if (res.success) {
		toast.add({
			title: 'API Key Revoked',
			description: `"${key.name}" can no longer authenticate requests. The key was created on ${new Date(key.created_at).toLocaleDateString()}.`,
			icon: 'mdi:shield-off',
			color: 'success',
			duration: 5000
		});
	} else {
		toast.add({
			title: 'Could Not Revoke API Key',
			description:
				res.error ?? 'The key may already be revoked or could not be reached. Try again.',
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 6000
		});
	}
}

async function onRevokeAll() {
	if (!confirm('Revoke every active API key? This cannot be undone.')) return;
	const res = await revokeAllKeys();
	if (res.success) {
		const n = res.data?.revoked ?? 0;
		toast.add({
			title: `Revoked ${n} API Key${n === 1 ? '' : 's'}`,
			description:
				n > 0
					? 'All active keys have been retired. Any scripts using them will start receiving 401 responses.'
					: 'There were no active keys to revoke.',
			icon: 'mdi:delete-sweep',
			color: n > 0 ? 'success' : 'neutral',
			duration: 5000
		});
	} else {
		toast.add({
			title: 'Could Not Revoke API Keys',
			description: res.error ?? 'A network or server error prevented the bulk revoke.',
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 6000
		});
	}
}
</script>
