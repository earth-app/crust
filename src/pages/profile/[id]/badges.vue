<template>
	<div class="flex flex-col items-center px-4">
		<h2 class="text-xl font-semibold my-2 mt-28 md:mt-2">{{ handle }}'s Badges</h2>
		<h4 class="text-base">{{ completedBadges.length }} / {{ badges.length }} Completed</h4>
		<Loading v-if="!badges.length" />

		<h3 class="my-4 font-medium text-lg">Completed Badges</h3>
		<div
			v-if="completedBadges.length"
			class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 justify-items-center items-center gap-4"
		>
			<UserBadgeCard
				v-for="badge in completedBadges"
				:key="badge.id"
				:badge="badge"
			/>
		</div>

		<h3 class="my-4 font-medium text-lg">All Badges</h3>
		<div
			class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 justify-items-center items-center gap-4"
		>
			<UserBadgeCard
				v-for="badge in badges"
				:key="badge.id"
				:badge="badge"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
const { user, badges, fetchBadges } = useAuth();
const { handle } = useDisplayName(user.value);

onMounted(async () => {
	await fetchBadges();
});

const completedBadges = computed(() => badges.value.filter((b) => 'granted' in b && b.granted));
</script>
