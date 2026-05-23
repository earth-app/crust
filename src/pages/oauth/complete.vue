<template>
	<div class="flex flex-col items-center justify-center min-h-screen px-6 text-center">
		<NuxtImg
			src="/cloud.png"
			alt="The Earth App"
			format="webp"
			width="192"
			height="192"
			class="h-48 w-48 mb-6"
			:preload="{ fetchPriority: 'high' }"
		/>
		<template v-if="hasError">
			<h1 class="text-4xl font-bold mb-4">Sign-in didn't complete</h1>
			<p class="text-lg mb-2">{{ errorMessage }}</p>
			<p
				v-if="errorDescription"
				class="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-md"
			>
				{{ errorDescription }}
			</p>
			<UButton
				class="hover:cursor-pointer"
				:to="webFallbackPath"
			>
				{{ webFallbackLabel }}
			</UButton>
		</template>
		<template v-else>
			<h1 class="text-4xl font-bold mb-4">Returning you to The Earth App</h1>
			<p class="text-lg mb-8 max-w-md">
				If the app doesn't reopen automatically, tap the button below.
			</p>
			<UButton
				class="hover:cursor-pointer"
				:href="appSchemeUrl"
				external
			>
				Open in The Earth App
			</UButton>
		</template>
	</div>
</template>

<script setup lang="ts">
const route = useRoute();
const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Sign-in Complete');

function firstString(value: unknown): string | null {
	if (typeof value === 'string') return value;
	if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
	return null;
}

const sessionToken = computed(() => firstString(route.query.session_token));
const errorCode = computed(() => firstString(route.query.error));
const errorDescription = computed(() => firstString(route.query.error_description));
const context = computed(() => firstString(route.query.context));

const hasError = computed(() => !sessionToken.value && !!errorCode.value);

const errorMessage = computed(() => {
	switch (errorCode.value) {
		case 'provider_error':
			return 'The sign-in provider returned an error.';
		case 'body_parsing_error':
			return 'An error occurred while parsing the request body.';
		case 'no_code':
			return 'No authorization code was received.';
		case 'auth_failed':
			return 'We could not complete authentication.';
		default:
			return errorCode.value ? `Error: ${errorCode.value}` : 'Something went wrong.';
	}
});

const webFallbackPath = computed(() => (context.value === 'signup' ? '/signup' : '/login'));
const webFallbackLabel = computed(() =>
	context.value === 'signup' ? 'Back to sign up' : 'Back to login'
);

const appSchemeUrl = computed(() => {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(route.query)) {
		const str = firstString(value);
		if (str !== null) params.append(key, str);
	}
	return `com.earthapp.sky://oauth/complete?${params.toString()}`;
});

onMounted(() => {
	if (hasError.value) return;
	window.location.href = appSchemeUrl.value;
});
</script>
