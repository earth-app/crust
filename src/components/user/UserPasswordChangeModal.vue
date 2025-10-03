<template>
	<UModal
		v-model="open"
		title="Change Password"
	>
		<slot />

		<template #body>
			<div class="flex w-full h-full items-center justify-center mb-4 p-4">
				<UserPasswordChangeForm
					@changed="
						emit('changed');
						open = false;
					"
				/>
			</div>
		</template>
	</UModal>
</template>

<script setup lang="ts">
const emit = defineEmits<{
	(event: 'changed'): void;
}>();

const open = ref(false);

export interface PasswordChangeModalRef {
	open: () => void;
	close: () => void;
}

defineExpose<PasswordChangeModalRef>({
	open: () => {
		open.value = true;
	},
	close: () => {
		open.value = false;
	}
});
</script>
