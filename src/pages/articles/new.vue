<template>
	<div class="container px-8 py-16 md:py-4">
		<ArticleForm mode="create" />
	</div>
</template>

<script setup lang="ts">
const router = useRouter();
const route = useRoute();
const toast = useToast();
const { user } = useAuth();

watch(
	() => user.value,
	(currentUser) => {
		if (currentUser === null) {
			router.push(`/login?redirect=${encodeURIComponent(route.fullPath)}`);
			return;
		}
		if (!currentUser) return;

		if (currentUser.account.visibility !== 'PUBLIC') {
			router.push('/profile');
			toast.add({
				title: 'Profile Private',
				description: 'You need to set your profile to Public to create articles.',
				icon: 'mdi:account-alert',
				color: 'warning',
				duration: 5000
			});
			return;
		}

		if (currentUser.account.account_type === 'FREE' || currentUser.account.account_type === 'PRO') {
			router.push('/');
			toast.add({
				title: 'Upgrade Required',
				description: 'You need to upgrade to the Writer plan or above to create articles.',
				icon: 'mdi:star-circle',
				color: 'warning',
				duration: 5000
			});
		}
	},
	{ immediate: true }
);
</script>
