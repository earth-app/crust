<template>
	<section class="flex flex-col gap-2">
		<div class="flex items-center justify-between">
			<h2 class="text-sm font-semibold tracking-wide text-muted uppercase">Your Circle</h2>
			<UBadge
				variant="subtle"
				color="neutral"
				>{{ members.length }}</UBadge
			>
		</div>

		<UInput
			v-if="members.length > 4"
			v-model="q"
			icon="mdi:magnify"
			placeholder="Search Your Circle"
			size="sm"
		/>

		<div
			v-if="loading && !members.length"
			class="flex flex-col gap-2"
		>
			<USkeleton
				v-for="n in 3"
				:key="n"
				class="h-10 rounded-lg"
			/>
		</div>

		<div
			v-else-if="!members.length"
			class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-default bg-elevated/30 p-4 text-center"
		>
			<UIcon
				name="mdi:account-multiple-plus-outline"
				class="text-2xl text-muted"
			/>
			<p class="text-sm text-muted">
				Your circle is empty. Invite friends to grow a garden together.
			</p>
			<UButton
				size="sm"
				color="primary"
				icon="mdi:account-plus"
				@click="inviteOpen = true"
				>Invite Friends</UButton
			>
		</div>

		<ul
			v-else
			class="flex flex-col gap-1"
		>
			<li
				v-for="m in filtered"
				:key="m.id"
			>
				<NuxtLink
					:to="`/profile/@${m.username}`"
					class="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-elevated/50"
				>
					<UAvatar
						:src="avatarOf(m)"
						:alt="m.username"
						size="sm"
					/>
					<span class="truncate text-sm font-medium">{{ m.username }}</span>

					<UserTypeBadge :user="m" />
				</NuxtLink>
			</li>
			<li
				v-if="!filtered.length"
				class="px-2 py-2 text-sm text-muted"
			>
				No one in your circle matches that search.
			</li>
		</ul>

		<UModal
			v-model:open="inviteOpen"
			title="Invite Friends"
		>
			<template #body>
				<UserInviteFriend />
			</template>
		</UModal>
	</section>
</template>

<script setup lang="ts">
import { useAvatarStore } from 'stores/avatar';
import { useFriendsStore } from 'stores/friends';

const friends = useFriendsStore();
const avatarStore = useAvatarStore();

const loading = ref(false);
const q = ref('');
const inviteOpen = ref(false);

const members = computed<User[]>(() => friends.getCircle('current'));

const filtered = computed(() => {
	const term = q.value.trim().toLowerCase();
	if (!term) return members.value;
	return members.value.filter((m) => m.username?.toLowerCase().includes(term));
});

function avatarOf(m: User): string | undefined {
	return avatarStore.safeUrl(m.account?.avatar_url, 'avatar128');
}

onMounted(async () => {
	loading.value = true;
	try {
		await friends.fetchCircle('current');
	} finally {
		loading.value = false;
	}
});
</script>
