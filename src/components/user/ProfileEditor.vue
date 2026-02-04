<template>
	<div class="flex flex-col items-center w-full mt-6">
		<div class="flex flex-col items-center mb-8">
			<UAvatar
				:src="avatar"
				class="w-32 h-32 rounded-full shadow-lg shadow-black/50 mb-4 hover:scale-110 transition-transform duration-300 hover:cursor-pointer"
				id="avatar"
				title="Click to Preview Profile"
				@click="navigateTo(`/profile/@${user.username}`)"
				width="128"
				height="128"
			/>
			<UButton
				icon="material-symbols:refresh"
				:loading="avatarLoading"
				class="w-44 font-semibold text-center"
				@click="regenerateProfilePhoto"
			>
				Regenerate Avatar
			</UButton>
		</div>

		<h1 class="text-6xl sm:text-7xl md:text-8xl font-bold mb-2">Profile</h1>
		<div class="flex flex-row items-center space-x-1.5 mb-4">
			<EditableValue
				v-model="first_name"
				class="text-3xl w-32"
				size="xl"
				placeholder="John"
				:onFinish="updateUser"
			/>
			<EditableValue
				v-model="last_name"
				class="text-3xl w-32"
				size="xl"
				placeholder="Doe"
				:onFinish="updateUser"
			/>
		</div>
		<EditableValue
			v-model="username"
			class="text-xl"
			size="xl"
			:onFinish="updateUser"
		/>

		<h3 class="text-2xl font-semibold text-gray-200 mt-8">Bio</h3>
		<EditableValue
			v-model="bio"
			class="text-lg mt-2 w-3/4"
			size="xl"
			placeholder="Tell us about yourself..."
			:onFinish="updateUser"
		/>

		<h3
			class="text-2xl font-semibold text-gray-200 mt-8"
			id="activities"
		>
			Activities
		</h3>
		<ActivitySelector
			v-model="userActivities"
			class="min-w-105 w-3/7 max-w-140 mt-2"
			@update:modelValue="updateActivities"
		/>

		<h3
			class="text-2xl font-semibold text-gray-200 mt-10"
			id="settings"
		>
			Settings
		</h3>
		<div class="px-4 mt-2 border-t-4 border-black dark:border-white w-full max-w-4xl">
			<div class="mt-4 w-full flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:gap-x-4">
				<h2 class="text-xl font-medium">Account Visibility</h2>
				<div class="w-full flex flex-col sm:flex-row gap-2">
					<ClientOnly>
						<UDropdownMenu
							title="Visibility Settings"
							:items="accountVisibilityOptions"
							:ui="{ content: 'w-48' }"
						>
							<UButton
								:icon="'mdi:eye'"
								:label="
									accountVisibilityOptions.find((opt: any) => opt.value === accountVisibility)
										?.label || 'Select Visibility'
								"
								color="neutral"
								variant="outline"
								:loading="visibilityLoading"
								class="w-full min-w-48"
							/>
							<template #item="{ item }">
								<button
									class="flex items-center w-full px-2 py-1.5 gap-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
									@click="updateAccountVisibility(item.value)"
								>
									<div class="flex flex-col">
										<div class="flex flex-row items-center gap-1">
											<UIcon :name="item.icon || 'mdi:lock'" />
											<span class="font-medium text-xs sm:text-sm">
												{{ item.label }}
											</span>
										</div>
										<span
											v-if="item.description"
											class="text-xs text-gray-500"
											>{{ item.description }}</span
										>
									</div>
								</button>
							</template>
						</UDropdownMenu>
						<template #fallback>
							<UButton
								:icon="'mdi:eye'"
								:label="
									accountVisibilityOptions.find((opt: any) => opt.value === accountVisibility)
										?.label || 'Select Visibility'
								"
								color="neutral"
								variant="outline"
								disabled
								class="w-full sm:w-auto min-w-48"
							/>
						</template>
					</ClientOnly>
				</div>
			</div>
			<div
				v-for="(prop, i) in props.filter((p) => p.disabled !== true)"
				:key="prop.id"
				class="mt-4 w-full flex flex-col lg:grid lg:grid-cols-3 gap-2 lg:gap-x-4"
			>
				<h2 class="text-md sm:text-lg md:text-xl flex">
					{{ prop.name
					}}<span
						v-if="prop.unverified === true"
						class="relative text-xs font-bold pl-1 text-orange-300 hover:cursor-pointer"
						:title="`${prop.name} not verified`"
						>!</span
					>
				</h2>
				<UserFieldPrivacyDropdown
					:user="user"
					:label="getLabel(prop.id)"
					:field="prop.id"
				/>
				<div class="flex gap-4 justify-between items-start shrink-0">
					<div class="flex-1 min-w-fit">
						<EditableValue
							v-if="prop.type !== 'dropdown' && prop.computed"
							v-model="prop.computed.value"
							class="text-md sm:text-lg"
							size="lg"
							:type="prop.type"
							:onFinish="updateUser"
							:disabled="prop.disabled"
						/>
						<ClientOnly>
							<UInputMenu
								v-if="prop.type === 'dropdown' && prop.computed"
								:model-value="
									prop.dropdownItems?.find((item) => item.value === prop.computed!.value)
								"
								@update:model-value="updateCountry"
								:items="prop.dropdownItems"
								placeholder="Select a country..."
								class="w-full sm:w-auto min-w-48"
								size="lg"
								searchable
								:loading="countriesLoading || countryUpdating"
								:ui="{
									content: 'h-48 overflow-y-auto',
									trailingIcon: 'text-primary'
								}"
							>
								<template #leading>
									<span class="text-xl">{{
										prop.dropdownItems?.find((item) => item.value === prop.computed!.value)?.icon
									}}</span>
								</template>
								<template #item="{ item }">
									<div class="flex items-center gap-2">
										<span class="text-xl">{{ item.icon }}</span>
										<span>{{ item.label }}</span>
									</div>
								</template>
							</UInputMenu>
							<template #fallback>
								<UButton
									v-if="prop.type === 'dropdown' && prop.computed"
									class="w-full sm:w-auto min-w-48 text-left"
									:icon="prop.computed.value ? 'mdi:building' : 'mdi:chevron-down'"
									:label="prop.computed.value?.toString() || prop.name"
									color="primary"
									variant="outline"
									disabled
								/>
							</template>
						</ClientOnly>
					</div>
					<ClientOnly>
						<UBadge
							v-if="prop.unverified === true"
							class="mt-1 transition-all duration-300 hover:cursor-pointer shrink-0"
							color="warning"
							:variant="badgeVariants[i] || 'outline'"
							@mouseenter="badgeVariants[i] = 'solid'"
							@mouseleave="badgeVariants[i] = 'outline'"
							@click="if (prop.verify) prop.verify();"
							role="button"
							:aria-label="`Verify ${prop.name}`"
							tabindex="0"
							@keydown.enter="if (prop.verify) prop.verify();"
							@keydown.space.prevent="if (prop.verify) prop.verify();"
							>Unverified</UBadge
						>
					</ClientOnly>
				</div>
			</div>
			<div class="w-full flex flex-col items-center">
				<div class="flex flex-col w-full max-w-3xl items-center my-4">
					<h2 class="text-xl font-medium flex-1 mb-1">OAuth Providers</h2>
					<div class="flex">
						<UserOAuthButton
							v-for="provider in OAUTH_PROVIDERS"
							:key="provider"
							:provider="provider"
							:linked="user.account.linked_providers.includes(provider)"
							class="mx-2"
						/>
					</div>
				</div>
				<div class="flex flex-col w-full max-w-3xl items-center mb-6">
					<USeparator class="my-4" />
					<div class="flex items-center justify-center gap-4 w-full">
						<USwitch
							v-model="subscribed"
							:loading="subscribedLoading"
							color="info"
							checked-icon="mdi:email-check"
							unchecked-icon="mdi:email-off"
							label="Email Notifications"
							class="py-1 px-2 border rounded-md border-blue-500"
							:ui="{ label: 'font-semibold text-blue-400', base: 'hover:cursor-pointer' }"
						/>
						<UserPasswordChangeModal
							ref="passwordChangeModal"
							@changed="handlePasswordChange"
						>
							<UButton
								color="warning"
								variant="outline"
								trailing-icon="mdi:shield-lock"
								class="font-semibold hover:cursor-pointer"
								@click="passwordChangeModal?.open()"
							>
								Change Password
							</UButton>
						</UserPasswordChangeModal>
						<UserDeleteAccountModal @deleted="handleAccountDeletion">
							<UButton
								color="error"
								variant="outline"
								trailing-icon="mdi:account-cancel"
								class="font-semibold hover:cursor-pointer"
							>
								Delete Account
							</UButton>
						</UserDeleteAccountModal>
					</div>
				</div>
			</div>
		</div>
		<UserEmailVerificationModal
			ref="emailVerificationModal"
			@verified="handleEmailVerified"
		/>
	</div>
