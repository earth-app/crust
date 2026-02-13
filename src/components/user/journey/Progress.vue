<template>
	<UPopover
		arrow
		mode="hover"
	>
		<div class="flex items-center w-28 mr-2">
			<UBadge
				v-if="rank !== null && leaderboard"
				:label="rank ? `#${rank}` : undefined"
				icon="mdi:medal-outline"
				variant="subtle"
				:color="
					rank === 0 ? 'neutral' : rank === 1 ? 'warning' : rank === 2 ? 'secondary' : 'primary'
				"
				size="sm"
				class="mx-1"
				:class="leaderboard ? 'hover:cursor-pointer' : ''"
				@click="showLeaderboard = true"
			/>

			<UIcon
				:name="icon"
				class="min-w-6 min-h-6 size-8 mr-2"
			/>

			<div class="flex flex-col items-start justify-center w-full">
				<span
					v-if="total"
					class="text-sm font-medium text-gray-900 dark:text-gray-100"
				>
					{{ count }} / {{ total }}
				</span>
				<span
					v-else
					class="text-sm font-semibold text-yellow-500 light:text-yellow-600"
				>
					{{ count }}
				</span>
				<UProgress
					v-if="total"
					v-bind:model-value="count"
					:max="total"
					class="max-w-24 w-full mt-1"
					color="secondary"
				/>
			</div>
		</div>

		<template #content>
			<div class="max-w-xs p-4">
				<p
					v-if="title"
					class="font-medium text-gray-900 dark:text-gray-100 mb-2"
				>
					{{ title }}
				</p>
				<p
					v-if="total"
					class="text-sm text-gray-700 dark:text-gray-300"
				>
					{{ count }} out of {{ total }} activities have been found on this journey.
				</p>
				<p
					v-else
					class="text-sm text-gray-700 dark:text-gray-300"
				>
					{{ count }} {{ title?.toLowerCase() || 'items' }} so far. Streaks only last every 48
					hours, so keep going!
				</p>
				<p
					v-if="help"
					class="mt-2 text-xs text-gray-500 dark:text-gray-400"
				>
					{{ help }}
				</p>
				<p
					v-if="rank"
					class="mt-2 text-xs text-gray-500 dark:text-gray-400"
				>
					This user is ranked #{{ rank }} on this journey among all users. Keep going to climp the
					leaderboard!
				</p>
			</div>
		</template>
	</UPopover>
	<UModal
		v-if="leaderboard"
		v-model:open="showLeaderboard"
		title="Leaderboard"
		class="min-w-200 max-w-full w-11/12"
	>
		<template #body>
			<UserJourneyLeaderboard :type="leaderboard" />
		</template>
	</UModal>
</template>

<script setup lang="ts">
defineProps<{
	icon: string;
	title?: string;
	help?: string;
	count: number;
	total?: number;
	rank?: number;
	leaderboard?: 'prompt' | 'article' | 'event';
}>();

const showLeaderboard = ref(false);
</script>
