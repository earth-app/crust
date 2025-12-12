<template>
	<div class="flex flex-col space-y-2">
		<UButton
			:icon="icon"
			:variant="linked ? 'solid' : 'outline'"
			@click="handleOauth"
			:disabled="linked || true"
		/>
		<UButton
			v-if="linked && user"
			class="text-red-500 font-medium"
			@click="handleDisconnect"
			>Disconnect</UButton
		>
	</div>
</template>

<script setup lang="ts">
import type { OAuthProvider } from '../../shared/types/user';

const { user } = useAuth();
const toast = useToast();
const config = useRuntimeConfig();

const props = defineProps<{
	provider: OAuthProvider;
	linked?: boolean;
}>();

const icon = computed(() => {
	switch (props.provider) {
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

// Link Authentication Methods
const linkUri = `${config.public.baseUrl}/api/auth/callback`;
const microsoftAuth = () => {
	const clientId = config.public.microsoftClientId;
	const scope = 'openid email profile';

	return (
		`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
		`client_id=${clientId}&` +
		`redirect_uri=${encodeURIComponent(linkUri)}&` +
		`response_type=code&` +
		`scope=${encodeURIComponent(scope)}&` +
		`state=microsoft`
	);
};

const discordAuth = () => {
	const clientId = config.public.discordClientId;
	const scope = 'identify email';

	return (
		`https://discord.com/api/oauth2/authorize?` +
		`client_id=${clientId}&` +
		`redirect_uri=${encodeURIComponent(linkUri)}&` +
		`response_type=code&` +
		`scope=${encodeURIComponent(scope)}&` +
		`state=discord`
	);
};

const githubAuth = () => {
	const clientId = config.public.githubClientId;
	const scope = 'user:email read:user';

	return (
		`https://github.com/login/oauth/authorize?` +
		`client_id=${clientId}&` +
		`redirect_uri=${encodeURIComponent(linkUri)}&` +
		`scope=${encodeURIComponent(scope)}&` +
		`state=github`
	);
};

const facebookAuth = () => {
	const clientId = config.public.facebookClientId;
	const scope = 'public_profile email';

	return (
		`https://www.facebook.com/v18.0/dialog/oauth?` +
		`client_id=${clientId}&` +
		`redirect_uri=${encodeURIComponent(linkUri)}&` +
		`response_type=code&` +
		`scope=${encodeURIComponent(scope)}&` +
		`state=facebook`
	);
};

async function handleOauth() {
	let authUrl = '';
	switch (props.provider) {
		case 'microsoft':
			authUrl = microsoftAuth();
			break;
		case 'discord':
			authUrl = discordAuth();
			break;
		case 'github':
			authUrl = githubAuth();
			break;
		case 'facebook':
			authUrl = facebookAuth();
			break;
		default:
			throw new Error('Unsupported OAuth provider');
	}

	navigateTo(authUrl, { external: true });
}

// Unlink Authentication Methods
const unlinkUri = `${config.public.baseUrl}/api/auth/unlink-callback`;
async function handleDisconnect() {
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

	let disconnectUrl = '';
	switch (props.provider) {
		case 'microsoft':
			disconnectUrl =
				`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
				`client_id=${config.public.microsoftClientId}&` +
				`redirect_uri=${encodeURIComponent(unlinkUri)}&` +
				`response_type=code&` +
				`scope=${encodeURIComponent('openid email profile')}&` +
				`state=unlink_microsoft`;
			break;

		case 'discord':
			disconnectUrl =
				`https://discord.com/api/oauth2/authorize?` +
				`client_id=${config.public.discordClientId}&` +
				`redirect_uri=${encodeURIComponent(unlinkUri)}&` +
				`response_type=code&` +
				`scope=${encodeURIComponent('identify email')}&` +
				`state=unlink_discord`;
			break;

		case 'github':
			disconnectUrl =
				`https://github.com/login/oauth/authorize?` +
				`client_id=${config.public.githubClientId}&` +
				`redirect_uri=${encodeURIComponent(unlinkUri)}&` +
				`scope=${encodeURIComponent('user:email read:user')}&` +
				`state=unlink_github`;
			break;

		case 'facebook':
			disconnectUrl =
				`https://www.facebook.com/v18.0/dialog/oauth?` +
				`client_id=${config.public.facebookClientId}&` +
				`redirect_uri=${encodeURIComponent(unlinkUri)}&` +
				`response_type=code&` +
				`scope=${encodeURIComponent('public_profile email')}&` +
				`state=unlink_facebook`;
			break;
		default:
			throw new Error('Unsupported OAuth provider');
	}

	navigateTo(disconnectUrl, { external: true });
}
</script>
