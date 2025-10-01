<template>
	<UModal
		v-model="open"
		title="Verify Your Email"
		:dismissible="false"
		:close="false"
	>
		<slot />

		<template #content>
			<div class="flex w-full h-full items-center justify-center mb-4 p-4">
				<UserPasswordChangeForm
					@changePasswordSuccess="
						emit('changePasswordSuccess');
						open = false;
					"
				/>
			</div>
		</template>
	</UModal>
</template>

<script setup lang="ts">
const emit = defineEmits<{
	(event: 'changePasswordSuccess'): void;
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
