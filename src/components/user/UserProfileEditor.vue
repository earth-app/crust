<template>
	<div class="flex flex-col items-center w-full mt-6">
		<div class="flex flex-col items-center mb-8">
			<UAvatar
				:src="avatar"
				class="w-32 h-32 rounded-full shadow-lg shadow-black/50 mb-4 hover:scale-110 transition-transform duration-300 hover:cursor-pointer"
				title="Click to Preview Profile"
				@click="navigateTo(`/profile/@${user.username}`)"
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

		<h1 class="text-8xl font-bold mb-2">Profile</h1>
		<div class="flex flex-row items-center space-x-1.5 mb-4">
			<EditableValue
				v-model="firstName"
				class="text-3xl w-32"
				size="xl"
				placeholder="John"
				:onFinish="updateUser"
			/>
			<EditableValue
				v-model="lastName"
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

		<h3 class="text-2xl text-gray-600 italic mt-8 underline">Bio</h3>
		<EditableValue
			v-model="bio"
			class="text-lg mt-2 w-3/4"
			size="xl"
			placeholder="Tell us about yourself..."
			:onFinish="updateUser"
		/>

		<h3 class="text-2xl text-gray-600 italic mt-8 underline">Activities</h3>
		<ClientOnly>
			<UInputMenu
				placeholder="Select your activities..."
				v-model="currentActivities"
				:items="allActivities"
				size="xl"
				class="w-2/7 mt-2"
				multiple
				deleteIcon="i-lucide-trash"
				:disabled="activitiesLoading"
				:loading="activitiesLoading"
				@update:modelValue="updateActivities"
			/>
			<template #fallback>
				<div class="w-2/7 mt-2 p-2 border rounded-md text-gray-500">Loading activities...</div>
			</template>
		</ClientOnly>

		<h3 class="text-2xl text-gray-600 italic mt-10 underline">Settings</h3>
		<div class="mt-2 border-t-4 border-black dark:border-white w-2/5 min-w-144">
			<div class="mt-4 w-full grid grid-cols-3 gap-x-4">
				<h2 class="text-xl">Account Visibility</h2>
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
						/>
						<template #item="{ item }">
							<button
								class="flex items-center w-full px-2 py-1.5 gap-2 text-left"
								@click="updateAccountVisibility(item.value)"
							>
								<div class="flex flex-col">
									<div class="flex flex-row items-center gap-1">
										<UIcon :name="item.icon || 'mdi:lock'" />
										<span class="font-medium text-sm">
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
						/>
					</template>
				</ClientOnly>
			</div>
			<div
				v-for="prop in props.filter((p) => p.disabled !== true)"
				class="mt-4 w-full grid grid-cols-3 gap-x-4"
			>
				<h2 class="text-xl">{{ prop.name }}</h2>
				<UserFieldPrivacyDropdown
					:user="user"
					:label="getLabel(prop.id)"
					:field="prop.id"
				/>
				<EditableValue
					v-if="prop.type !== 'dropdown' && prop.computed"
					v-model="prop.computed.value"
					class="text-lg mt-2"
					size="lg"
					:type="prop.type"
					:onFinish="updateUser"
					:disabled="prop.disabled"
				/>
				<ClientOnly>
					<UDropdownMenu
						v-if="prop.type === 'dropdown' && prop.computed"
						:items="prop.dropdownItems"
						:value="prop.computed.value"
						@update:value="(value: string) => (prop.computed!.value = value)"
						:ui="{
							content: 'h-48 overflow-y-auto'
						}"
					>
						<UButton
							class="w-full text-left"
							:icon="prop.computed.value ? 'mdi:building' : 'mdi:chevron-down'"
							:label="prop.computed.value?.toString() || prop.name"
							color="primary"
							variant="outline"
						/>
						<template #item="{ item }">
							<UButton
								:label="item.label"
								class="w-full text-left font-bold"
								color="secondary"
								@click="prop.computed.value = item.value"
							/>
						</template>
					</UDropdownMenu>
					<template #fallback>
						<UButton
							v-if="prop.type === 'dropdown' && prop.computed"
							class="w-full text-left"
							:icon="prop.computed.value ? 'mdi:building' : 'mdi:chevron-down'"
							:label="prop.computed.value?.toString() || prop.name"
							color="primary"
							variant="outline"
							disabled
						/>
					</template>
				</ClientOnly>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { UButton } from '#components';
import { com } from '@earth-app/ocean';
import type { InputTypeHTMLAttribute } from 'vue';
import { getAllActivities } from '~/compostables/useActivity';
import * as useUser from '~/compostables/useUser';
import type { User } from '~/shared/types/user';
import { capitalizeFully } from '~/shared/util';

const componentProps = defineProps<{
	user: User;
	title?: string;
}>();

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
const firstName = createAccountProp('firstName');
const lastName = createAccountProp('lastName');
const username = createAccountProp('username');
const bio = createAccountProp('bio');

const email = createAccountProp('email');
const address = createAccountProp('address');
const phoneNumber = createAccountProp('phone_number');
const country = createAccountProp('country');

