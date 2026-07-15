<template>
	<div
		class="flex flex-col items-center justify-center w-full min-h-[60vh] py-12 px-4 text-center gap-4"
	>
		<UIcon
			name="mdi:cart-remove"
			class="text-muted size-16"
		/>
		<h1 class="text-3xl font-bold">Checkout Canceled</h1>
		<p class="text-md max-w-xl opacity-80">
			No charge was made and your account has not changed. You can pick a plan whenever you're
			ready.
		</p>
		<div class="flex items-center gap-3 mt-2 flex-wrap justify-center">
			<UButton
				to="/pricing"
				color="primary"
				icon="mdi:arrow-left"
				>Back to Pricing</UButton
			>
			<UButton
				to="/"
				color="neutral"
				variant="ghost"
				>Go Home</UButton
			>
		</div>
	</div>
</template>

<script setup lang="ts">
const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Checkout Canceled');
</script>
