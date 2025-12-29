<template>
	<div
		class="p-4 flex flex-col justify-center bg-white dark:bg-gray-900 rounded-lg shadow border-2 border-gray-200 dark:border-gray-700"
	>
		<div class="flex justify-between">
			<h2 class="text-lg font-semibold mb-4">@{{ user.username }}'s Friends</h2>
			<div id="friends-buttons">
				<UChip
					:show="user.is_my_friend && !user.is_friend && !isThisUser"
					color="warning"
					inset
				>
					<UButton
						v-if="!user.is_friend && !isThisUser"
						title="Add Friend"
						color="primary"
						variant="ghost"
						icon="mdi:plus"
						:loading="friendsLoading"
						:disabled="circleLoading"
						@click="addCurrentFriend"
					/>
				</UChip>
				<UChip
					:show="user.is_friend && user.is_in_circle && !user.is_in_my_circle && !isThisUser"
					color="warning"
					inset
				>
					<UTooltip
						:disabled="!atMaxCircle"
						text="Maximum circle size reached"
					>
						<UButton
							v-if="user.is_friend && !user.is_in_my_circle && !isThisUser"
							title="Add to Circle"
							color="success"
							variant="ghost"
							icon="mdi:account-plus"
							:loading="circleLoading"
							:disabled="friendsLoading || atMaxCircle"
							@click="addCurrentToCircle"
						/>
					</UTooltip>
				</UChip>
				<UButton
					v-if="user.is_in_my_circle && !isThisUser"
					title="Remove from Circle"
					color="warning"
					variant="ghost"
					icon="mdi:account-remove"
					:loading="circleLoading"
					:disabled="friendsLoading"
					@click="removeCurrentFromCircle"
				/>
				<UButton
					v-if="user.is_friend && !isThisUser"
					title="Remove Friend"
					color="error"
					variant="ghost"
					icon="mdi:minus"
					:loading="friendsLoading"
					:disabled="circleLoading"
					@click="removeCurrentFriend"
				/>
			</div>
		</div>
		<div class="flex gap-4 justify-center">
			<div
				v-if="!isThisUser"
				class="flex flex-col items-center justify-center p-4 bg-gray-100 dark:bg-gray-800 rounded-lg shadow"
			>
				<UIcon
					name="mdi:account-multiple"
					class="size-5"
				/>
				<h3 class="text-2xl font-semibold">{{ withSuffix(user.mutual_count ?? 0) }}</h3>
				<UTooltip text="Number of friends you share with this person">
					<span>Mutual Friends</span>
				</UTooltip>
			</div>
			<div
				v-if="user.added_count !== undefined"
				class="flex flex-col items-center justify-center p-4 bg-gray-100 dark:bg-gray-800 rounded-lg shadow"
			>
				<UIcon
					name="mdi:account-plus"
					class="size-5"
				/>
				<h3 class="text-2xl font-semibold">{{ withSuffix(user.added_count ?? 0) }}</h3>
				<UTooltip text="Number of friends this person has added">
					<span>Friends Added</span>
				</UTooltip>
			</div>
			<div
				v-if="user.non_mutual_count !== undefined"
				class="flex flex-col items-center justify-center p-4 bg-gray-100 dark:bg-gray-800 rounded-lg shadow"
			>
				<UIcon
					name="mdi:account-minus"
					class="size-5"
				/>
				<h3 class="text-2xl font-semibold">{{ withSuffix(user.non_mutual_count ?? 0) }}</h3>
				<UTooltip text="Number of friends this person has added that didn't add them back">
					<span>Non-Mutual Friends</span>
				</UTooltip>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import type { User } from '~/shared/types/user';
import { withSuffix } from '~/shared/util';

const props = defineProps<{
	user: User;
}>();

const toast = useToast();
const { user: currentUser } = useAuth();
const { addFriend, removeFriend, addToCircle, removeFromCircle } = useFriends();

const friendsLoading = ref(false);
const circleLoading = ref(false);
const isThisUser = computed(() => {
	return currentUser.value?.id === props.user.id;
});
const atMaxCircle = computed(() => {
	const count = currentUser.value?.circle_count || 0;
	const max = currentUser.value?.max_circle_count || 0;

	return count >= max;
});

