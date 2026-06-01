<template>
	<div class="flex flex-col gap-2 w-full">
		<div class="flex items-center justify-between">
			<div class="text-sm font-medium">Permissions</div>
			<div class="flex items-center gap-2">
				<UButton
					size="xs"
					color="neutral"
					variant="ghost"
					icon="mdi:select-all"
					@click="selectReadOnly"
				>
					Read-Only
				</UButton>
				<UButton
					size="xs"
					color="neutral"
					variant="ghost"
					icon="mdi:close-circle-outline"
					@click="clear"
				>
					Clear
				</UButton>
			</div>
		</div>

		<div
			v-if="!catalog"
			class="text-sm opacity-70"
		>
			Loading scopes…
		</div>

		<div
			v-else
			class="grid grid-cols-1 md:grid-cols-2 gap-3"
		>
			<div
				v-for="(node, name) in catalog.scopes"
				:key="name"
				class="rounded border border-default p-3 flex flex-col gap-2"
			>
				<label class="flex items-start gap-2 cursor-pointer">
					<UCheckbox
						:model-value="isChecked(String(name))"
						@update:model-value="toggle(String(name), $event)"
					/>
					<div class="flex flex-col">
						<div class="font-mono text-sm font-semibold">{{ name }}</div>
						<div class="text-xs opacity-80">{{ node.description }}</div>
					</div>
				</label>

				<div
					v-if="node.children"
					class="pl-6 flex flex-col gap-1 border-l border-default/60"
				>
					<label
						v-for="(child, childName) in node.children"
						:key="childName"
						class="flex items-start gap-2 cursor-pointer"
					>
						<UCheckbox
							:model-value="isChecked(String(childName)) || isChecked(String(name))"
							:disabled="isChecked(String(name))"
							@update:model-value="toggle(String(childName), $event)"
						/>
						<div class="flex flex-col">
							<div class="font-mono text-xs font-semibold">{{ childName }}</div>
							<div class="text-xs opacity-80">{{ child.description }}</div>
						</div>
					</label>
				</div>
			</div>
		</div>

		<div
			v-if="modelValue.length === 0"
			class="text-xs text-red-500"
		>
			Select at least one permission.
		</div>
		<div
			v-else
			class="text-xs opacity-70"
		>
			{{ modelValue.length }} scope{{ modelValue.length === 1 ? '' : 's' }} selected.
		</div>
	</div>
</template>

<script setup lang="ts">
import type { ApiKeyScopeCatalog, ApiKeyScopeId } from 'types/apiKeys';

const props = defineProps<{
	modelValue: ApiKeyScopeId[];
	catalog: ApiKeyScopeCatalog | null;
}>();

const emit = defineEmits<{
	(e: 'update:modelValue', value: ApiKeyScopeId[]): void;
}>();

const isChecked = (scope: string) => props.modelValue.includes(scope);

function toggle(scope: string, checked: boolean | 'indeterminate') {
	const next = new Set(props.modelValue);
	if (checked === true) {
		next.add(scope);
	} else {
		next.delete(scope);
	}
	emit('update:modelValue', [...next]);
}

function selectReadOnly() {
	if (!props.catalog) return;
	const next = new Set<string>();
	for (const [name] of Object.entries(props.catalog.scopes)) {
		if (name.endsWith(':read') || name.startsWith('users:read')) {
			next.add(name);
		}
	}
	emit('update:modelValue', [...next]);
}

function clear() {
	emit('update:modelValue', []);
}
</script>
