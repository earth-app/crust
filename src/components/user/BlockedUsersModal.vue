<template>
	<UModal
		v-model:open="open"
		title="Blocked Users"
		description="People you've blocked won't see your profile or interact with you. Unblock to restore interaction."
	>
		<template #body>
			<div class="flex flex-col gap-3 w-full">
				<div
					v-if="loading"
					class="flex flex-col gap-2"
				>
					<USkeleton
						v-for="i in 3"
						:key="i"
						class="h-12 w-full rounded-lg"
					/>
				</div>

				<div
					v-else-if="blockedUsers.length === 0"
					class="text-sm text-muted py-6 text-center rounded border border-default border-dashed"
				>
					You haven't blocked anyone.
				</div>

				<div
					v-else
					class="rounded-lg border border-default divide-y divide-default overflow-hidden"
				>
					<div
						v-for="blocked in blockedUsers"
						:key="blocked.id"
						class="flex items-center justify-between gap-3 px-3 py-2"
					>
						<UUser
							:name="blocked.full_name || `@${blocked.username}`"
							:description="`@${blocked.username}`"
							:avatar="avatarFor(blocked)"
							size="md"
							class="min-w-0"
						/>
						<UButton
							color="success"
							variant="soft"
							size="sm"
							icon="mdi:account-check-outline"
							:loading="busy === blocked.id"
							:disabled="!!busy"
							@click="handleUnblock(blocked)"
							>Unblock</UButton
						>
					</div>
				</div>
			</div>
		</template>
	</UModal>
</template>

<script setup lang="ts">
import type { User } from 'types/user';

const open = ref(false);
const loading = ref(false);
const busy = ref<string | null>(null);

const toast = useToast();
const avatarStore = useAvatarStore();
const { blockedUsers, fetchBlocked, unblock } = useBlocking();

const avatarFor = (user: User) => ({
	src: avatarStore.safeUrl(user.account?.avatar_url, 'avatar128'),
	loading: 'lazy' as const,
	alt: user.username
});

const load = async () => {
	loading.value = true;
	try {
		const res = await fetchBlocked();
		if (!res.success) {
			toast.add({
				title: 'Failed to Load Blocked Users',
				description: res.message || 'Could not load your blocked users.',
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 5000
			});
		}
	} finally {
		loading.value = false;
	}
};

const handleUnblock = async (user: User) => {
	busy.value = user.id;
	try {
		const res = await unblock(user.id);
		if (res.success) {
			toast.add({
				title: 'User Unblocked',
				description: `@${user.username} can interact with you again.`,
				icon: 'mdi:account-check',
				color: 'success',
				duration: 4000
			});
		} else {
			toast.add({
				title: 'Failed to Unblock',
				description: res.message || 'Could not unblock this user.',
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 5000
			});
		}
	} finally {
		busy.value = null;
	}
};

watch(open, (isOpen) => {
	if (isOpen) load();
});

export interface BlockedUsersModalRef {
	open: () => void;
	close: () => void;
}

defineExpose<BlockedUsersModalRef>({
	open: () => {
		open.value = true;
	},
	close: () => {
		open.value = false;
	}
});
</script>
