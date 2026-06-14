<template>
	<ClientOnly>
		<UDropdownMenu
			:items="items"
			:ui="{ content: content || 'w-48' }"
		>
			<slot>
				<UButton
					icon="mdi:dots-vertical"
					color="neutral"
					variant="ghost"
					size="sm"
					aria-label="Open content actions"
				/>
			</slot>
		</UDropdownMenu>

		<ReportModal
			ref="reportModalRef"
			:content-type="contentType"
			:content-id="contentId"
			:parent-id="parentId"
		/>

		<template #fallback>
			<slot>
				<UButton
					icon="mdi:dots-vertical"
					color="neutral"
					variant="ghost"
					size="sm"
					aria-label="Open content actions"
				/>
			</slot>
		</template>
	</ClientOnly>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
import type { ContentType } from 'types/report';
import type { ReportModalRef } from './Modal.vue';

const props = defineProps<{
	contentType: ContentType;
	contentId: string;
	parentId?: string;
	// owner/admin actions (Edit/Delete) folded into the same kebab
	extraItems?: DropdownMenuItem[][];
	content?: string;
}>();

const reportModalRef = ref<ReportModalRef>();

const items = computed<DropdownMenuItem[][]>(() => {
	const groups: DropdownMenuItem[][] = [];
	if (props.extraItems?.length) groups.push(...props.extraItems);
	groups.push([
		{
			label: 'Report',
			icon: 'mdi:flag-outline',
			color: 'error',
			onSelect: () => reportModalRef.value?.open()
		}
	]);
	return groups;
});
</script>
