<template>
	<UModal
		v-model="open"
		title="Delete Account"
		description="Are you sure you want to delete your account? This action is irreversible."
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
