<template>
	<UCard
		class="min-w-100 w-11/12 p-4 shadow-lg rounded-lg hover:shadow-xl hover:-translate-y-4 transition-all duration-600 motion-preset-fade motion-duration-1000"
	>
		<div class="flex items-center space-x-4">
			<div class="flex flex-col">
				<div class="flex items-center">
					<UIcon
						v-if="icon"
						:name="icon"
						:size="iconSize || '2rem'"
						class="mr-1"
					/>
					<a
						v-if="link"
						:href="`${link}?utm_source=earth-app&utm_medium=referral&utm_campaign=activity-info-card`"
						target="_blank"
						rel="noopener noreferrer"
						class="text-lg font-semibold text-blue-500 hover:underline"
						>{{ title }}</a
					>
					<h4
						v-else
						class="text-lg font-semibold"
					>
						{{ title }}
					</h4>
				</div>
				<p class="text-gray-600">{{ description }}</p>
				<hr
					v-if="content || image || youtubeId"
					class="border-gray-500 my-2 w-11/12"
				/>
				<img
					v-if="image"
					:src="image"
					:title="`Retrieved from ${link}`"
					class="w-full h-48 object-cover rounded-lg mb-2"
				/>
				<iframe
					v-if="youtubeId"
					:src="`https://www.youtube.com/embed/${youtubeId}?autoplay=0&mute=1&controls=1&rel=0&modestbranding=1`"
					class="w-full h-48 object-cover rounded-lg mb-2"
				></iframe>
				<span
					v-if="content"
					class="text-gray-300"
					>{{ content }}</span
				>
			</div>
		</div>
	</UCard>
</template>

<script setup lang="ts">
defineProps<{
	title: string;
	description: string;
	content?: string;
	link?: string;
	icon?: string;
	iconSize?: string;
	image?: string;
	youtubeId?: string;
}>();
</script>