</template>

<script setup lang="ts">
import { com } from '@earth-app/ocean';
import type { InputTypeHTMLAttribute } from 'vue';
import { OAUTH_PROVIDERS, type User } from '~/shared/types/user';
import { capitalizeFully } from '~/shared/util';
import { type EmailVerificationModalRef } from './email/VerificationModal.vue';
import { type PasswordChangeModalRef } from './PasswordChangeModal.vue';

const componentProps = defineProps<{
	user: User;
	title?: string;
}>();

const toast = useToast();
const router = useRouter();

const user = ref(componentProps.user);
const changed = ref(false);

const createAccountProp = (key: string) =>
	computed({
		get: () => (user.value?.account as any)?.[key] ?? '',
		set: (value) => {
			if (user.value?.account) {
				(user.value.account as any)[key] = value;
				changed.value = true;
			}
		}
	});

// Create the computed refs directly
const first_name = createAccountProp('first_name');
const last_name = createAccountProp('last_name');
const username = createAccountProp('username');
const bio = createAccountProp('bio');

const email = createAccountProp('email');
const address = createAccountProp('address');
const phoneNumber = createAccountProp('phone_number');
const country = createAccountProp('country');

const countriesLoading = ref(true);
const countryUpdating = ref(false);

const props: {
	name: string;
	id: keyof User['account']['field_privacy'];
	type?: InputTypeHTMLAttribute | 'dropdown';
	dropdownItems?: { label: string; value: string; icon?: string }[];
	computed?: globalThis.Ref<string | number>;
	disabled?: boolean;
	unverified?: boolean;
	verify?: () => Promise<boolean>;
}[] = [
	{
		name: 'Email Address',
		id: 'email',
		type: 'email',
		computed: email,
		get unverified() {
			return user.value.account.email != null && !user.value.account.email_verified;
		},
		verify: async () => {
			const result = handleSendVerificationEmail();
			emailVerificationModal.value?.open();
			return await result;
		}
	},
	{
		name: 'Address',
		id: 'address',
		type: 'text',
		computed: address
	},
	{
		name: 'Phone Number',
		id: 'phone_number',
		type: 'tel',
		computed: phoneNumber,
		disabled: true // TODO Implement phone number verification
	},
	{
		name: 'Country',
		id: 'country',
		type: 'dropdown',
		get dropdownItems() {
			const countries = com.earthapp.account.Country.values().map((country) => ({
				label: country.countryName,
				value: country.code,
				icon: country.flagEmoji,
				disabled: !country.code
			}));
			countriesLoading.value = false;
			return countries;
		},
		computed: country
	},
	{
		name: 'Activities',
		id: 'activities'
	},
	{
		name: 'Biography',
		id: 'bio'
	}
];

