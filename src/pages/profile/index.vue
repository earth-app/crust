<template>
	<div
		v-if="user"
		class="flex flex-row items-center justify-between w-full pt-24 sm:pt-0"
	>
		<UserProfileEditor :user="user" />
	</div>
	<Loading v-else-if="user === undefined" />
	<!-- Only show "Please log in" when user is explicitly null (not loading) -->
	<div
		v-else-if="user === null"
		class="flex flex-col items-center justify-center h-screen"
	>
		<p class="text-gray-600">Please log in to view your profile.</p>
	</div>
</template>

<script setup lang="ts">
import { OAUTH_PROVIDERS, type OAuthProvider } from 'types/user';

const { user, fetchUser } = useAuth();

const toast = useToast();
const route = useRoute();
const { success, error, provider } = route.query;

// Optimistically reflect a freshly linked/unlinked OAuth provider in the local
// user object so the UI flips immediately, without waiting for mantle2's cache
// to expire. We run after fetchUser() so the force_refresh fetch in
// default.vue can't clobber the optimistic mutation with a still-stale response.
onMounted(async () => {
	const isLink = success === 'oauth_linked' || success === 'oauth_signup';
	const isUnlink = success === 'oauth_unlinked';
	if (!isLink && !isUnlink) return;
	if (typeof provider !== 'string') return;
	if (!OAUTH_PROVIDERS.includes(provider as OAuthProvider)) return;

	await fetchUser();

	const linked = user.value?.account?.linked_providers;
	if (!linked) return;

	const p = provider as OAuthProvider;
	const idx = linked.indexOf(p);
	if (isLink && idx === -1) linked.push(p);
	else if (isUnlink && idx !== -1) linked.splice(idx, 1);
});

if (success) {
	switch (success) {
		case 'oauth_signup':
			toast.add({
				title: 'Welcome!',
				description: 'Your account has been created successfully via OAuth.',
				icon: 'mdi:account-check',
				color: 'success',
				duration: 5000
			});
			break;
		case 'oauth_linked':
			toast.add({
				title: 'OAuth Connected',
				description: 'Your OAuth provider has been successfully connected to your account.',
				icon: 'mdi:account-plus',
				color: 'success',
				duration: 5000
			});
			break;
		case 'oauth_unlinked':
			toast.add({
				title: 'OAuth Disconnected',
				description: 'Your OAuth provider has been successfully disconnected from your account.',
				icon: 'mdi:account-minus',
				color: 'success',
				duration: 5000
			});
			break;
	}
}

if (error) {
	switch (error) {
		case 'provider_error':
			toast.add({
				title: 'OAuth Provider Error',
				description:
					'The OAuth provider returned an error during authentication. Please try again.',
				icon: 'mdi:alert-box-outline',
				color: 'error',
				duration: 5000
			});
			break;
		case 'auth_failed':
			toast.add({
				title: 'Authentication Failed',
				description: 'There was an error during authentication. Please try again.',
				icon: 'mdi:account-alert',
				color: 'error',
				duration: 5000
			});
			break;
		case 'oauth_already_linked':
			toast.add({
				title: 'OAuth Already Linked',
				description: 'This OAuth provider is already linked to another account.',
				icon: 'mdi:account-alert',
				color: 'error',
				duration: 5000
			});
			break;
		case 'oauth_unlink_failed':
			toast.add({
				title: 'Unlink Failed',
				description: 'There was an error unlinking the OAuth provider. Please try again later.',
				icon: 'mdi:account-remove',
				color: 'error',
				duration: 5000
			});
			break;
		case 'cannot_unlink_only_method':
			toast.add({
				title: 'Cannot Unlink',
				description:
					'You cannot unlink your only authentication method. Please add another method or set a password before unlinking this one.',
				icon: 'mdi:account-lock',
				color: 'error',
				duration: 5000
			});
			break;
		case 'no_provider':
			toast.add({
				title: 'Authentication Error',
				description: 'No authentication provider was specified. Please try logging in again.',
				icon: 'mdi:account-alert',
				color: 'error',
				duration: 5000
			});
			break;
		case 'invalid_provider':
			toast.add({
				title: 'Authentication Error',
				description:
					'The specified authentication provider is invalid. Please try logging in again.',
				icon: 'mdi:account-alert',
				color: 'error',
				duration: 5000
			});
			break;
		case 'no_code':
			toast.add({
				title: 'Authentication Error',
				description: 'No authentication code was provided. Please try logging in again.',
				icon: 'mdi:account-alert',
				color: 'error',
				duration: 5000
			});
			break;
		case 'body_parsing_error':
			toast.add({
				title: 'Body Parsing Error',
				description: 'An error occurred while parsing the request body.',
				icon: 'mdi:alert-box-outline',
				color: 'error',
				duration: 5000
			});
			break;
	}
}

const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Profile');
</script>
