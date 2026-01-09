<template>
	<div class="flex flex-col space-y-2 items-center">
		<div>
			<UButton
				:icon="icon"
				color="primary"
				:variant="linked ? 'solid' : 'outline'"
				@click="() => handleOauth(provider)"
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
import type { OAuthProvider } from '~/shared/types/user';

const { user } = useAuth();
const toast = useToast();
const config = useRuntimeConfig();

const props = defineProps<{
	provider: OAuthProvider;
	linked?: boolean;
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
		default:
			return 'mdi:login-variant';
	}
});

function handleOauth(provider: string) {
	const authUrl = authLink(provider);
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
