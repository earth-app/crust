<template>
	<ClientOnly>
		<div
			v-if="user"
			class="flex flex-col w-full h-full justify-center p-8 space-y-4"
		>
			<h2 class="text-lg font-semibold">Change Password</h2>
			<UserPasswordChange />
		</div>
		<div
			v-else
			class="flex flex-col w-full h-full items-center justify-center"
		>
			<p class="text-center text-gray-600">Please log in to change your password.</p>
		</div>
	</ClientOnly>
</template>

<script setup lang="ts">
import { useTitleSuffix } from '~/compostables/useTitleSuffix';
import { useAuth } from '~/compostables/useUser';

const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Change Password');

const router = useRouter();
const toast = useToast();
const { user } = useAuth();
onMounted(() => {
	if (!user.value) {
		router.push('/login');

		toast.add({
			title: 'Not Logged In',
			description: 'You must be logged in to verify your email.',
			icon: 'mdi:account-alert',
			color: 'error',
			duration: 3000
		});
	}
});
</script>