async function addCurrentFriend() {
	if (isThisUser.value) return;

	if (props.user.is_friend) {
		toast.add({
			title: 'Already Friends',
			description: `You are already friends with ${props.user.username}.`,
			icon: 'mdi:account-multiple-check',
			color: 'info',
			duration: 3000
		});
		return;
	}

	friendsLoading.value = true;
	const res = await addFriend(props.user.id);
	if (res.success && res.data) {
		if ('message' in res.data) {
			toast.add({
				title: 'Error',
				description: res.data.message,
				icon: 'mdi:badge-account-alert',
				color: 'error',
				duration: 5000
			});

			friendsLoading.value = false;
			return;
		}

		props.user.is_friend = true;
		props.user.added_count = (props.user.added_count || 0) + 1;

		// increment mutual count  if applicable
		if (props.user.is_my_friend) props.user.mutual_count = (props.user.mutual_count || 0) + 1;
		toast.add({
			title: 'Friend Added',
			description: `You have added @${props.user.username} as a friend. Tell them to add you back!`,
			icon: 'mdi:account-multiple-plus',
			color: 'success',
			duration: 3000
		});
	}

	friendsLoading.value = false;
}

async function removeCurrentFriend() {
	if (isThisUser.value) return;

	if (!props.user.is_friend) {
		toast.add({
			title: 'Not Friends',
			description: `You are not friends with @${props.user.username}.`,
			icon: 'mdi:account-multiple-minus',
			color: 'info',
			duration: 3000
		});
		return;
	}

	friendsLoading.value = true;
	const res = await removeFriend(props.user.id);
	if (res.success && res.data) {
		if ('message' in res.data) {
			toast.add({
				title: 'Error',
				description: res.data.message,
				icon: 'mdi:badge-account-alert',
				color: 'error',
				duration: 5000
			});
			friendsLoading.value = false;
			return;
		}

		props.user.is_friend = false;
		props.user.added_count = Math.max((props.user.added_count || 1) - 1, 0);

		// remove from circle if present
		if (props.user.is_in_my_circle) {
			props.user.is_in_my_circle = false;
			props.user.circle_count = Math.max((props.user.circle_count || 1) - 1, 0);
		}

		// decrement mutual count if applicable
		if (props.user.is_my_friend)
			props.user.mutual_count = Math.max((props.user.mutual_count || 1) - 1, 0);

		toast.add({
			title: 'Friend Removed',
			description: `You have removed @${props.user.username} from your friends.`,
			icon: 'mdi:account-multiple-minus',
			color: 'secondary',
			duration: 3000
		});
	}

	friendsLoading.value = false;
}

async function addCurrentToCircle() {
	if (isThisUser.value) return;

	if (!props.user.is_friend) {
		toast.add({
			title: 'Not Friends',
			description: `You must be add @${props.user.username} as a friend to add them to your circle.`,
			icon: 'mdi:account-alert',
			color: 'error',
			duration: 3000
		});
		return;
	}

	if (props.user.is_in_my_circle) {
		toast.add({
			title: 'Already in Circle',
			description: `@${props.user.username} is already in your circle.`,
			icon: 'mdi:account-check',
			color: 'info',
			duration: 3000
		});
		return;
	}

	circleLoading.value = true;
	const res = await addToCircle(props.user.id);
	if (res.success && res.data) {
		if ('message' in res.data) {
			toast.add({
				title: 'Error',
				description: res.data.message,
				icon: 'mdi:badge-account-alert',
				color: 'error',
				duration: 5000
			});
			circleLoading.value = false;
			return;
		}

		props.user.is_in_my_circle = true;
		props.user.circle_count = (props.user.circle_count || 0) + 1;

		toast.add({
			title: 'Added to Circle',
			description: `You have added ${props.user.username} to your private circle.`,
			icon: 'mdi:account-plus',
			color: 'success',
			duration: 3000
		});
	}

	circleLoading.value = false;
}

async function removeCurrentFromCircle() {
	if (isThisUser.value) return;

	if (!props.user.is_in_my_circle) {
		toast.add({
			title: 'Not in Circle',
			description: `${props.user.username} is not in your circle.`,
			icon: 'mdi:account-remove',
			color: 'info',
			duration: 3000
		});
		return;
	}

	circleLoading.value = true;
	const res = await removeFromCircle(props.user.id);
	if (res.success && res.data) {
		if ('message' in res.data) {
			toast.add({
				title: 'Error',
				description: res.data.message,
				icon: 'mdi:badge-account-alert',
				color: 'error',
				duration: 5000
			});
			circleLoading.value = false;
			return;
		}

		props.user.is_in_my_circle = false;
		props.user.circle_count = Math.max((props.user.circle_count || 1) - 1, 0);

		toast.add({
			title: 'Removed from Circle',
			description: `You have removed ${props.user.username} from your private circle. You need to remove them as a friend to fully disconnect.`,
			icon: 'mdi:account-minus',
			color: 'secondary',
			duration: 3000
		});
	}

	circleLoading.value = false;
}
</script>
