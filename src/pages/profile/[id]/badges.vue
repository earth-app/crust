<template>
	<div
		v-if="user"
		class="flex flex-col items-center px-4"
	>
		<h2 class="text-xl font-semibold my-2 mt-28 md:mt-2">{{ handle }}'s Badges</h2>
		<LazyUserCard
			:user="user"
			class="w-full max-w-2xl mb-4"
			hydrate-on-idle
		/>
		<h4 class="text-base">{{ completedBadges.length }} / {{ badges.length }} Completed</h4>

		<h3 class="my-4 font-medium text-lg">Completed Badges</h3>
		<div
			v-if="completedBadges.length"
			class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 justify-items-center items-center gap-4"
		>
			<LazyUserBadgeCard
				v-for="badge in completedBadges"
				:key="badge.id"
				:badge="badge"
				hydrate-on-visible
			/>
		</div>
		<div
			v-else
			class="flex items-center"
		>
			<Loading />
		</div>

		<h3 class="my-4 font-medium text-lg">All Badges</h3>
		<div
			v-if="badges.length > 0"
			class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 justify-items-center items-center gap-4"
		>
			<LazyUserBadgeCard
				v-for="badge in badges"
				:key="badge.id"
				:badge="badge"
				hydrate-on-visible
			/>
		</div>
		<div
			v-else
			class="flex items-center"
		>
			<Loading />
		</div>
	</div>
	<div
		v-else-if="user === null"
		class="flex flex-col items-center px-4 mt-28 md:mt-2"
	>
		<h2 class="text-xl font-semibold">User Not Found</h2>
		<p class="text-base mt-2">The user you are looking for does not exist.</p>
	</div>
	<div
		v-else
		class="flex flex-col items-center px-4 mt-28 md:mt-2"
	>
		<Loading />
	</div>
</template>

<script setup lang="ts">
const route = useRoute();
const { user, fetchUser, badges, fetchBadges } = useUser(route.params.id as string);
const { handle } = useDisplayName(user);

onMounted(() => {
	fetchUser();
	fetchBadges();
});

const completedBadges = computed(() => badges.value.filter((b) => 'granted' in b && b.granted));
</script>
