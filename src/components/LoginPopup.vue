<template>
	<UPopover
		v-model="isOpen"
		trigger="click"
		:popper="{ placement: 'bottom-end' }"
	>
		<UButton
			color="neutral"
			variant="link"
			class="text-xl font-semibold hover:text-gray-300 mx-6 cursor-pointer"
		>
			Login
		</UButton>

		<template #content>
			<LoginForm />
		</template>
	</UPopover>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import LoginForm from '~/components/LoginForm.vue';

const isOpen = ref(false);
</script>
