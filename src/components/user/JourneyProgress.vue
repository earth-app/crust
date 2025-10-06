<template>
	<UPopover
		arrow
		mode="hover"
	>
		<div class="flex items-center w-32 mr-2">
			<UIcon
				:name="icon"
				class="size-6 mr-2"
			/>

			<div class="flex flex-col items-start justify-center">
				<span
					v-if="total"
					class="text-sm font-medium text-gray-900 dark:text-gray-100"
				>
					{{ count }} / {{ total }}
				</span>
				<span
					v-else
					class="text-sm font-semibold text-yellow-500"
				>
					{{ count }}
				</span>
				<UProgress
					v-if="total"
					v-bind:model-value="count"
					:max="total"
					class="w-24 mt-1"
					color="secondary"
				/>
			</div>
		</div>

		<template #content>
			<div class="max-w-xs p-4">
				<p
					v-if="title"
					class="font-medium text-gray-900 dark:text-gray-100 mb-2"
				>
					{{ title }}
				</p>
				<p
					v-if="total"
					class="text-sm text-gray-700 dark:text-gray-300"
				>
					You have found {{ count }} out of {{ total }} activities on this journey.
				</p>
				<p
					v-else
					class="text-sm text-gray-700 dark:text-gray-300"
				>
					You have found {{ count }} {{ title?.toLowerCase() || 'items' }} so far. Make sure you
					keep going at least every two days to keep up this streak!
				</p>
				<p
					v-if="help"
					class="mt-2 text-xs text-gray-500 dark:text-gray-400"
				>
					{{ help }}
				</p>
			</div>
		</template>
	</UPopover>
</template>

<script setup lang="ts">
defineProps<{
	icon: string;
	title?: string;
	help?: string;
	count: number;
	total?: number;
}>();
</script>
