<template>
	<UApp>
		<NuxtLayout>
			<div class="flex flex-col items-center justify-center min-h-screen">
				<img
					src="/cloud.png"
					alt="Error Image"
					class="h-48 w-48mb-6"
				/>
				<h1 class="text-4xl font-bold mb-4">Oops! Something went wrong.</h1>
				<p class="text-lg mb-8">
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
