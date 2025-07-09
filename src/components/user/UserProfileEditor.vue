<template>
	<div class="flex flex-col items-center w-full mt-6">
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
					v-model="prop.computed.value"
					class="text-lg mt-2"
					size="lg"
					:type="prop.type"
					:onFinish="updateUser"
				/>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { updateAccount } from '~/compostables/useUser';
import type { User } from '~/shared/types/user';
import type { InputTypeHTMLAttribute } from 'vue';

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

const email = createAccountProp('email');
const address = createAccountProp('address');
const phoneNumber = createAccountProp('phone_number');

const props: {
	name: string;
	id: keyof User['account']['field_privacy'];
	type: InputTypeHTMLAttribute;
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
	}
];

async function updateUser() {
	if (user.value) {
		if (!changed.value) return true;

		const res = await updateAccount(user.value.account);
		if (!res.success) {
			return res.message || 'Failed to update profile.';
		}

		return true;
	}

	return 'User not found.';
}

function getLabel(key: keyof User['account']['field_privacy']): string {
	const enumeration = user.value.account.field_privacy[key] ?? 'PRIVATE';
	return enumeration.charAt(0).toUpperCase() + enumeration.slice(1).toLowerCase();
}
</script>
