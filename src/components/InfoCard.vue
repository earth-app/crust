<template>
	<UCard
		:variant="variant || 'outline'"
		class="min-w-100 w-11/12 min-h-40 h-full p-4 shadow-lg rounded-lg hover:shadow-xl hover:-translate-y-4 transition-all duration-600 motion-preset-fade motion-duration-1000"
	>
		<div class="flex items-center space-x-4 h-full">
			<div class="flex flex-col">
				<div class="flex items-center">
					<UIcon
						v-if="icon"
						:name="icon"
						:size="iconSize || '2rem'"
						class="mr-1"
					/>
					<UChip
						v-if="avatarChip"
						inset
						:color="avatarChipColor || 'primary'"
						:size="avatarChipSize || 'md'"
						class="mr-2"
					>
						<UAvatar
							v-if="avatar"
							:src="avatar"
							:size="avatarSize || 'md'"
							class="mr-2"
						/>
					</UChip>
					<UAvatar
						v-else-if="avatar"
						:src="avatar"
						:size="avatarSize || 'md'"
						class="mr-2"
					/>
					<NuxtLink
						v-if="link && external"
						:to="`${link}?utm_source=earth-app&utm_medium=referral&utm_campaign=activity-info-card`"
						target="_blank"
						rel="noopener noreferrer"
						class="text-lg font-semibold text-blue-500 hover:underline"
						>{{ title }}</NuxtLink
					>
					<NuxtLink
						v-else-if="link"
						:to="link"
						class="text-lg font-semibold text-blue-500 hover:underline"
						>{{ title }}</NuxtLink
					>
					<h4
						v-else
						class="text-lg font-semibold"
					>
						{{ title }}
					</h4>
				</div>
				<p
					v-if="description"
					class="text-gray-600"
				>
					{{ description }}
				</p>
				<USeparator
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
				<USeparator
					v-if="footer"
					class="border-gray-500 my-2 w-11/12"
				/>
				<UTooltip
					v-if="footerTooltip"
					:text="footerTooltip"
				>
					<p
						v-if="footer"
						class="text-gray-500 text-sm"
					>
						{{ footer }}
					</p>
				</UTooltip>
				<p
					v-else-if="footer"
					class="text-gray-500 text-sm"
				>
					{{ footer }}
				</p>
				<p
					v-if="secondaryFooter"
					class="mt-2 text-gray-600 text-xs"
				>
					{{ secondaryFooter }}
				</p>
			</div>
		</div>
	</UCard>
</template>

<script setup lang="ts">
defineProps<{
	external?: boolean;
	variant?: 'outline' | 'subtle' | 'solid' | 'soft';
	title: string;
	description?: string;
	content?: string;
	link?: string;
	icon?: string;
	iconSize?: string;
	avatar?: string;
	avatarSize?: 'md' | '3xs' | '2xs' | 'xs' | 'sm' | 'lg' | 'xl' | '2xl' | '3xl';
	avatarChip?: boolean;
	avatarChipColor?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral';
	avatarChipSize?: 'md' | '3xs' | '2xs' | 'xs' | 'sm' | 'lg' | 'xl' | '2xl' | '3xl';
	image?: string;
	youtubeId?: string;
	footer?: string;
	footerTooltip?: string;
	secondaryFooter?: string;
}>();
</script>
