<template>
	<UCard
		:variant="variant || 'outline'"
		class="relative min-w-100 w-11/12 min-h-40 h-full p-4 shadow-lg rounded-lg hover:shadow-xl hover:-translate-y-4 transition-all duration-600 motion-preset-fade motion-duration-1000"
	>
		<div class="flex flex-row h-full justify-between">
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
							:to="`${link}?utm_source=earth-app&utm_medium=referral&utm_campaign=info-card`"
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
						<UChip
							v-if="secondaryAvatarChip"
							inset
							:color="secondaryAvatarChipColor || 'primary'"
							:size="secondaryAvatarChipSize || 'sm'"
							class="ml-2 self-start"
						>
							<UAvatar
								v-if="secondaryAvatar"
								:src="secondaryAvatar"
								:size="secondaryAvatarSize || 'sm'"
								class="ml-2 self-start"
							/>
						</UChip>
						<UAvatar
							v-else-if="secondaryAvatar"
							:src="secondaryAvatar"
							:size="secondaryAvatarSize || 'sm'"
							class="ml-2 self-start"
						/>
					</div>
					<p
						v-if="description"
						class="text-gray-600 hover:cursor-text"
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
						class="text-gray-300 hover:cursor-text"
						>{{ content }}</span
					>
					<div
						class="flex flex-wrap items-center space-x-2 space-y-2 mt-2"
						v-if="badges"
					>
						<UBadge
							v-for="(badge, index) in badges"
							:key="`badge-${index}`"
							:color="badge.color || 'primary'"
							:size="badge.size || 'md'"
							class="text-xs max-w-100 hover:scale-105 transition-all duration-300 hover:cursor-text"
							>{{ badge.text }}</UBadge
						>
					</div>
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
					<div
						v-if="additionalLinks"
						class="flex flex-wrap space-x-1 mb-1"
					>
						<div
							v-for="(linkObj, index) in additionalLinks"
							:key="`additional-link-${index}`"
							class="flex items-center space-x-1"
						>
							<NuxtLink
								:to="
									linkObj.external
										? `${linkObj.link}?utm_source=earth-app&utm_medium=referral&utm_campaign=info-card`
										: linkObj.link
								"
								:target="linkObj.external ? '_blank' : '_self'"
								rel="noopener noreferrer"
								class="font-semibold text-blue-500 text-sm hover:underline"
								>{{ linkObj.text }}
							</NuxtLink>
							<span v-if="index < additionalLinks.length - 1">•</span>
						</div>
					</div>
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
			<div v-if="buttons">
				<div class="flex flex-col space-y-2">
					<h2 class="text-center font-semibold text-gray-500 light:text-gray-800">Actions</h2>
					<UButton
						v-for="(button, index) in buttons"
						:key="`button-${index}`"
						:color="button.color || 'primary'"
						:size="button.size || 'md'"
						@click="() => button.onClick && button.onClick()"
						class="hover:opacity-90 hover:cursor-pointer transition-all duration-300"
						>{{ button.text }}</UButton
					>
				</div>
			</div>
		</div>
		<div
			v-if="color"
			:style="`background-color: rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.7);`"
			class="absolute top-0 left-0 w-2 min-h-4 h-full rounded-lg pointer-events-none z-50"
		></div>
	</UCard>
</template>

<script setup lang="ts">
const props = defineProps<{
	external?: boolean;
	variant?: 'outline' | 'subtle' | 'solid' | 'soft';
	badges?: {
		text: string;
		color?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral';
		size?: 'md' | 'xs' | 'sm' | 'lg' | 'xl';
	}[];
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
	secondaryAvatar?: string;
	secondaryAvatarSize?: 'md' | '3xs' | '2xs' | 'xs' | 'sm' | 'lg' | 'xl' | '2xl' | '3xl';
	secondaryAvatarChip?: boolean;
	secondaryAvatarChipColor?:
		| 'primary'
		| 'secondary'
		| 'success'
		| 'info'
		| 'warning'
		| 'error'
		| 'neutral';
	secondaryAvatarChipSize?: 'md' | '3xs' | '2xs' | 'xs' | 'sm' | 'lg' | 'xl' | '2xl' | '3xl';
	image?: string;
	youtubeId?: string;
	footer?: string;
	footerTooltip?: string;
	secondaryFooter?: string;
	additionalLinks?: {
		text: string;
		link: string;
		external?: boolean;
	}[];
	buttons?: {
		text: string;
		color?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral';
		size?: 'md' | 'xs' | 'sm' | 'lg' | 'xl';
		onClick?: () => void;
	}[];
	color?: number;
}>();

const rgb = computed<[number, number, number]>(() => {
	if (!props.color) return [0, 0, 0];

	const r = (props.color >> 16) & 0xff;
	const g = (props.color >> 8) & 0xff;
	const b = props.color & 0xff;
	return [r, g, b];
});
</script>
