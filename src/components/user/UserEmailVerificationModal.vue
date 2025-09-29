<template>
	<UModal
		v-model="open"
		title="Verify Your Email"
		:dismissible="false"
		:close="false"
	>
		<slot />

		<template #content>
			<UserEmailVerification
				@verified="
					emit('verified');
					open = false;
				"
			/>
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
