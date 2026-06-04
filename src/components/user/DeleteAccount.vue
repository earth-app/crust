<template>
	<div
		v-if="user"
		class="flex flex-col w-full min-w-100 px-8"
	>
		<div class="flex flex-col w-full mb-4">
			<strong class="text-sm sm:text-md mb-2">@{{ user.username }}</strong>
			<p class="text-xs sm:text-sm md:text-md">
				Deleting your account is irreversible. Please make sure that this is something you want to
				do before you proceed.
			</p>
			<p
				v-if="checkingReauth"
				class="text-xs sm:text-sm md:text-md mt-2 text-muted"
			>
				Checking your sign-in status...
			</p>
			<p
				v-else-if="recentlyAuthenticated"
				class="text-xs sm:text-sm md:text-md mt-2"
			>
				You're recently signed in. Confirm below to permanently delete your account.
			</p>
			<p
				v-else-if="hasPassword"
				class="text-xs sm:text-sm md:text-md mt-2"
			>
				To delete your account, please enter your password and confirm your choice.
			</p>
			<p
				v-else-if="hasOAuth"
				class="text-xs sm:text-sm md:text-md mt-2"
			>
				For security, please reauthenticate with one of your linked providers before deleting.
			</p>
			<p
				v-else
				class="text-xs sm:text-sm md:text-md mt-2"
			>
				No reauthentication method is available on your account. Contact support to delete your
				account.
			</p>
		</div>

		<div class="flex flex-col min-w-50 w-1/2 gap-3">
			<UInput
				v-if="!recentlyAuthenticated && hasPassword"
				v-model="password"
				type="password"
				:disabled="loading"
				:ui="{ base: 'peer' }"
			>
				<label
					class="pointer-events-none absolute left-0 -top-2.5 text-highlighted text-xs font-medium px-1.5 transition-all peer-focus:-top-2.5 peer-focus:text-highlighted peer-focus:text-xs peer-focus:font-medium peer-placeholder-shown:text-sm peer-placeholder-shown:text-dimmed peer-placeholder-shown:top-1.5 peer-placeholder-shown:font-normal"
				>
					<span class="inline-flex bg-default px-1">Password</span>
				</label>
			</UInput>

			<div
				v-if="!recentlyAuthenticated && !hasPassword && hasOAuth"
				class="flex flex-col gap-2"
			>
				<UButton
					v-for="provider in linkedProviders"
					:key="provider"
					:icon="providerIcon(provider)"
					color="primary"
					variant="outline"
					:disabled="loading || disabled"
					@click="reauthWith(provider)"
				>
					Reauthenticate With {{ capitalize(provider) }}
				</UButton>
			</div>

			<UButton
				color="error"
				class="w-full"
				variant="solid"
				icon="mdi:account-cancel"
				:loading="loading"
				:disabled="!canDelete"
				@click="confirmDelete"
				>Delete Account</UButton
			>

			<TurnstileWidget
				class="mt-2"
				@received-token="loading = true"
				@error="
					loading = false;
					disabled = true;
					error = 'Turnstile verification failed. Please re-open and try again.';
				"
				@expired="
					loading = false;
					disabled = true;
					error = 'Turnstile verification expired. Please re-open and try again.';
				"
				@verified="
					loading = false;
					disabled = false;
				"
			/>

			<div
				v-if="error"
				class="text-red-500 mt-2"
			>
				{{ error }}
			</div>
		</div>
	</div>
	<div
		v-else
		class="flex flex-col w-full h-full items-center justify-center"
	>
		<p class="text-center text-gray-600">Please log in.</p>
	</div>
</template>

<script setup lang="ts">
import type { OAuthProvider } from 'types/user';

const { user, deleteAccount, getReauthState } = useAuth();
const toast = useToast();
const route = useRoute();

const loading = ref(false);
const disabled = ref(true);
const password = ref('');
const checkingReauth = ref(true);
const recentlyAuthenticated = ref(false);