const badgeVariants = ref<('outline' | 'solid')[]>(new Array(props.length).fill('outline'));

function sanitize(obj: User['account']): Partial<User['account']> {
	return {
		first_name: obj.first_name ? obj.first_name?.trim() || '' : undefined,
		last_name: obj.last_name ? obj.last_name?.trim() || '' : undefined,
		username: obj.username ? obj.username?.trim() || '' : undefined,
		bio: obj.bio ? obj.bio?.trim() || '' : undefined,
		email: obj.email ? obj.email?.trim() || '' : undefined,
		address: obj.address ? obj.address?.trim() || '' : undefined,
		country: obj.country ? obj.country?.trim() || '' : undefined,
		phone_number: obj.phone_number ? obj.phone_number : undefined,
		visibility: obj.visibility
	};
}

async function updateUser() {
	if (user.value) {
		if (!changed.value) return true;

		const res = await updateAccount(sanitize(user.value.account));
		if (!res.success) {
			return res.message || 'Failed to update profile.';
		}

		toast.add({
			title: 'Profile Updated!',
			description: 'Your profile has been successfully updated.',
			color: 'success',
			icon: 'mdi:check-circle',
			duration: 3000
		});

		return true;
	}

	return 'User not found.';
}

async function updateCountry(item: any) {
	if (!user.value) return;

	const newValue = item?.value || '';
	if (country.value === newValue) return;

	country.value = newValue;
	changed.value = true;

	countryUpdating.value = true;
	const result = await updateUser();
	countryUpdating.value = false;

	return result;
}

