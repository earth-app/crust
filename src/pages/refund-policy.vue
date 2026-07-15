<template>
	<div class="flex flex-col items-center w-full h-full py-4 px-16">
		<h1 class="text-3xl font-bold">Refund Policy</h1>
		<div class="relative size-48 my-24">
			<EarthCircle />
		</div>
		<LazyLegalRefundPolicyBody hydrate-on-visible />
	</div>
</template>

<script setup lang="ts">
const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Refund Policy');
</script>
