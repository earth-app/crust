<template>
	<UCard
		:variant="variant || 'outline'"
		:class="[
			'relative min-w-80! lg:min-w-100 xl:min-w-120 w-11/12 min-h-40 h-full p-4 shadow-lg rounded-lg hover:shadow-xl transition-[box-shadow,opacity,transform] duration-300',
			isVisible
				? 'opacity-100 translate-y-0'
				: 'opacity-0 translate-y-2 will-change-[opacity,transform]'
		]"
	>
		<LazyUBanner
			v-if="banner"
			:title="banner.text"
			:color="banner.color || 'info'"
			:icon="banner.icon || undefined"
			:link="banner.link || undefined"
			:actions="banner.actions || undefined"
			class="absolute top-0 left-0 w-full rounded-t-lg z-40"
			hydrate-on-visible
		/>
		<div
			v-if="banner"
			class="h-6"
		></div>
		<div class="flex flex-row h-full justify-between">
			<div class="flex items-center space-x-4 h-full">
				<div class="flex flex-col">
					<div class="flex flex-col sm:flex-row items-center">
						<UIcon
							v-if="icon"
							:name="icon"
							:size="iconSize || 'calc(2vw + 2vh)'"
							class="mr-2 min-w-8 min-h-8"
						/>
						<LazyUChip
							v-if="avatar?.chip"
							inset
							:color="avatar.chip.color || 'primary'"
							:size="avatar.chip.size || 'md'"
							class="mr-2"
							hydrate-on-visible
						>
							<LazyUAvatar
								v-if="avatar?.src"
								:src="avatar.src"
								:size="avatar.size || 'md'"
								class="mr-2 min-w-8 min-h-8"
								hydrate-on-visible
							/>
						</LazyUChip>
						<LazyUAvatar
							v-else-if="avatar?.src"
							:src="avatar.src"
							:size="avatar.size || 'md'"
							class="mr-2 min-w-8 min-h-8"
							hydrate-on-visible
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
						<LazyUChip
							v-if="secondaryAvatar?.chip"
							inset
							:color="secondaryAvatar.chip.color || 'primary'"
							:size="secondaryAvatar.chip.size || 'sm'"
							class="ml-2 self-start md:block hidden"
							hydrate-on-visible
						>
							<LazyUAvatar
								v-if="secondaryAvatar?.src"
								:src="secondaryAvatar.src"
								:size="secondaryAvatar.size || 'sm'"
								class="ml-2 self-start md:block hidden"
								hydrate-on-visible
							/>
						</LazyUChip>
						<LazyUAvatar
							v-else-if="secondaryAvatar?.src"
							:src="secondaryAvatar.src"
							:size="secondaryAvatar.size || 'sm'"
							class="ml-2 self-start md:block hidden"
							hydrate-on-visible
						/>
					</div>
					<p
						v-if="description"
						class="text-sm md:text-md lg:text-base text-gray-600 light:text-gray-900 hover:cursor-text"
					>
						{{ description }}
					</p>
					<USeparator
						v-if="content || image || youtubeId || video || object"
						class="border-gray-500 light:border-black my-2 w-11/12"
					/>
					<LazyNuxtImg
						v-if="image"
						:src="image"
						:alt="title"
						:title="`Retrieved from ${link}`"
						format="webp"
						width="800"
						height="400"
						loading="lazy"
						decoding="async"
						class="w-full h-48 object-cover rounded-lg mb-2"
					/>
					<LazyClientOnly
						v-if="youtubeId"
						hydrate-on-visible
					>
						<iframe
							:src="`https://www.youtube.com/embed/${youtubeId}?autoplay=0&mute=1&controls=1&rel=0&modestbranding=1&origin=${origin}`"
							class="w-full min-h-64 object-cover rounded-lg mb-2"
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
					</LazyClientOnly>
					<LazyClientOnly
						v-if="video"
						hydrate-on-visible
					>
						<video
							class="w-full min-h-64 object-cover rounded-lg mb-2"
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
					</LazyClientOnly>
					<LazyClientOnly
						v-if="object?.url"
						hydrate-on-visible
					>
						<video
							v-if="object?.type?.startsWith('video/')"
							:src="object.url"
							controls
							preload="metadata"
							class="w-full min-h-64 object-cover rounded-lg mb-2"
						></video>

						<audio
							v-else-if="object?.type?.startsWith('audio/')"
							:src="object.url"
							controls
							preload="metadata"
							class="w-full object-cover rounded-lg mb-2"
						></audio>

						<object
							v-else
							:data="object.url"
							:type="object.type || undefined"
							class="w-full min-h-64 object-cover rounded-lg mb-2"
						>
							<p class="text-center text-gray-500">
								Unable to display content. <br />
								<a
									:href="object.url"
									target="_blank"
									rel="noopener noreferrer"
									class="text-blue-500 hover:underline"
								>
									View here.
								</a>
							</p>
						</object>
					</LazyClientOnly>
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
							class="max-w-100 mr-2 mb-2 hover:scale-105 transition-all duration-300"
							:class="badge.link ? 'hover:cursor-pointer' : 'hover:cursor-text'"
							:icon="badge.icon || undefined"
							:variant="badge.variant || 'solid'"
							@click="badge.link ? $router.push(badge.link) : null"
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
						<LazyUAvatarGroup
							hydrate-on-visible
							:max="avatarGroup.max"
						>
							<NuxtLink
								:to="avatar.link"
								v-for="(avatar, index) in avatarGroup.avatars"
								:key="`avatar-link-${index}`"
							>
								<LazyUAvatar
									:src="avatar.src"
									:alt="avatar.alt"
									:icon="avatar.icon"
									:size="avatarGroup.size || 'md'"
									:chip="avatar.chip || undefined"
								/>
							</NuxtLink>
						</LazyUAvatarGroup>
					</div>
					<USeparator
						v-if="footer"
						class="border-gray-500 my-2 w-11/12"
					/>
					<LazyUTooltip
						v-if="footerTooltip"
						:text="footerTooltip"
						hydrate-on-interaction="mouseover"
					>
						<p
							v-if="footer"
							class="text-gray-500 text-xs sm:text-sm"
						>
							{{ footer }}
						</p>
					</LazyUTooltip>
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
				v-if="buttons && buttons.length > 0"
				class="flex flex-col items-center ml-4 min-w-22 sm:min-w-26 md:min-w-30 lg:min-w-34"
			>
				<h2 class="text-sm md:text-md text-center font-semibold text-gray-500 light:text-gray-800">
					Actions
				</h2>
				<LazyUButton
					v-for="(button, index) in buttons"
					:key="`button-${index}`"
					:color="button.color || 'primary'"
					:size="button.size || 'md'"
					:icon="button.icon"
					@click="() => button.onClick && button.onClick()"
					class="my-1 hover:opacity-90 hover:cursor-pointer transition-all duration-300 w-full"
					hydrate-on-interaction="mouseover"
					>{{ button.text }}</LazyUButton
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
type Variant = 'outline' | 'subtle' | 'solid' | 'soft';
type Color = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral';
type Size = 'md' | 'xs' | 'sm' | 'lg' | 'xl';
type AvatarSize = Size | '2xl' | '3xl' | '2xs' | '3xs';

