<template>
	<div>
		<UButton
			color="warning"
			:variant="variant"
			:size="size"
			:block="block"
			icon="mdi:sword-cross"
			@click="onChallenge"
		>
			{{ label }}
		</UButton>

		<UModal
			v-model:open="pickerOpen"
			title="Challenge a Friend"
		>
			<template #body>
				<div class="flex flex-col gap-4">
					<p class="text-sm text-muted">Pick a quest to challenge {{ friendName }} to.</p>
					<USelectMenu
						v-model="selectedQuestId"
						:items="questOptions"
						value-key="id"
						label-key="label"
						:icon="selectedQuestIcon"
						placeholder="Choose a quest"
						class="w-full"
					/>
					<div class="flex justify-end gap-2">
						<UButton
							color="neutral"
							variant="soft"
							@click="pickerOpen = false"
						>
							Cancel
						</UButton>
						<UButton
							color="warning"
							icon="mdi:sword-cross"
							:loading="sending"
							:disabled="!selectedQuestId"
							@click="confirmChallenge"
						>
							Send Challenge
						</UButton>
					</div>
				</div>
			</template>
		</UModal>
	</div>
</template>

<script setup lang="ts">
import type { Quest } from 'types/user';

const props = withDefaults(
	defineProps<{
		friendId: string;
		friendName: string;
		size?: 'xs' | 'sm' | 'md' | 'lg';
		variant?: 'solid' | 'soft' | 'outline' | 'ghost' | 'subtle' | 'link';
		label?: string;
		block?: boolean;
	}>(),
	{ size: 'md', variant: 'soft', label: 'Challenge', block: false }
);

const toast = useToast();
const authStore = useAuthStore();
const selfId = computed(() => authStore.currentUser?.id ?? null);

// the challenge is always with one of the challenger's own quests (active or daily)
const { quest: dailyQuest } = useDailyQuest();
const { quest: activeQuest } = useUser(selfId);

type QuestOption = { id: string; label: string; icon: string };

const questOptions = computed<QuestOption[]>(() => {
	const options: QuestOption[] = [];
	const seen = new Set<string>();
	const push = (q: Quest | null | undefined, prefix: string) => {
		if (!q || seen.has(q.id)) return;
		seen.add(q.id);
		options.push({
			id: q.id,
			label: `${prefix}: ${q.title}`,
			icon: q.icon || 'mdi:map-marker-path'
		});
	};
	push(activeQuest.value?.quest, 'Active Quest');
	push(dailyQuest.value, 'Daily Quest');
	return options;
});

const selectedQuestIcon = computed(
	() => questOptions.value.find((o) => o.id === selectedQuestId.value)?.icon
);

const pickerOpen = ref(false);
const selectedQuestId = ref<string | undefined>(undefined);
const sending = ref(false);

function onChallenge() {
	if (questOptions.value.length === 0) {
		toast.add({
			title: 'No Quest to Challenge With',
			description: 'Start a quest first, then challenge a friend to it.',
			icon: 'mdi:flag-off-outline',
			color: 'warning',
			duration: 4000
		});
		return;
	}
	selectedQuestId.value = questOptions.value[0]?.id;
	pickerOpen.value = true;
}

async function confirmChallenge() {
	const questId = selectedQuestId.value;
	if (!questId) return;
	sending.value = true;
	try {
		const res = await challengeFriend(props.friendId, questId);
		if (valid(res)) {
			toast.add({
				title: 'Challenge Sent',
				description: `${props.friendName} has been challenged. Game on.`,
				icon: 'mdi:sword-cross',
				color: 'success',
				duration: 4000
			});
			pickerOpen.value = false;
		} else {
			toast.add({
				title: 'Challenge Failed',
				description: res.message || 'Could not send the challenge. Please try again.',
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 4000
			});
		}
	} finally {
		sending.value = false;
	}
}
</script>