function getLabel(key: keyof User['account']['field_privacy']): string {
	const enumeration = user.value.account.field_privacy[key] ?? 'PRIVATE';
	return capitalizeFully(enumeration);
}

// Profile Photo

const { avatar: oldAvatar, fetchUser: refetchUser } = useUser(user.value.id);
const avatarLoading = ref(false);
const avatarOverride = ref<string | null>(null);

const avatar = computed(() => avatarOverride.value || oldAvatar.value || undefined);

onBeforeUnmount(() => {
	if (avatarOverride.value && avatarOverride.value.startsWith('blob:')) {
		URL.revokeObjectURL(avatarOverride.value);
	}
});

async function regenerateProfilePhoto() {
	if (!confirm('Are you sure? You cannot revert this action.')) return;

	avatarLoading.value = true;

	const res = await regenerateAvatar();
	if (res.success && res.data && res.data instanceof Blob) {
		if (avatarOverride.value && avatarOverride.value.startsWith('blob:')) {
			URL.revokeObjectURL(avatarOverride.value);
		}

		// clear cached blob URLs to force refetch
		const cachedBlobUrls = useState<{
			avatar: string | null;
			avatar32: string | null;
			avatar128: string | null;
		} | null>(`user-avatar-blobs-${user.value.id}`, () => null);

		if (cachedBlobUrls.value) {
			const avatar = cachedBlobUrls.value.avatar;
			const avatar32 = cachedBlobUrls.value.avatar32;
			const avatar128 = cachedBlobUrls.value.avatar128;

			if (avatar?.startsWith('blob:')) URL.revokeObjectURL(avatar);
			if (avatar32?.startsWith('blob:')) URL.revokeObjectURL(avatar32);
			if (avatar128?.startsWith('blob:')) URL.revokeObjectURL(avatar128);

			cachedBlobUrls.value = null;
		}

		avatarOverride.value = URL.createObjectURL(res.data);
		refetchUser();

		avatarLoading.value = false;
		toast.add({
			title: 'Avatar Regenerated',
			description: 'Your profile photo has been successfully regenerated.',
			color: 'success',
			icon: 'mdi:account-box-plus-outline',
			duration: 3000
		});
	} else {
		avatarLoading.value = false;
		console.error(res.message || 'Failed to regenerate profile photo.');

		toast.add({
			title: 'Error',
			description: res.message || 'Failed to regenerate profile photo.',
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 5000
		});
	}
}

// Activities

const userActivities = computed({
	get: () => user.value?.activities || [],
	set: (value: any) => {
		// value will be an array of activity IDs from the selector
		// We don't update user.value.activities directly here
	}
});

function updateActivities(activityIds: string[]) {
	if (!user.value) return;

	if (activityIds.length === 0) return;

	setUserActivities(activityIds).then((res) => {
		if (res.success && res.data && 'activities' in res.data) {
			user.value.activities = res.data.activities;
			toast.add({
				title: 'Activities Updated',
				description: 'Your activities have been successfully updated.',
				color: 'success',
				icon: 'mdi:check-circle',
				duration: 3000
			});
		} else {
			console.error(res.message || 'Failed to update activities.');
			toast.add({
				title: 'Error',
				description: res.message || 'Failed to update activities.',
				icon: 'mdi:alert',
				color: 'error',
				duration: 5000
			});
		}
	});
}

// Account Privacy
const accountVisibility = computed({
	get: () => user.value.account.visibility,
	set: (value) => {
		user.value.account.visibility = value;
	}
});

