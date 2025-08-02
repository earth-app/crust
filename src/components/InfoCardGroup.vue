<template>
	<UCard
		class="ml-8 mt-6 shadow-xl rounded-lg max-w-11/12"
		variant="soft"
	>
		<div class="flex space-x-1 items-start mb-4">
			<div
				v-if="icon"
				class="flex"
			>
				<UIcon
					:name="icon"
					class="size-4 md:size-8 mr-2 mt-0.5"
				/>
			</div>
			<div class="flex flex-col items-start text-white min-w-1/4">
				<h1 class="text-2xl font-semibold">{{ title }}</h1>
				<p
					v-if="description"
					class="text-gray-400 text-sm mt-1"
				>
					{{ description }}
				</p>
				<USeparator
					size="md"
					class="my-2"
				/>
			</div>
		</div>
		<div class="flex items-start space-x-8 *:w-1/4">
			<slot />
		</div>
	</UCard>
</template>

<script setup lang="ts">
defineProps<{
	title: string;
	description?: string;
	icon?: string;
}>();
</script>