const props: {
	name: string;
	id: keyof User['account']['field_privacy'];
	type?: InputTypeHTMLAttribute | 'dropdown';
	dropdownItems?: { label: string; value: string }[];
	computed?: globalThis.Ref<string | number>;
	disabled?: boolean;
}[] = [
	{
		name: 'Email Address',
		id: 'email',
		type: 'email',
		computed: email,
		disabled: true // TODO Implement email verification
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
		dropdownItems: com.earthapp.account.Country.values().map((country) => ({
			label: `${country.flagEmoji} ${country.countryName}`,
			value: country.code
		})),
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

function sanitize(obj: User['account']): Partial<User['account']> {
	return {
		firstName: obj.firstName ? obj.firstName?.trim() || '' : undefined,
		lastName: obj.lastName ? obj.lastName?.trim() || '' : undefined,
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

		const res = await useUser.updateAccount(sanitize(user.value.account));
		if (!res.success) {
			return res.message || 'Failed to update profile.';
		}

		const toast = useToast();
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

function getLabel(key: keyof User['account']['field_privacy']): string {
	const enumeration = user.value.account.field_privacy[key] ?? 'PRIVATE';
	return capitalizeFully(enumeration);
}

// Profile Photo

const avatar = ref<string>('/favicon.png');
let objectUrl: string | undefined = undefined;
const avatarLoading = ref(false);

onMounted(async () => {
	const res = await useUser.getUserAvatar(user.value.id);
	if (res.success && res.data) {
		if (objectUrl) URL.revokeObjectURL(objectUrl);

		objectUrl = URL.createObjectURL(res.data);
		avatar.value = objectUrl;
	}
});

onBeforeUnmount(() => {
	if (objectUrl) URL.revokeObjectURL(objectUrl);
});

async function regenerateProfilePhoto() {
	if (!confirm('Are you sure? You cannot revert this action.')) return;

	avatarLoading.value = true;

	const res = await useUser.regenerateAvatar();
	if (res.data) {
		if (objectUrl) URL.revokeObjectURL(objectUrl);
		objectUrl = URL.createObjectURL(res.data);
		avatar.value = objectUrl;
		avatarLoading.value = false;

		const toast = useToast();
		toast.add({
			title: 'Avatar Regenerated',
			description: 'Your profile photo has been successfully regenerated.',
			color: 'success',
			icon: 'mdi:check-circle',
			duration: 3000
		});
	} else {
		avatarLoading.value = false;
		console.error(res.message || 'Failed to regenerate profile photo.');

		const toast = useToast();
		toast.add({
			title: 'Error',
			description: res.message || 'Failed to regenerate profile photo.',
			color: 'error',
			duration: 5000
		});
	}
}

// Activities

const allActivities = ref<{ label: string; value: string; icon: string }[]>([]);
const currentActivities = ref<{ label: string; value: string; icon: string }[]>([]);

onMounted(async () => {
	const res = await getAllActivities();
	if (res.success) {
		const activities =
			res.data?.map((activity) => {
				return {
					label: activity.name,
					value: activity.id,
					icon: activity.fields['icon'] || 'material-symbols:activity-zone'
				};
			}) || [];
		allActivities.value = activities;

		// Initialize current activities from user data
		if (user.value?.account?.activities) {
			currentActivities.value = user.value.account.activities
				.map((userActivity) => {
					return {
						label: userActivity.name,
						value: userActivity.id,
						icon: userActivity.fields['icon'] || 'material-symbols:activity-zone'
					};
				})
				.filter(Boolean);
		}
	} else {
		console.error(res.message || 'Failed to fetch activities.');
	}
});

watch(
	() => user.value?.account?.activities,
	(newActivities) => {
		if (newActivities && allActivities.value.length > 0) {
			currentActivities.value = newActivities.map((activity) => {
				return {
					label: activity.name,
					value: activity.id,
					icon: activity.fields['icon'] || 'material-symbols:activity-zone'
				};
			});
		}
	},
	{ deep: true }
);

const activitiesLoading = ref(false);
async function updateActivities() {
	if (!user.value) return;

	if (currentActivities.value.length === 0) return;
	if (currentActivities.value.length >= 10) {
		const toast = useToast();
		toast.add({
			title: 'Too Many Activities',
			description: 'You can only select up to 10 activities.',
			color: 'warning',
			duration: 5000
		});
		return;
	}

	activitiesLoading.value = true;
	const res = await useUser.setUserActivities(
		currentActivities.value.map((activity) => activity.value as string)
	);
	activitiesLoading.value = false;
	if (res.success && res.data) {
		user.value.account.activities = res.data.account.activities;

		const toast = useToast();
		toast.add({
			title: 'Activities Updated',
			description: 'Your activities have been successfully updated.',
			color: 'success',
			icon: 'mdi:check-circle',
			duration: 3000
		});
	} else {
		console.error(res.message || 'Failed to update activities.');
		const toast = useToast();
		toast.add({
			title: 'Error',
			description: res.message || 'Failed to update activities.',
			color: 'error',
			duration: 5000
		});
	}

	activitiesLoading.value = false;
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
	const res = await useUser.updateAccount(sanitize(user.value.account));
	visibilityLoading.value = false;

	if (res.success) {
		const toast = useToast();
		toast.add({
			title: 'Privacy Updated',
			description: 'Your account privacy has been successfully updated.',
			color: 'success',
			icon: 'mdi:check-circle',
			duration: 3000
		});
	} else {
		console.error(res.message || 'Failed to update account privacy.');
		const toast = useToast();
		toast.add({
			title: 'Error',
			description: res.message || 'Failed to update account privacy.',
			color: 'error',
			duration: 5000
		});
	}

	visibilityLoading.value = false;
}
</script>
