<template>
	<div class="flex flex-col space-y-2 items-center">
		<div>
			<UButton
				:icon="icon"
				color="primary"
				:variant="linked ? 'solid' : 'outline'"
				:data-testid="`oauth-${provider}`"
				:aria-label="ariaLabel"
				:title="ariaLabel"
				@click="handleOauth"
				:disabled="linked"
			/>
		</div>
		<UButton
			v-if="linked && user"
			color="error"
			variant="solid"
			size="xs"
			@click="() => handleDisconnect(provider)"
			>Disconnect</UButton
		>
	</div>
</template>

<script setup lang="ts">
const { user } = useAuth();
const toast = useToast();

const props = defineProps<{
	provider: OAuthProvider;
	linked?: boolean;
	// login vs signup vs link — encoded into the OAuth `state` so the callback
	// classifies by intent, not by whatever session cookie happens to exist
	context?: OAuthContext;
}>();

const icon = computed(() => {
	switch (props.provider) {
		case 'google':
			return 'mdi:google';
		case 'microsoft':
			return 'mdi:microsoft';
		case 'discord':
			return 'mdi:discord';
		case 'github':
			return 'mdi:github';
		case 'facebook':
			return 'mdi:facebook';
		case 'apple':
			return 'mdi:apple';
		default:
			return 'mdi:login-variant';
	}
});

const providerName = computed(() => {
	switch (props.provider) {
		case 'google':
			return 'Google';
		case 'microsoft':
			return 'Microsoft';
		case 'discord':
			return 'Discord';
		case 'github':
			return 'GitHub';
		case 'facebook':
			return 'Facebook';
		case 'apple':
			return 'Apple';
		default:
			return props.provider;
	}
});

// icon-only buttons need an accessible name (and a testable hook)
const ariaLabel = computed(() =>
	props.linked ? `${providerName.value} Connected` : `Continue with ${providerName.value}`
);

function handleOauth() {
	const authUrl = authLink(props.provider, props.context ?? 'login');
	navigateTo(authUrl, { external: true });
}

// Unlink Authentication Methods
function handleDisconnect(provider: string) {
	if (!user.value) return;

	if (!user.value.account.has_password && user.value.account.linked_providers.length <= 1) {
		toast.add({
			title: 'Cannot Unlink',
			description:
				'You cannot unlink your only authentication method. Please add another method or set a password before unlinking this one.',
			icon: 'mdi:account-lock',
			color: 'error',
			duration: 5000
		});
		return;
	}

	const unlinkUrl = `/api/auth/unlink-callback?provider=${provider}`;
	navigateTo(unlinkUrl);
}
</script>
