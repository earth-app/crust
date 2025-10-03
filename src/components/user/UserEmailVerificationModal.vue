<template>
	<UModal
		v-model="open"
		title="Verify Your Email"
		:dismissible="false"
		:close="false"
	>
		<slot />

		<template #body>
			<div class="flex w-full h-full items-center justify-center mb-4 p-4">
				<UserEmailVerification
					@verified="
						emit('verified');
						open = false;
					"
				/>
			</div>
		</template>
	</UModal>
</template>

<script setup lang="ts">
const emit = defineEmits<{
	(event: 'verified'): void;
}>();

const open = ref(false);

export interface EmailVerificationModalRef {
	open: () => void;
	close: () => void;
}

defineExpose<EmailVerificationModalRef>({
	open: () => {
		open.value = true;
	},
	close: () => {
		open.value = false;
	}
});
</script>
