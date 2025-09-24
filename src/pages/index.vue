<template>
	<div class="w-full flex justify-center">
		<div class="relative size-48 my-28">
			<EarthCircle />
		</div>
	</div>
	<div class="w-full flex flex-col items-center justify-center">
		<h1 class="text-3xl">The Earth App</h1>
		<ClientOnly>
			<p
				v-if="!user"
				class="text-lg mt-3 motion-preset-fade-lg"
			>
				Find Your Novelty, Try New Things, Discover the World
			</p>
			<div
				v-else
				class="flex justify-center mt-3 motion-preset-fade-lg"
			>
				<UAvatar
					:src="avatarUrl"
					class="size-8 min-w-4 h-auto mr-2"
				/>
				<p class="text-lg font-semibold">Welcome Back, @{{ user.username }}</p>
			</div>
			<div class="flex items-center justify-center w-full motion-opacity-in-0 motion-duration-1500">
				<InfoCardGroup
					:title="user ? `Today's Content` : 'Discover Content'"
					:description="user ? 'Topics you might enjoy' : 'Explore interests from around the world'"
					icon="material-symbols:apps"
					class="w-11/12"
				>
					<PromptCard
						v-for="prompt in randomPrompts"
						:key="prompt.id"
						:prompt="prompt"
					/>
					<ActivityCard
						v-for="activity in randomActivities"
						:key="activity.id"
						:activity="activity"
					/>
				</InfoCardGroup>
			</div>
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
import { getRandomActivities } from '~/compostables/useActivity';
import { getRandomPrompts } from '~/compostables/usePrompt';
import { useAuth } from '~/compostables/useUser';
import type { Activity } from '~/shared/types/activity';
import type { Prompt } from '~/shared/types/prompts';

const { user } = useAuth();
const avatarUrl = useState<string>('current-avatar', () => '/favicon.png');

const randomPrompts = ref<Prompt[]>([]);
const randomActivities = ref<Activity[]>([]);

onMounted(async () => {
	const resPrompt = await getRandomPrompts(2);
	if (resPrompt.success && resPrompt.data) {
		randomPrompts.value = resPrompt.data;
	}

	const resActivities = await getRandomActivities(2);
	if (resActivities.success && resActivities.data) {
		randomActivities.value = resActivities.data;
	}
});
</script>
