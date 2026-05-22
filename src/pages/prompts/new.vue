<template>
	<div class="container px-6 py-4">
		<PromptCreateMenu @prompt-created="moveToPrompt" />
	</div>
</template>

<script setup lang="ts">
const router = useRouter();
const toast = useToast();
const { user } = useAuth();

watch(
	() => user.value,
	(currentUser) => {
		if (currentUser && currentUser.account.visibility === 'PRIVATE') {
			router.push('/profile');

			toast.add({
				title: 'Profile Private',
				description: 'You need to set your profile to Public or Unlisted to create prompts.',
				icon: 'mdi:account-alert',
				color: 'warning',
				duration: 5000
			});
		}
	},
	{ immediate: true }
);

function moveToPrompt(prompt: Prompt) {
	router.push(`/prompts/${prompt.id}`);
}
</script>
