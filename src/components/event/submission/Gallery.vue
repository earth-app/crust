<template>
	<UScrollArea
		v-slot="{ item, index }"
		:items="items"
	>
		<UModal :title="`Submission by @${item.user.value?.username || 'anonymous'}`">
			<div class="flex flex-col items-center max-w-96">
				<NuxtImg
					:src="item.image"
					:preload="{ fetchPriority: index > 8 ? 'low' : 'high' }"
					alt="Submission Image"
					format="webp"
					:width="item.width"
					:height="item.height"
					class="rounded-lg shadow-md object-cover hover:cursor-pointer"
				/>

				<h2 class="font-bold text-lg mt-2">{{ item.user.value?.username || 'Anonymous' }}</h2>
			</div>

			<template #body>
				<div class="flex flex-col items-center gap-4">
					<NuxtImg
						:src="item.image"
						alt="Submission Image"
						format="webp"
						class="max-h-screen max-w-screen w-full rounded-lg shadow-md object-contain"
					/>

					<Score :score="item.score.score" />

					<div class="flex flex-col">
						<UAvatar
							src="/cloud.png"
							size="xl"
							class="-mb-1"
						/>
						<p class="font-medium text-lg bg-gray-100 dark:bg-gray-800 p-2 rounded-lg">
							"{{ item.caption }}" -
							<NuxtLink
								to="/profile/@cloud"
								class="text-blue-600 font-semibold"
								>@cloud</NuxtLink
							>
						</p>
						<p class="opacity-80 text-sm mt-2">
							{{ formatTimestamp(item.timestamp) }}
						</p>
					</div>
				</div>
			</template>
		</UModal>
	</UScrollArea>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';

const props = defineProps<{
	submissions: EventImageSubmission[];
}>();

const heights = [320, 480, 640, 800];

function getHeight(index: number) {
	const seed = (index * 11 + 7) % 17;
	return heights[seed % heights.length]!;
}

const items = computed(() => {
	return props.submissions.map((submission, i) => {
		const { user, fetchUser } = useUser(submission.user_id);
		fetchUser();

		const height = getHeight(i);

		return {
			...submission,
			user,
			width: Math.round((height * 16) / 9), // 16:9 aspect ratio
			height
		};
	});
});

const i18n = useI18n();
function formatTimestamp(timestamp: number) {
	return DateTime.fromMillis(timestamp).toLocaleString(DateTime.DATETIME_MED_WITH_WEEKDAY, {
		locale: i18n.locale.value
	});
}
</script>
