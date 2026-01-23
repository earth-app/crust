<template>
	<UCard
		:variant="variant || 'outline'"
		:class="[
			'relative min-w-65 lg:min-w-100 xl:min-w-120 w-11/12 min-h-40 h-full p-4 shadow-lg rounded-lg hover:shadow-xl transition-all duration-600',
			isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
			'will-change-[opacity,transform]'
		]"
	>
		<div class="flex flex-row h-full justify-between">
			<div class="flex items-center space-x-4 h-full">
				<div class="flex flex-col">
					<div class="flex flex-col sm:flex-row items-center">
						<UIcon
							v-if="icon"
							:name="icon"
							:size="iconSize || 'calc(2vw + 2vh)'"
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
							class="text-md sm:text-md md:text-lg font-semibold text-blue-500 light:text-blue-600 hover:underline"
							>{{ title }}</NuxtLink
						>
						<NuxtLink
							v-else-if="link"
							:to="link"
							class="text-sm sm:text-md md:text-lg font-semibold text-blue-500 light:text-blue-600 hover:underline"
							>{{ title }}</NuxtLink
						>
						<h4
							v-else
							class="text-sm sm:text-md md:text-lg font-semibold"
						>
							{{ title }}
						</h4>
						<UChip
							v-if="secondaryAvatarChip"
							inset
							:color="secondaryAvatarChipColor || 'primary'"
							:size="secondaryAvatarChipSize || 'sm'"
							class="ml-2 self-start md:block hidden"
						>
							<UAvatar
								v-if="secondaryAvatar"
								:src="secondaryAvatar"
								:size="secondaryAvatarSize || 'sm'"
								class="ml-2 self-start md:block hidden"
							/>
						</UChip>
						<UAvatar
							v-else-if="secondaryAvatar"
							:src="secondaryAvatar"
							:size="secondaryAvatarSize || 'sm'"
							class="ml-2 self-start md:block hidden"
						/>
					</div>
					<p
						v-if="description"
						class="text-sm md:text-md lg:text-base text-gray-600 light:text-gray-900 hover:cursor-text"
					>
						{{ description }}
					</p>
					<USeparator
						v-if="content || image || youtubeId || video"
						class="border-gray-500 light:border-black my-2 w-11/12"
					/>
					<NuxtImg
						v-if="image"
						:src="image"
						:alt="title"
						:title="`Retrieved from ${link}`"
						format="webp"
						width="800"
						height="400"
						class="w-full h-48 object-cover rounded-lg mb-2"
						:preload="{ fetchPriority: 'low' }"
					/>
					<ClientOnly>
						<iframe
							v-if="youtubeId"
							:src="`https://www.youtube.com/embed/${youtubeId}?autoplay=0&mute=1&controls=1&rel=0&modestbranding=1&origin=${origin}`"
							class="w-full h-48 object-cover rounded-lg mb-2"
							allow="
								accelerometer;
								autoplay;
								clipboard-write;
								encrypted-media;
								gyroscope;
								picture-in-picture;
							"
							allowfullscreen
							loading="lazy"
							referrerpolicy="strict-origin-when-cross-origin"
						></iframe>
					</ClientOnly>
					<ClientOnly>
						<video
							v-if="video"
							class="w-full h-48 object-cover rounded-lg mb-2"
							controls
							loading="lazy"
							preload="metadata"
						>
							<source
								v-if="video.endsWith('.mp4')"
								:src="video"
								type="video/mp4"
							/>
							<source
								v-if="video.endsWith('.webm')"
								:src="video"
								type="video/webm"
							/>
						</video>
					</ClientOnly>
					<span
						v-if="content"
						class="text-xs sm:text-sm md:text-md text-gray-300 light:text-gray-700 hover:cursor-text"
						>{{ content }}</span
					>
					<div
						class="flex flex-wrap items-center mt-2"
						v-if="badges"
					>
						<UBadge
							v-for="(badge, index) in badges"
							:key="`badge-${index}`"
							:color="badge.color || 'primary'"
							:size="badge.size || 'md'"
							:ui="{ label: 'text-sm' }"
							class="max-w-100 mr-2 mb-2 hover:scale-105 transition-all duration-300 hover:cursor-text"
							:icon="badge.icon || undefined"
							:variant="badge.variant || 'solid'"
							>{{ badge.text }}</UBadge
						>
					</div>
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
					<div v-if="avatarGroup">
						<UAvatarGroup :max="avatarGroup.max">
							<UAvatar
								v-for="(avatar, index) in avatarGroup.avatars"
								:key="`avatar-group-${index}`"
								:src="avatar.src"
								:alt="avatar.alt"
								:icon="avatar.icon"
								:size="avatarGroup.size || 'md'"
								:chip="avatar.chip || undefined"
							/>
						</UAvatarGroup>
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
							class="text-gray-500 text-xs sm:text-sm"
						>
							{{ footer }}
						</p>
					</UTooltip>
					<p
						v-else-if="footer && !footerTooltip"
						class="text-gray-500 light:text-gray-800 text-xs sm:text-sm"
					>
						{{ footer }}
					</p>
					<p
						v-if="secondaryFooter"
						class="mt-2 text-gray-600 light:text-gray-800 text-xs"
					>
						{{ secondaryFooter }}
					</p>
				</div>
			</div>
			<div
				v-if="buttons"
				class="flex flex-col items-center ml-2 min-w-22 sm:min-w-26 md:min-w-30"
			>
				<h2 class="text-sm md:text-md text-center font-semibold text-gray-500 light:text-gray-800">
					Actions
				</h2>
				<UButton
					v-for="(button, index) in buttons"
					:key="`button-${index}`"
					:color="button.color || 'primary'"
					:size="button.size || 'md'"
					:icon="button.icon"
					@click="() => button.onClick && button.onClick()"
					class="my-1 hover:opacity-90 hover:cursor-pointer transition-all duration-300 w-full"
					>{{ button.text }}</UButton
				>
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
		icon?: string;
		variant?: 'solid' | 'subtle' | 'outline' | 'soft';
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
	video?: string;
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
		icon?: string;
		color?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral';
		size?: 'md' | 'xs' | 'sm' | 'lg' | 'xl';
		onClick?: () => void;
	}[];
	avatarGroup?: {
		avatars: {
			src?: string;
			alt?: string;
			icon?: string;
			chip?: {
				inset?: boolean;
				color?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral';
				size?: 'md' | '3xs' | '2xs' | 'xs' | 'sm' | 'lg' | 'xl' | '2xl' | '3xl';
			};
		}[];
		size?: 'md' | '3xs' | '2xs' | 'xs' | 'sm' | 'lg' | 'xl' | '2xl' | '3xl';
		max?: number;
	};
	color?: number;
}>();

const rgb = computed<[number, number, number]>(() => {
	if (!props.color) return [0, 0, 0];

	const r = (props.color >> 16) & 0xff;
	const g = (props.color >> 8) & 0xff;
	const b = props.color & 0xff;
	return [r, g, b];
});

// Ensure fade/translate animation reliably completes and final state sticks
const isVisible = ref(false);

onMounted(async () => {
	// Respect prefers-reduced-motion
	const prefersReduced =
		typeof window !== 'undefined' &&
		window.matchMedia &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	await nextTick();
	requestAnimationFrame(() => {
		isVisible.value = !prefersReduced;
	});
});

const origin = computed(() => {
	if (import.meta.client) {
		return encodeURIComponent(window.location.origin);
	}
	// Fallback to production URL for SSR
	return encodeURIComponent('https://app.earth-app.com');
});
</script>
