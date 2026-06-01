<template>
	<UModal
		v-model:open="open"
		title="Generate API Key"
		:close="{ onClick: handleClose }"
		:dismissible="!submitting"
		class="sm:min-w-150 md:min-w-180"
	>
		<template #body>
			<div class="flex flex-col gap-4 p-1">
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

				<div class="flex flex-col gap-1">
					<label class="text-sm font-medium">Expiration</label>
					<USelectMenu
						v-model="form.expiryPreset"
						:items="expiryOptions"
						label-key="label"
						value-key="value"
					/>
					<div
						v-if="form.expiryPreset === 'custom'"
						class="flex flex-col gap-1 mt-1"
					>
						<UInput
							v-model="customDateInput"
							type="date"
							:min="minDateInput"
						/>
						<div class="text-xs opacity-70">Choose a date up to 10 years from today.</div>
					</div>
					<div
						v-else-if="form.expiryPreset === 'never'"
						class="flex items-start gap-2 mt-1 rounded bg-amber-500/10 border border-amber-500/40 p-2"
					>
						<UIcon
							name="mdi:alert"
							class="text-amber-500 text-lg shrink-0"
						/>
						<div class="text-xs">
							No-expiration keys remain valid until you revoke them. Anyone with this token can act
							on your behalf indefinitely. Prefer a finite expiration.
						</div>
					</div>
					<div
						v-else
						class="text-xs opacity-70"
					>
						Expires {{ humanExpiry }}.
					</div>
				</div>

				<div class="flex flex-col gap-2">
					<UserApiKeysScopePicker
						v-model="form.scopes"
						:catalog="catalog"
					/>
				</div>
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
					:loading="submitting"
					:disabled="!canSubmit"
					@click="submit"
				>
					Generate Key
				</UButton>
			</div>
		</template>
	</UModal>
</template>

<script setup lang="ts">
import type {
	ApiKeyCreateInput,
	ApiKeyCreated,
	ApiKeyExpiryPresetKey,
	ApiKeyScopeCatalog
} from 'types/apiKeys';

const props = defineProps<{
	catalog: ApiKeyScopeCatalog | null;
}>();

const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ (e: 'created', key: ApiKeyCreated): void }>();

const submitting = ref(false);

interface FormState {
	name: string;
	description: string;
	scopes: string[];
	expiryPreset: ApiKeyExpiryPresetKey | 'custom';
}

const form = ref<FormState>(blankForm());
const customDateInput = ref('');

const minDateInput = computed(() => {
	const d = new Date();
	d.setDate(d.getDate() + 1);
	return d.toISOString().slice(0, 10);
});

function blankForm(): FormState {
	return {
		name: '',
		description: '',
		scopes: [],
		expiryPreset: '30d'
	};
}

watch(open, (isOpen) => {
	if (isOpen) {
		form.value = blankForm();
		customDateInput.value = '';
		submitting.value = false;
	}
});

const expiryOptions = computed(() => {
	const presets = props.catalog?.expiry_presets ?? {};
	const items: { label: string; value: FormState['expiryPreset'] }[] = [];
	for (const [k, v] of Object.entries(presets)) {
		items.push({ label: `${v.days} Days`, value: k as ApiKeyExpiryPresetKey });
	}
	items.push({ label: 'Custom Date…', value: 'custom' });
	items.push({ label: 'Never Expires (Warning)', value: 'never' });
	return items;
});

const humanExpiry = computed(() => {
	if (form.value.expiryPreset === 'never') return 'never';
	if (form.value.expiryPreset === 'custom') {
		return customDateInput.value ? `on ${customDateInput.value}` : '-';
	}
	const preset = props.catalog?.expiry_presets[form.value.expiryPreset];
	if (!preset) return '-';
	return `in ${preset.days} days`;
});

const canSubmit = computed(() => {
	const n = form.value.name.trim();
	if (n.length < (props.catalog?.name.min ?? 3) || n.length > (props.catalog?.name.max ?? 64)) {
		return false;
	}
	if (form.value.scopes.length === 0) return false;
	if (form.value.expiryPreset === 'custom' && !customDateInput.value) return false;
	return true;
});

function handleClose() {
	if (submitting.value) return;
	open.value = false;
}

const toast = useToast();

async function submit() {
	if (!canSubmit.value) return;
	submitting.value = true;
	try {
		const input: ApiKeyCreateInput = {
			name: form.value.name.trim(),
			description: form.value.description.trim() || null,
			scopes: form.value.scopes
		};

		if (form.value.expiryPreset === 'custom') {
			const ts = Math.floor(new Date(customDateInput.value).getTime() / 1000);
			input.expires_at = ts;
		} else {
			input.expiry_preset = form.value.expiryPreset;
		}

		const { createKey } = useApiKeys();
		const res = await createKey(input);
		if (res.success && res.data) {
			toast.add({
				title: 'API Key Generated',
				description: `"${res.data.name}" is ready. Copy the token now; this is the only time it will be shown.`,
				icon: 'mdi:key-plus',
				color: 'success',
				duration: 6000
			});
			emit('created', res.data);
			open.value = false;
		} else {
			toast.add({
				title: 'Could Not Generate API Key',
				description:
					res.error ??
					'The request was rejected. Double-check the name, scopes, and your tier key limit.',
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
