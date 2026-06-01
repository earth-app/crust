<template>
	<UModal
		v-model:open="open"
		:close="{ onClick: handleClose }"
		:dismissible="!submitting"
		class="sm:min-w-150 md:min-w-180"
	>
		<template #title>
			<div class="flex items-center">
				<UAvatar
					:src="avatar128"
					class="size-8 mr-2 rounded-full shadow-lg shadow-black/50"
				/>
				<span>Edit API Key</span>
			</div>
		</template>
		<template #body>
			<div class="flex flex-col gap-4 p-1">
				<div
					v-if="!apiKey"
					class="text-sm opacity-70"
				>
					No key selected.
				</div>

				<template v-else>
					<div class="flex flex-col gap-1">
						<label class="text-sm font-medium">Name</label>
						<UInput
							v-model="form.name"
							placeholder="e.g. CI deploy bot"
							:maxlength="catalog?.name.max ?? 64"
						/>
						<div class="text-xs opacity-70">
							{{ form.name.length }} / {{ catalog?.name.max ?? 64 }}
						</div>
					</div>

					<div class="flex flex-col gap-1">
						<label class="text-sm font-medium">Description (Optional)</label>
						<UTextarea
							v-model="form.description"
							placeholder="What this key is for. Visible only to you."
							:maxlength="catalog?.description.max ?? 512"
							:rows="2"
						/>
					</div>

					<div
						class="flex items-center gap-2 rounded bg-default/40 border border-default/60 p-2 text-xs opacity-80"
					>
						<UIcon name="mdi:information-outline" />
						Expiration cannot be changed in place. Generate a replacement key and revoke this one if
						you need to extend it.
					</div>

					<div class="flex flex-col gap-2">
						<UserApiKeysScopePicker
							v-model="form.scopes"
							:catalog="catalog"
						/>
					</div>

					<div
						v-if="!dirty"
						class="text-xs opacity-70"
					>
						No changes yet.
					</div>
				</template>
			</div>
		</template>

		<template #footer>
			<div class="flex justify-end gap-2 w-full">
				<UButton
					color="neutral"
					variant="ghost"
					:disabled="submitting"
					@click="handleClose"
				>
					Cancel
				</UButton>
				<UButton
					color="primary"
					icon="mdi:floppy"
					:loading="submitting"
					:disabled="!canSubmit"
					@click="submit"
				>
					Save Changes
				</UButton>
			</div>
		</template>
	</UModal>
</template>

<script setup lang="ts">
import type { ApiKey, ApiKeyScopeCatalog, ApiKeyScopeId } from 'types/apiKeys';

const { avatar128 } = useAuth();

const props = defineProps<{
	apiKey: ApiKey | null;
	catalog: ApiKeyScopeCatalog | null;
}>();

const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ (e: 'updated', key: ApiKey): void }>();

const submitting = ref(false);

interface FormState {
	name: string;
	description: string;
	scopes: ApiKeyScopeId[];
}

const form = ref<FormState>(blankForm());

function blankForm(): FormState {
	return { name: '', description: '', scopes: [] };
}

// reset form to the key's current values whenever we open the modal on a key
watch(
	() => [open.value, props.apiKey?.id] as const,
	([isOpen]) => {
		if (!isOpen || !props.apiKey) return;
		form.value = {
			name: props.apiKey.name,
			description: props.apiKey.description ?? '',
			scopes: [...props.apiKey.scopes]
		};
		submitting.value = false;
	},
	{ immediate: true }
);

const dirty = computed(() => {
	if (!props.apiKey) return false;
	if (form.value.name.trim() !== props.apiKey.name) return true;
	if ((form.value.description.trim() || '') !== (props.apiKey.description ?? '')) return true;
	const a = [...props.apiKey.scopes].sort().join(',');
	const b = [...form.value.scopes].sort().join(',');
	return a !== b;
});

const canSubmit = computed(() => {
	if (!props.apiKey) return false;
	const n = form.value.name.trim();
	if (n.length < (props.catalog?.name.min ?? 3) || n.length > (props.catalog?.name.max ?? 64)) {
		return false;
	}
	if (form.value.scopes.length === 0) return false;
	return dirty.value;
});

function handleClose() {
	if (submitting.value) return;
	open.value = false;
}

const toast = useToast();

async function submit() {
	if (!canSubmit.value || !props.apiKey) return;
	submitting.value = true;
	try {
		const { updateKey } = useApiKeys();
		const res = await updateKey(props.apiKey.id, {
			name: form.value.name.trim(),
			description: form.value.description.trim() || null,
			scopes: form.value.scopes
		});
		if (res.success && res.data) {
			toast.add({
				title: 'API Key Updated',
				description: `"${res.data.name}" now has ${res.data.scopes.length} scope${res.data.scopes.length === 1 ? '' : 's'}. Active tokens pick up the new permissions on their next request.`,
				icon: 'mdi:key-change',
				color: 'success',
				duration: 5000
			});
			emit('updated', res.data);
			open.value = false;
		} else {
			toast.add({
				title: 'Could Not Update API Key',
				description:
					res.error ??
					'The change was rejected. Check the name and scopes; revoked keys cannot be edited.',
				icon: 'mdi:key-alert',
				color: 'error',
				duration: 6000
			});
		}
	} finally {
		submitting.value = false;
	}
}
</script>
