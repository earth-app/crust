<template>
	<div class="flex flex-col w-full items-center justify-center mt-4">
		<UIcon
			v-if="activity.fields['icon']"
			:name="activity.fields['icon']"
			size="6rem"
			class="my-2"
		/>
		<div class="flex flex-col sm:flex-row items-center justify-center">
			<h1 class="text-4xl sm:text-5xl font-bold">{{ activity.name }}</h1>
			<UButton
				v-if="user && user.account.account_type === 'ADMINISTRATOR'"
				color="primary"
				class="ml-4 mt-2"
				@click="editing = true"
			>
				Edit Activity
			</UButton>
			<ActivityEditorModal
				v-if="user && user.account.account_type === 'ADMINISTRATOR'"
				:activity="activity"
				v-model:open="editing"
			/>
		</div>
		<h3 class="text-md sm:text-lg md:text-xl min-w-75 w-3/5 mt-8">{{ activity.description }}</h3>
		<!-- Icon Islands -->
		<UIcon
			v-for="island in islands"
			:key="island.name"
			:name="island.icon"
			class="absolute top-0 hidden md:inline-block md:size-8 lg:size-12 z-10duration-300 motion-preset-fade-lg"
			:style="{ transform: `translate(${island.x}vw, ${island.y}vh)` }"
		/>
		<div
			class="grid grid-cols-1 xl:grid-cols-2 justify-items-center items-start w-2/3 min-w-100 xl:min-w-260 mt-6 sm:px-4 gap-y-8"
		>
			<!-- Skeleton Loading Cards -->
			<InfoCardSkeleton
				v-if="cards.length === 0"
				v-for="n in 6"
				:key="`skeleton-${n}`"
			/>

			<!-- Card Data Entries -->
			<InfoCard
				v-for="(card, index) in cards"
				class="z-20"
				:key="`card-${index}`"
				:icon="card.icon"
				:external="true"
				:title="card.title"
				:description="card.description"
				:content="card.content"
				:link="card.link"
				:image="card.image"
				:youtube-id="card.youtubeId"
				:video="card.video"
				:footer="card.footer"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { Activity } from '~/shared/types/activity';
import ActivityEditorModal from '../admin/ActivityEditorModal.vue';

const props = defineProps<{
	activity: Activity;
}>();

const { user } = useAuth();
const { islands, loadIslandsForActivity } = useActivityIslands();
const { cards, loadCardsForActivity } = useActivityCards();

const editing = ref(false);

// Reload when the activity changes (name or aliases)
watch(
	() => [props.activity?.name, props.activity?.aliases?.join(',') || ''],
	() => {
		loadCardsForActivity(props.activity);
		loadIslandsForActivity(props.activity);
	},
	{ immediate: true }
);
</script>
