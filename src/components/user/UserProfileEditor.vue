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

		<h3 class="text-md text-gray-600 italic mt-8">Bio</h3>
		<EditableValue
			v-model="bio"
			class="text-lg mt-2 w-3/4"
			size="lg"
			placeholder="Tell us about yourself..."
			:onFinish="updateUser"
		/>
		<div class="mt-12 border-t-4 border-black dark:border-white w-2/5 min-w-144">
			<div
				v-for="prop in props"
				class="mt-4 w-full grid grid-cols-3 gap-x-4"
			>
				<h2 class="text-xl">{{ prop.name }}</h2>
				<UserFieldPrivacyDropdown
					:user="user"
					:label="getLabel(prop.id)"
					:field="prop.id"
				/>
				<EditableValue
					v-if="prop.type !== 'dropdown'"
					v-model="prop.computed.value"
					class="text-lg mt-2"
					size="lg"
					:type="prop.type"
					:onFinish="updateUser"
				/>
				<UDropdownMenu
					v-if="prop.type === 'dropdown'"
					:items="prop.dropdownItems"
					:value="prop.computed.value"
					@update:value="(value: string) => (prop.computed.value = value)"
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
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { com } from '@earth-app/ocean';
import { regenerateAvatar, updateAccount, useCurrentAvatar } from '~/compostables/useUser';
import type { User } from '~/shared/types/user';
import type { InputTypeHTMLAttribute } from 'vue';
import { UButton } from '#components';

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
	type: InputTypeHTMLAttribute | 'dropdown';
	dropdownItems?: { label: string; value: string }[];
	computed: globalThis.Ref<string | number>;
}[] = [
	{
		name: 'Email Address',
		id: 'email',
		type: 'email',
		computed: email
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
		computed: phoneNumber
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
	}
];

function sanitize(obj: User['account']): Partial<User['account']> {
	return {
		firstName: obj.firstName?.trim() || '',
		lastName: obj.lastName?.trim() || '',
		username: obj.username?.trim() || '',
		bio: obj.bio?.trim() || '',
		email: obj.email?.trim() || '',
		address: obj.address?.trim() || '',
		country: obj.country?.trim() || '',
		phone_number: obj.phone_number
	};
}

async function updateUser() {
	if (user.value) {
		if (!changed.value) return true;

		const res = await updateAccount(sanitize(user.value.account));
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
	return enumeration.charAt(0).toUpperCase() + enumeration.slice(1).toLowerCase();
}

// Profile Photo

const avatar = ref<string | undefined>(undefined);
let objectUrl: string | undefined = undefined;
const avatarLoading = ref(false);

onMounted(async () => {
	const res = await useCurrentAvatar();
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
	avatarLoading.value = true;

	const res = await regenerateAvatar();
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
</script>
