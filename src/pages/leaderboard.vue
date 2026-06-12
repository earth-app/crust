<template>
	<div class="flex flex-col items-center w-full px-8 py-8 sm:py-12 gap-6">
		<div
			id="leaderboard-hero"
			class="flex flex-col items-center text-center gap-2 max-w-2xl"
		>
			<UIcon
				name="mdi:trophy-variant"
				class="size-10 text-warning"
			/>
			<h1 class="text-3xl font-bold">Leaderboard</h1>
			<p class="text-muted">
				See who's leading on impact points and journey streaks: globally, among your friends, or
				inside your circle.
			</p>
		</div>

		<ClientOnly>
			<UserLeaderboard
				:initial-tab="initialTab"
				:initial-scope="initialScope"
			/>
			<template #fallback>
				<div class="min-h-50 flex items-center justify-center text-muted">
					<UIcon
						name="mdi:loading"
						class="size-6 animate-spin"
					/>
				</div>
			</template>
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Leaderboard');

const route = useRoute();
const initialTab = (route.query.tab as LeaderboardMetric) || 'points';
const initialScope = (route.query.scope as LeaderboardScope) || 'global';
</script>