const props = defineProps<{
	external?: boolean;
	variant?: Variant;
	badges?: {
		text: string;
		color?: Color;
		size?: Size;
		icon?: string;
		variant?: Variant;
		link?: string;
	}[];
	title: string;
	description?: string;
	content?: string;
	link?: string;
	icon?: string;
	iconSize?: string;
	avatar?: {
		src?: string;
		size?: AvatarSize;
		chip?: {
			color?: Color;
			size?: Size;
		};
	};
	secondaryAvatar?: {
		src?: string;
		size?: AvatarSize;
		chip?: {
			color?: Color;
			size?: Size;
		};
	};
	image?: string;
	youtubeId?: string;
	video?: string;
	object?: {
		url?: string;
		type?: string;
	};
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
		color?: Color;
		size?: Size;
		onClick?: () => void;
	}[];
	avatarGroup?: {
		avatars: {
			src?: string;
			alt?: string;
			link?: string;
			icon?: string;
			chip?: {
				inset?: boolean;
				color?: Color;
				size?: Size;
			};
		}[];
		size?: AvatarSize;
		max?: number;
	};
	banner?: {
		color?: Color;
		text: string;
		icon?: string;
		link?: string;
		actions?: {
			text: string;
			icon?: string;
			color?: Color;
			size?: Size;
			onClick?: () => void;
		}[];
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
