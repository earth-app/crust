<template>
	<UModal
		v-model:open="open"
		title="Delete Your Account"
		description="This action is permanent. You may be asked to reauthenticate before we proceed."
	>
		<template #body>
			<div class="flex w-full h-full items-center justify-center mb-4 p-4">
				<LazyUserDeleteAccount
					@deleted="
						emit('deleted');
						open = false;
					"
				/>
			</div>
		</template>
	</UModal>
</template>

<script setup lang="ts">
const emit = defineEmits<{
	(event: 'deleted'): void;
}>();

const open = ref(false);

export interface DeleteAccountModalRef {
	open: () => void;
	close: () => void;
}

defineExpose<DeleteAccountModalRef>({
	open: () => {
		open.value = true;
	},
	close: () => {
		open.value = false;
	}
});
</script>