const accountVisibilityOptions = com.earthapp.Visibility.values().map((value) => ({
	label: capitalizeFully(value.name),
	value: value.name,
	icon: ['mdi:lock', 'mdi:account-box', 'mdi:office-building'][value.ordinal],
	description: [
		'Only you and friends can see',
		'Invisible to search and anonymous users',
		'Everyone can see'
	][value.ordinal]
}));

const visibilityLoading = ref(false);

async function updateAccountVisibility(value: User['account']['visibility']) {
	if (value === accountVisibility.value) return;

	accountVisibility.value = value;

	visibilityLoading.value = true;
	const res = await updateAccount(sanitize(user.value.account));
	visibilityLoading.value = false;

	if (res.success) {
		toast.add({
			title: 'Privacy Updated',
			description: 'Your account privacy has been successfully updated.',
			color: 'success',
			icon: 'mdi:check-circle',
			duration: 3000
		});
	} else {
		console.error(res.message || 'Failed to update account privacy.');
		toast.add({
			title: 'Error',
			description: res.message || 'Failed to update account privacy.',
			color: 'error',
			duration: 5000
		});
	}

	visibilityLoading.value = false;
}

// Email Verification
const emailVerificationModal = ref<EmailVerificationModalRef | null>(null);

async function handleSendVerificationEmail(): Promise<boolean> {
	if (!user.value) {
		toast.add({
			title: 'Error',
			description: 'User not found.',
			color: 'error',
			icon: 'mdi:alert-circle',
			duration: 5000
		});
		return false;
	}

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
				description:
					res.data.message || 'A verification email has been sent to your email address.',
				color: 'success',
				icon: 'mdi:email-check',
				duration: 5000
			});
			return true;
		} else {
			console.error(res.message || 'Failed to send verification email.');
			toast.add({
				title: 'Error',
				description: res.message || 'Failed to send verification email.',
				color: 'error',
				icon: 'mdi:alert-circle',
				duration: 5000
			});
			return false;
		}
	});

	return true;
}

function handleEmailVerified() {
	if (user.value) {
		user.value.account.email_verified = true;

		// Update the global auth state if this is the current user
		const { user: authUser } = useAuth();
		if (authUser.value && authUser.value.id === user.value.id) {
			authUser.value.account.email_verified = true;
		}

		// Show success toast
		toast.add({
			title: 'Email Verified',
			description: 'Your email address has been successfully verified.',
			color: 'success',
			icon: 'mdi:email-check',
			duration: 5000
		});
	}
	emailVerificationModal.value?.close();
}

// Password Change
const passwordChangeModal = ref<PasswordChangeModalRef | null>(null);

function handlePasswordChange() {
	toast.add({
		title: 'Password Changed',
		description: 'Your password has been successfully changed.',
		color: 'success',
		icon: 'mdi:lock-check-outline',
		duration: 5000
	});

	passwordChangeModal.value?.close();
}

// Email Newsletter Subscription
const subscribed = computed({
	get: () => user.value.account.subscribed || false,
	set: (value) => {
		user.value.account.subscribed = value;
	}
});

const subscribedLoading = ref(false);

watch(subscribed, async (newValue) => {
	subscribedLoading.value = true;
	const res = await updateAccount({ subscribed: newValue });
	if (res.success) {
		toast.add({
			title: 'Subscription Updated',
			description: `Email notifications ${newValue ? 'enabled' : 'disabled'}.`,
			color: 'success',
			icon: 'mdi:check-circle',
			duration: 3000
		});
	} else {
		console.error(res.message || 'Failed to update subscription.');
		toast.add({
			title: 'Error',
			description: res.message || 'Failed to update subscription.',
			color: 'error',
			icon: 'mdi:alert-circle',
			duration: 5000
		});
	}

	subscribedLoading.value = false;
});

// Account Deletion
function handleAccountDeletion() {
	// Remove session token
	const sessionCookie = useCookie('session_token');
	sessionCookie.value = null;

	// Clear state
	refreshNuxtData();

	// Redirect to homepage
	router.push('/');
	toast.add({
		title: 'Account Deleted',
		description: 'Your account has been successfully deleted.',
		color: 'success',
		icon: 'mdi:account-cancel',
		duration: 5000
	});
}
</script>
