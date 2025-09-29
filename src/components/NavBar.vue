<template>
	<div
		id="navbar"
		class="bg-secondary-800 border-b-primary-500 border-b-8 text-white p-4 flex items-center"
	>
		<div class="flex items-center w-2/3">
			<NuxtLink to="/">
				<img
					src="/favicon.png"
					alt="Earth App Logo"
					class="min-w-8 w-8 h-auto xl:w-12 inline-block mr-2 shadow-lg shadow-black/50 rounded-full hover:scale-105 transition-transform duration-300"
				/>
			</NuxtLink>
			<Discover class="mx-2 sm:ml-4 md:ml-8 lg:ml-12" />
			<div class="hidden sm:flex items-center mr-12 space-x-4">
				<NuxtLink
					to="/activities"
					class="text-md md:text-xl lg:text-2xl font-semibold hover:text-gray-300 mx-6"
					>Activities</NuxtLink
				>
				<NuxtLink
					to="/prompts"
					class="text-md md:text-xl lg:text-2xl font-semibold hover:text-gray-300 mx-6"
					>Prompts</NuxtLink
				>
				<NuxtLink
					to="/articles"
					class="text-md md:text-xl lg:text-2xl font-semibold hover:text-gray-300 mx-6"
					>Articles</NuxtLink
				>
			</div>
		</div>
		<ClientOnly>
			<div class="ml-auto">
				<div
					v-if="user"
					class="flex items-center space-x-1 sm:space-x-6"
				>
					<div
						class="flex items-center justify-center space-x-1 cursor-pointer hover:opacity-80 transition-opacity duration-250"
						@click="$router.push(`/profile/@${user.username}`)"
					>
						<UAvatar
							:src="avatar"
							class="size-6 md:size-8 lg:size-12 rounded-full shadow-lg shadow-black/50"
						/>

						<span
							class="font-title text-md sm:text-lg md:text-xl text-shadow-2xs text-shadow-black"
							>{{ user.username }}</span
						>
					</div>
					<div class="flex space-x-4 items-center justify-center">
						<UPopover mode="hover">
							<NuxtLink
								to="/profile/notifications"
								class="size-4 lg:size-8 relative"
							>
								<UChip
									:color="chipColor"
									:show="unreadCount > 0"
									:ui="{ base: 'size-2 lg:size-3' }"
									class="m-0"
								>
									<UIcon
										name="mdi:bell"
										class="size-4 lg:size-8 hover:cursor-pointer"
									/>
								</UChip>
							</NuxtLink>

							<template #content>
								<div class="w-85 max-h-96">
									<UserNotificationList />
								</div>
							</template>
						</UPopover>
						<NuxtLink
							class="size-4 lg:size-8"
							to="/profile"
						>
							<UIcon
								name="material-symbols:settings-rounded"
								class="size-4 lg:size-8 text-white cursor-pointer hover:scale-105 transition-transform duration-300"
							/>
						</NuxtLink>
						<NuxtLink
							class="size-4 lg:size-8"
							to="/"
						>
							<UIcon
								name="material-symbols:logout-rounded"
								class="size-4 lg:size-8 text-red-500 cursor-pointer hover:scale-105 transition-transform duration-300"
								@click="logoutUser"
							/>
						</NuxtLink>
					</div>
				</div>
				<div
					v-else
					class="flex items-center"
				>
					<UserSignupPopup />
					<UserLoginPopup />
				</div>
			</div>
		</ClientOnly>
	</div>
	<ClientOnly>
		<UBanner
			v-if="user?.account.email_verified === false"
			class="mb-4"
			icon="mdi:email-alert"
			title="Your email is unverified. Please verify your email to access all features."
			color="warning"
			:ui="{ root: 'flex items-center', title: 'font-semibold' }"
			:actions="actions"
			close
		>
		</UBanner>
		<UserEmailVerificationModal
			v-model:open="emailVerificationOpen"
			@verified="
				() => {
					if (user) {
						user.account.email_verified = true;
					}

					emailVerificationOpen = false;
				}
			"
		/>
	</ClientOnly>
</template>

<script setup lang="ts">
import { useLogout } from '~/compostables/useLogin';
import { sendVerificationEmail, useAuth, useNotifications } from '~/compostables/useUser';

const { user, photo } = useAuth();
const logout = useLogout();
const avatar = ref<string>('https://cdn.earth-app.com/earth-app.png');
watch(
	() => photo.value,
	(photo) => {
		if (photo) {
			if (avatar.value && avatar.value.startsWith('blob:')) URL.revokeObjectURL(avatar.value);

			const blob = URL.createObjectURL(photo);
			avatar.value = blob;
		}
	},
	{ immediate: true }
);

onBeforeUnmount(() => {
	if (avatar.value && avatar.value.startsWith('blob:')) URL.revokeObjectURL(avatar.value);
});

const toast = useToast();
async function logoutUser() {
	await logout();

	avatar.value = 'https://cdn.earth-app.com/earth-app.png';
	user.value = null;
	photo.value = null;

	toast.add({
		title: 'Logged out',
		description: 'You have successfully logged out.',
		icon: 'mdi:logout',
		color: 'success',
		duration: 3000
	});
}

const { hasWarnings, hasErrors, unreadCount } = useNotifications();
const chipColor = computed(() => {
	if (hasErrors.value) return 'error';
	if (hasWarnings.value) return 'warning';
	if (unreadCount.value > 0) return 'info';

	return 'neutral';
});

const emailVerificationOpen = ref(false);
const actions = ref<
	{
		label: string;
		color: 'info' | 'neutral';
		variant: 'outline';
		trailingIcon: string;
		ui?: any;
		onClick: () => void;
	}[]
>([
	{
		label: 'Resend',
		color: 'neutral',
		variant: 'outline',
		trailingIcon: 'mdi:email-arrow-right',
		ui: { base: 'hover:cursor-pointer' },
		onClick: async () => {
			const result = await resendEmailVerification();
			if (result) {
				emailVerificationOpen.value = true;
			}
		}
	}
]);

async function resendEmailVerification(): Promise<boolean> {
	if (!user.value) return false;

	const toast = useToast();
	if (user.value.account.email_verified) {
		toast.add({
			title: 'Email Already Verified',
			description: 'Your email is already verified.',
			icon: 'mdi:check-circle',
			color: 'info',
			duration: 3000
		});
		return false;
	}

	if (user.value.email_change_pending) {
		toast.add({
			title: 'Email Change Pending',
			description: 'You have a pending email change. Please verify your new email address.',
			icon: 'mdi:email-arrow-right',
			color: 'info',
			duration: 3000
		});
		return false;
	}

	sendVerificationEmail().then((res) => {
		if (res.success && res.data) {
			toast.add({
				title: 'Verification Email Sent',
				description: 'A verification email has been sent to your email address.',
				icon: 'mdi:check-circle',
				color: 'success',
				duration: 3000
			});
		} else {
			toast.add({
				title: 'Error Sending Email',
				description: res.message || 'An error occurred while sending the verification email.',
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 5000
			});
		}
	});

	return true;
}
</script>