const error = ref('');

const emit = defineEmits<{
	(event: 'deleted'): void;
}>();

const hasPassword = computed(() => Boolean(user.value?.account?.has_password));
const linkedProviders = computed<OAuthProvider[]>(
	() => (user.value?.account?.linked_providers as OAuthProvider[] | undefined) ?? []
);
const hasOAuth = computed(() => linkedProviders.value.length > 0);

const canDelete = computed(() => {
	if (loading.value || disabled.value) return false;
	if (recentlyAuthenticated.value) return true;
	if (hasPassword.value) return password.value.length > 0;
	// oauth-only users must reauth via redirect first
	return false;
});

function providerIcon(provider: OAuthProvider) {
	switch (provider) {
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
}

function capitalize(s: string) {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

async function refreshReauthState() {
	checkingReauth.value = true;
	try {
		const res = await getReauthState();
		if (valid(res)) {
			recentlyAuthenticated.value = Boolean(res.data.recently_authenticated);
		}
	} catch (e) {
		console.warn('Failed to fetch reauth state', e);
	} finally {
		checkingReauth.value = false;
	}
}

onMounted(async () => {
	await refreshReauthState();

	// surface inbound success/error from a redirect reauth flow
	if (route.query.success === 'reauth_completed') {
		toast.add({
			title: 'Reauthenticated',
			description: 'You may now permanently delete your account within the next few minutes.',
			color: 'success',
			icon: 'mdi:shield-check',
			duration: 5000
		});
	} else if (route.query.error === 'reauth_failed') {
		toast.add({
			title: 'Reauthentication Failed',
			description:
				'We could not verify your provider identity. Please try again or contact support.',
			color: 'error',
			icon: 'mdi:shield-alert',
			duration: 6000
		});
	}
});

function reauthWith(provider: OAuthProvider) {
	try {
		const url = authLink(provider, 'reauth', 'web');
		toast.add({
			title: 'Redirecting To Provider',
			description: `Opening ${capitalize(provider)} to verify your identity.`,
			color: 'info',
			icon: providerIcon(provider),
			duration: 5000
		});
		navigateTo(url, { external: true });
	} catch (e: any) {
		toast.add({
			title: 'Could Not Start Reauth',
			description: e?.message || 'Failed to start the OAuth flow.',
			color: 'error',
			icon: 'mdi:account-alert',
			duration: 6000
		});
	}
}

async function confirmDelete() {
	if (!user.value) return;
	if (!canDelete.value) return;

	loading.value = true;
	try {
		const res = await deleteAccount(recentlyAuthenticated.value ? null : password.value || null);
		if (res.success) {
			toast.add({
				title: 'Account Deleted',
				description: 'Your account and data have been permanently removed.',
				color: 'success',
				icon: 'mdi:account-check',
				duration: 6000
			});
			emit('deleted');
			return;
		}

		// 403 REAUTH_REQUIRED from mantle means the window expired between checks
		const message = res.message || 'Failed to delete account.';
		const isReauthRequired = (res as any).reason === 'REAUTH_REQUIRED' || /reauth/i.test(message);

		toast.add({
			title: isReauthRequired ? 'Reauthentication Required' : 'Could Not Delete Account',
			description: isReauthRequired
				? 'Your sign-in window has expired. Please reauthenticate and try again.'
				: message,
			color: 'error',
			icon: 'mdi:account-alert',
			duration: 6000
		});

		if (isReauthRequired) {
			recentlyAuthenticated.value = false;
			await refreshReauthState();
		}

		console.error(message);
	} catch (e: any) {
		toast.add({
			title: 'Network Error',
			description: e?.message || 'Could not reach the server. Please try again.',
			color: 'error',
			icon: 'mdi:wifi-alert',
			duration: 6000
		});
	} finally {
		loading.value = false;
	}
}
</script>
