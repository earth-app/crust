<template>
	<div
		v-if="user"
		class="flex flex-row items-center justify-between w-full pt-24 sm:pt-0"
	>
		<UserProfileEditor :user="user" />
	</div>
	<!-- Only show "Please log in" when user is explicitly null (not loading) -->
	<div
		v-else-if="user === null"
		class="flex flex-col items-center justify-center h-screen"
	>
		<p class="text-gray-600">Please log in to view your profile.</p>
	</div>
</template>

<script setup lang="ts">
const { user } = useAuth();

const toast = useToast();
const route = useRoute();
const { success, error } = route.query;

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
		case 'no_provider':
			toast.add({
				title: 'Authentication Error',
				description: 'No authentication provider was specified. Please try logging in again.',
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
	}
}

const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Profile');
</script>
