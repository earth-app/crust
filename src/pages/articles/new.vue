<template>
	<div class="container px-8 py-16 md:py-4">
		<ArticleForm mode="create" />
	</div>
</template>

<script setup lang="ts">
const router = useRouter();
const toast = useToast();
const { user } = useAuth();

onMounted(() => {
	if (user.value) {
		if (user.value.account.visibility !== 'PUBLIC') {
			router.push('/profile');
			toast.add({
				title: 'Profile Private',
				description: 'You need to set your profile to Public to create articles.',
				icon: 'mdi:account-alert',
				color: 'warning',
				duration: 5000
			});
		}

		if (
			user.value.account.account_type === 'FREE' ||
			user.value.account.account_type === 'PRO' ||
			user.value.account.account_type === 'WRITER'
		) {
			router.push('/');
			toast.add({
				title: 'Upgrade Required',
				description: 'You need to upgrade to the Organizer plan or above to create articles.',
				icon: 'mdi:star-circle',
				color: 'warning',
				duration: 5000
			});
		}
	}
});
</script>
