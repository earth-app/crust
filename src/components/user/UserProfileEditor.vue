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
				class="mt-4 flex flex-row w-full justify-between"
			>
				<h2 class="text-xl">{{ prop.name }}</h2>
				<EditableValue
					v-model="prop.computed.value"
					class="text-lg mt-2"
					size="lg"
					:type="prop.type"
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

const accountProps = computed(() => {
	if (!user.value?.account) return {};

	return Object.keys(user.value.account).reduce(
		(acc, key) => {
			acc[key] = computed({
				get: () => (user.value?.account as any)?.[key] ?? '',
				set: (value) => {
					if (user.value?.account) {
						(user.value.account as any)[key] = value;
						changed.value = true;
					}
				}
			});
			return acc;
		},
		{} as Record<string, any>
	);
});

const firstName = computed(() => accountProps.value.firstName);
const lastName = computed(() => accountProps.value.lastName);
const username = computed(() => accountProps.value.username);

const email = computed(() => accountProps.value.email);
const address = computed(() => accountProps.value.address);
const phoneNumber = computed(() => accountProps.value.phoneNumber);
const id = computed(() => accountProps.value.id);

const props: {
	name: string;
	type: InputTypeHTMLAttribute;
	computed: globalThis.Ref<string | number>;
}[] = [
	{
		name: 'Email Address',
		type: 'email',
		computed: email
	},
	{
		name: 'Address',
		type: 'text',
		computed: address
	},
	{
		name: 'Phone Number',
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
</script>
