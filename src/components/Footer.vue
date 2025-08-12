<template>
	<div
		class="flex items-center justify-between w-full mt-8 min-h-32 bg-gray-950 border-t-2 border-gray-800 text-gray-700 text-left px-12 text-xs sm:text-sm md:text-md"
	>
		<div class="flex flex-col items-start">
			<span>Copyright © 2025 The Earth App. All Rights Reserved.</span>
			<div
				class="flex space-x-4 text-gray-500 *:hover:text-gray-300 *:transition-colors *:duration-200"
			>
				<a
					href="https://earth-app.com"
					target="_blank"
				>
					Earth App
				</a>
				<a
					href="https://api.earth-app.com"
					target="_blank"
				>
					API
				</a>
				<a
					href="https://deepwiki.com/earth-app/mantle"
					target="_blank"
				>
					Documentation
				</a>
			</div>
			<div class="flex space-x-3 mt-2 *:hover:opacity-70 *:transition-opacity *:duration-200">
				<a
					href="https://github.com/earth-app"
					target="_blank"
				>
					<UIcon
						name="cib:github"
						size="1.5rem"
					/>
				</a>
				<a
					href="https://instagram.com/theearthapp"
					target="_blank"
				>
					<UIcon
						name="cib:instagram"
						size="1.5rem"
					/>
				</a>
				<a
					href="https://x.com/the_earth_app"
					target="_blank"
				>
					<UIcon
						name="cib:twitter"
						size="1.5rem"
					/>
				</a>
			</div>
		</div>
		<ClientOnly>
			<div class="flex flex-col items-start p-4">
				<span v-if="user">
					Logged in as {{ user.username }} {{ user.account.email ? `(${user.account.email})` : '' }}
				</span>
				<span v-if="user"> Account ID: {{ user.id }}</span>
				<span v-if="user"> Last Login: {{ user.last_login ? user.last_login : 'N/A' }}</span>
				<span v-else> Not Logged In </span>
			</div>
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
import { useAuth } from '~/compostables/useUser';

const { user } = useAuth();
</script>
