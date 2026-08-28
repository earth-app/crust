<template>
	<UApp>
		<NuxtLayout>
			<div class="flex flex-col items-center justify-center min-h-screen">
				<NuxtImg
					src="/cloud.png"
					alt="Error Image"
					format="webp"
					width="192"
					height="192"
					class="h-48 w-48 mb-6"
					:preload="{ fetchPriority: 'high' }"
				/>
				<h1 class="w-full px-4 mb-4 text-3xl sm:text-4xl font-bold text-center text-balance">
					Oops! Something went wrong.
				</h1>
				<p class="w-full px-4 mb-8 text-lg text-center">
					{{ error?.message || "We're sorry, but we couldn't find the page you were looking for." }}
				</p>
				<UButton
					class="hover:cursor-pointer"
					@click="$router.push('/')"
				>
					Go Back Home
				</UButton>
			</div>
		</NuxtLayout>
	</UApp>
</template>

<script setup lang="ts">
const error = useError();
</script>
