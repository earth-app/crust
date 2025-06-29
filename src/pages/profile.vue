<template>
	<div
		v-if="user"
		class="flex flex-row items-center justify-between"
	>
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
		</div>
	</div>
	<div
		v-else
		class="flex flex-col items-center justify-center h-screen"
	>
		<p class="text-gray-600">Please log in to view your profile.</p>
	</div>
</template>

<script setup lang="ts">
import EditableValue from '~/components/EditableValue.vue';
import { useAuth, updateAccount } from '~/compostables/useUser';
import { useTitleSuffix } from '~/compostables/useTitleSuffix';

const { user } = useAuth();
const changed = ref(false);

const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Profile');

const accountProps = computed(() => {
	if (!user.value?.account) return {};

	return Object.keys(user.value.account).reduce((acc, key) => {
		acc[key] = computed({
			get: () => (user.value?.account as any)?.[key] ?? '',
			set: (value) => {
				if (user.value?.account) {
					(user.value.account as any)[key] = value;
					changed.value = true;
				}
			},
		});
		return acc;
	}, {} as Record<string, any>);
});

const firstName = computed(() => accountProps.value.firstName);
const lastName = computed(() => accountProps.value.lastName);
const username = computed(() => accountProps.value.username);
const email = computed(() => accountProps.value.email);
const id = computed(() => accountProps.value.id);

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
