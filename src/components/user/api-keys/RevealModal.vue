<template>
	<UModal
		v-model:open="open"
		title="Save Your API Key"
		:dismissible="acknowledged"
		:close="{ onClick: confirmClose }"
	>
		<template #body>
			<div class="flex flex-col gap-4 p-1">
				<div class="flex items-start gap-2 rounded bg-amber-500/10 border border-amber-500/40 p-3">
					<UIcon
						name="mdi:alert"
						class="text-amber-500 text-2xl shrink-0"
					/>
					<div class="text-sm">
						<div class="font-semibold">This is the only time you'll see this token.</div>
						<div class="opacity-80">
							Copy it now and store it somewhere secure. The Earth App stores only a hash — we can't
							show it again, and we can't recover it.
						</div>
					</div>
				</div>

				<div class="flex flex-col gap-1">
					<label class="text-sm font-medium">{{ created?.name }}</label>
					<div
						v-if="created?.description"
						class="text-xs opacity-80"
					>
						{{ created.description }}
					</div>
					<div
						v-if="created?.never_expires"
						class="text-xs text-amber-500"
					>
						This key never expires.
					</div>
					<div
						v-else-if="created?.expires_at"
						class="text-xs opacity-80"
					>
						Expires {{ formatDate(created.expires_at) }}.
					</div>
				</div>

				<div class="flex flex-col gap-1">
					<label class="text-xs font-medium opacity-80">Bearer Token</label>
					<div class="flex items-stretch gap-1">
						<code
							class="font-mono text-xs break-all rounded border border-default px-2 py-2 flex-1 bg-default/40 select-all"
							>{{ created?.token }}</code
						>
						<UButton
							icon="mdi:content-copy"
							variant="soft"
							:loading="copying"
							@click="copy"
						>
							Copy
						</UButton>
					</div>
				</div>

				<div class="flex flex-col gap-1">
					<div class="text-xs opacity-80">Use it as a Bearer token:</div>
					<code
						class="font-mono text-xs break-all rounded border border-default px-2 py-2 bg-default/40"
					>
						Authorization: Bearer {{ created?.token }}
					</code>
				</div>

				<label class="flex items-start gap-2 cursor-pointer">
					<UCheckbox v-model="acknowledged" />
					<div class="text-sm">I've saved my key somewhere safe.</div>
				</label>
			</div>
		</template>

		<template #footer>
			<div class="flex justify-end gap-2 w-full">
				<UButton
					color="primary"
					:disabled="!acknowledged"
					@click="open = false"
				>
					Done
				</UButton>
			</div>
		</template>
	</UModal>
</template>

<script setup lang="ts">
import type { ApiKeyCreated } from 'types/apiKeys';

const props = defineProps<{ created: ApiKeyCreated | null }>();
const open = defineModel<boolean>('open', { default: false });

const acknowledged = ref(false);
const copying = ref(false);
const toast = useToast();

watch(open, (isOpen) => {
	if (isOpen) acknowledged.value = false;
});

async function copy() {
	if (!props.created?.token) return;
	copying.value = true;
	try {
		await navigator.clipboard.writeText(props.created.token);
		toast.add({
			title: 'Copied to Clipboard',
			description:
				'Paste the token into your script or secret manager now — it will not be shown again.',
			icon: 'mdi:content-copy',
			color: 'success',
			duration: 5000
		});
		acknowledged.value = true;
	} catch {
		toast.add({
			title: 'Copy Failed',
			description:
				'Clipboard access was blocked. Select the token text manually and copy it instead.',
			icon: 'mdi:clipboard-alert',
			color: 'error',
			duration: 6000
		});
	} finally {
		copying.value = false;
	}
}

function confirmClose() {
	if (!acknowledged.value) {
		toast.add({
			title: 'Save Your Key First',
			description:
				'This is the only time we can show you this token. Copy it, then tick the confirmation before closing.',
			icon: 'mdi:shield-key',
			color: 'warning',
			duration: 6000
		});
		return;
	}
	open.value = false;
}

function formatDate(iso: string) {
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
}
</script>
