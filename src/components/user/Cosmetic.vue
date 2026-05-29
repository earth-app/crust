<template>
	<UCard
		variant="subtle"
		class="flex flex-col items-center justify-center gap-2 size-full"
		:class="
			state === 'available'
				? 'border-secondary border-2'
				: state === 'selected'
					? 'border-primary border-2'
					: ''
		"
	>
		<div class="flex flex-col items-center gap-1 mb-4 w-full">
			<UAvatar
				v-if="url"
				:src="url"
				:alt="props.cosmeticKey"
				size="2xl"
			/>
			<USkeleton
				v-else
				class="size-16 rounded-full"
			/>
			<h2 class="font-semibold text-sm text-center line-clamp-2">
				{{ capitalizeFully(props.cosmeticKey.replaceAll('_', ' ')) }}
			</h2>
			<UBadge
				v-if="props.rarity"
				:color="rarityColor"
				variant="soft"
				size="sm"
				>{{ capitalizeFully(props.rarity || '') }}</UBadge
			>
		</div>
		<div class="flex justify-center gap-2">
			<UBadge
				v-if="props.state === 'selected'"
				color="success"
				variant="soft"
				icon="mdi:check"
				size="sm"
			/>
			<UBadge
				v-else-if="props.state === 'locked'"
				color="warning"
				variant="subtle"
				icon="mdi:lock"
				size="sm"
			>
				{{ props.price ? comma(props.price) : '' }}
			</UBadge>
			<UBadge
				v-else
				color="info"
				variant="soft"
				icon="mdi:star"
				size="sm"
			/>
		</div>
	</UCard>
</template>

<script setup lang="ts">
const props = defineProps<{
	cosmeticKey: AvatarCosmetic['key'];
	price?: number;
	rarity?: AvatarCosmetic['rarity'];
	state?: 'selected' | 'available' | 'locked';
}>();

const avatarStore = useAvatarStore();

// Read directly from the reactive store cache. Blob URLs are owned by the
// store, so we must not revoke them here - multiple components may share
// the same cached URL, and revoking would break siblings.
const url = computed(() => avatarStore.getPreview(props.cosmeticKey));

const rarityColor = computed(() => {
	switch (props.rarity) {
		case 'normal':
			return 'neutral';
		case 'rare':
			return 'info';
		case 'amazing':
			return 'warning';
		case 'green':
			return 'primary';
	}
});

watch(
	() => props.cosmeticKey,
	(newKey) => {
		if (!newKey) return;
		if (avatarStore.getPreview(newKey)) return;
		void avatarStore.previewCosmetic(newKey);
	},
	{ immediate: true }
);
</script>
