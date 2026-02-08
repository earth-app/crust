<template>
	<div
		class="flex justify-center w-70 aspect-video gap-4 p-4 rounded-lg border-4 border-gray-700 bg-gray-600 light:bg-gray-200 hover:opacity-90 transition-opacity duration-300 cursor-pointer"
		:class="'user_id' in badge && badge.granted ? 'border-yellow-500' : ''"
		@click="showDetails = true"
	>
		<UIcon
			:name="badge.icon"
			class="self-center min-h-8 min-w-8 sm:size-10 md:size-12 lg:size-16"
			:class="'user_id' in badge && badge.granted ? 'text-yellow-400' : ''"
		/>

		<div class="flex flex-col items-center gap-2">
			<UBadge
				:color="rarityColor"
				:trailing-icon="'user_id' in badge && badge.granted ? 'mdi:check' : ''"
				>{{ capitalizeFully(badge.rarity) }}</UBadge
			>
			<h3 class="font-semibold text-md md:text-lg">{{ badge.name }}</h3>
			<span class="text-sm opacity-90 text-center">{{ badge.description }}</span>
		</div>
	</div>
	<UModal
		v-model:open="showDetails"
		title="Badge Details"
		:description="badge.description"
	>
		<template #body>
			<div class="flex flex-col items-center gap-4">
				<UIcon
					:name="badge.icon"
					class="self-center min-h-12 min-w-12 sm:size-16 md:size-20 lg:size-24"
					:class="'user_id' in badge && badge.granted ? 'text-yellow-400' : ''"
				/>
				<div class="flex space-x-2">
					<h2 class="font-bold text-xl md:text-2xl">{{ badge.name }}</h2>
					<UBadge
						:color="rarityColor"
						:trailing-icon="'user_id' in badge && badge.granted ? 'mdi:check-bold' : ''"
						class="text-lg"
						>{{ capitalizeFully(badge.rarity) }}</UBadge
					>
				</div>
				<p class="text-center text-md md:text-lg">{{ badge.description }}</p>
				<span
					v-if="'granted' in badge && badge.granted"
					class="text-sm opacity-90 mt-2"
				>
					Congratulations! You've earned this badge on
					{{ grantedAt }}.
				</span>
				<div
					v-else-if="'progress' in badge"
					class="w-full px-8"
				>
					<UProgress
						:model-value="badge.progress * 100 || 0"
						class="w-full mt-1"
						:color="rarityColor"
						status
					/>
				</div>

				<div class="flex items-center">
					<span class="text-gray-700">id:{{ badge.id }}</span>
					<span
						v-if="badge.tracker_id"
						class="text-gray-700"
					>
						&nbsp;| tracker:{{ badge.tracker_id }}</span
					>
				</div>
			</div>
		</template>
	</UModal>
</template>
<script setup lang="ts">
import { DateTime } from 'luxon';
import type { Badge, UserBadge } from '~/shared/types/user';
import { capitalizeFully } from '~/shared/util';

const props = defineProps<{
	badge: Badge | UserBadge;
}>();

const showDetails = ref(false);

const rarityColor = computed(() => {
	switch (props.badge.rarity) {
		case 'normal':
			return 'neutral';
		case 'rare':
			return 'info';
		case 'amazing':
			return 'warning';
		case 'green':
			return 'success';
	}
});

const grantedAt = computed(() =>
	DateTime.fromISO(
		'granted_at' in props.badge && props.badge.granted_at ? props.badge.granted_at : ''
	).toLocaleString(DateTime.DATETIME_MED)
);
</script>
