<template>
	<div
		class="flex items-center justify-between w-full mt-8 min-h-32 bg-gray-950 border-t-2 border-gray-800 text-gray-700 light:bg-gray-100 light:border-gray-300 text-left px-4 sm:px-8 md:px-12 text-xs sm:text-sm md:text-md"
	>
		<div class="flex flex-col items-start">
			<span class="text-[10px] sm:text-xs"
				>Copyright © 2025 The Earth App. All Rights Reserved.</span
			>
			<div
				class="flex text-[10px] sm:text-xs space-x-1 sm:space-x-2 md:space-x-4 text-gray-500 *:hover:text-gray-300 *:transition-colors *:duration-200"
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
			</div>
			<div class="flex space-x-3 mt-2 *:hover:opacity-70 *:transition-opacity *:duration-200">
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
			<div class="flex flex-col items-start p-4 text-[10px] sm:text-xs">
				<span v-if="user">
					Logged in as {{ user.username }} {{ user.account.email ? `(${user.account.email})` : '' }}
				</span>
				<span v-if="user"> Account ID: {{ user.id }}</span>
				<span v-if="user"> Last Login: {{ user.last_login ? user.last_login : 'N/A' }}</span>
				<span v-else-if="user === null"> Not Logged In </span>
			</div>
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
const { user } = useAuth();
</script>
