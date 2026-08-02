<template>
	<footer
		role="contentinfo"
		class="flex items-center justify-between w-full mt-8 min-h-32 bg-elevated border-t border-default text-muted text-left px-4 sm:px-8 md:px-12 text-xs sm:text-sm md:text-base"
	>
		<div class="flex flex-col items-start">
			<span class="text-2xs sm:text-xs">Copyright © 2026 The Earth App. All Rights Reserved.</span>
			<div
				class="flex flex-wrap items-center gap-x-2 sm:gap-x-3 md:gap-x-4 text-2xs sm:text-xs text-muted *:inline-flex *:min-h-6 *:items-center *:justify-center *:px-1 *:hover:text-highlighted *:transition-colors"
			>
				<NuxtLink
					to="https://earth-app.com"
					target="_blank"
				>
					Earth App
				</NuxtLink>
				<NuxtLink
					to="https://api.earth-app.com"
					target="_blank"
				>
					API
				</NuxtLink>
				<NuxtLink to="/about">About</NuxtLink>
				<NuxtLink to="/terms-of-service">Terms of Service</NuxtLink>
				<NuxtLink to="/privacy-policy">Privacy Policy</NuxtLink>
				<NuxtLink to="/refund-policy">Refund Policy</NuxtLink>
				<NuxtLink to="/support">Support</NuxtLink>
			</div>
			<div
				class="flex gap-1 mt-2 *:inline-flex *:size-11 *:items-center *:justify-center *:hover:opacity-70 *:transition-opacity"
			>
				<NuxtLink
					to="https://github.com/earth-app"
					target="_blank"
				>
					<UIcon
						name="cib:github"
						size="1.5rem"
					/>
				</NuxtLink>
				<NuxtLink
					to="https://instagram.com/theearthapp"
					target="_blank"
				>
					<UIcon
						name="cib:instagram"
						size="1.5rem"
					/>
				</NuxtLink>
				<NuxtLink
					to="https://x.com/the_earth_app"
					target="_blank"
				>
					<UIcon
						name="cib:twitter"
						size="1.5rem"
					/>
				</NuxtLink>
				<NuxtLink
					to="https://patreon.com/gmitch215"
					target="_blank"
				>
					<UIcon
						name="cib:patreon"
						size="1.5rem"
					/>
				</NuxtLink>
			</div>
		</div>
		<ClientOnly>
			<div class="flex flex-col items-start p-4 text-2xs sm:text-xs">
				<span v-if="user">
					Logged in as {{ user.username }} {{ user.account.email ? `(${user.account.email})` : '' }}
				</span>
				<span v-if="user"> Account ID: {{ user.id }}</span>
				<span v-if="user"> Last Login: {{ user.last_login ? user.last_login : 'N/A' }}</span>
				<span v-else-if="user === null"> Not Logged In </span>
			</div>
		</ClientOnly>
	</footer>
</template>

<script setup lang="ts">
const { user } = useAuth();
</script>
