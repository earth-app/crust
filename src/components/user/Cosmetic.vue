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
			<div class="relative inline-flex items-center justify-center size-11">
				<Transition
					name="cosmetic-preview"
					mode="out-in"
				>
					<UAvatar
						v-if="displayUrl"
						:key="displayUrl"
						:src="displayUrl"
						:alt="props.cosmeticKey"
						size="2xl"
						:class="props.animated && !prefersReducedMotion ? 'cosmetic-animated' : ''"
					/>
					<USkeleton
						v-else
						class="size-11 rounded-full"
					/>
				</Transition>
				<UiSparkleBurst :trigger="celebrateTick" />
			</div>
			<h2 class="font-semibold text-sm text-center line-clamp-2">
				{{ capitalizeFully(props.cosmeticKey.replaceAll('_', ' ')) }}
			</h2>
			<div class="flex gap-1">
				<UBadge
					v-if="props.rarity"
					:color="rarityColor"
					variant="soft"
					size="sm"
					>{{ capitalizeFully(props.rarity || '') }}</UBadge
				>
				<UBadge
					v-if="props.animated"
					color="warning"
					variant="soft"
					icon="mdi:auto-fix"
					size="sm"
					>Animated</UBadge
				>
			</div>
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
	animated?: boolean;
	withSelf?: boolean;
	celebrateTick?: number;
}>();

const avatarStore = useAvatarStore();
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

// belt-and-suspenders: never let an undefined trigger reach SparkleBurst
const celebrateTick = computed(() => props.celebrateTick ?? 0);

// Read directly from the reactive store cache. Blob URLs are owned by the
// store, so we must not revoke them here - multiple components may share
// the same cached URL, and revoking would break siblings.
const baseUrl = computed(() => avatarStore.getPreview(props.cosmeticKey));
const selfUrl = computed(() => avatarStore.getSelfPreview(props.cosmeticKey));

// when withSelf is requested, prefer the self preview but fall back to the
// generic preview while the self call is still loading so the card never
// shows an empty avatar mid-fetch
const displayUrl = computed(() => {
	if (props.withSelf) {
		return selfUrl.value || baseUrl.value;
	}
	return baseUrl.value;
});

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
		if (!avatarStore.getPreview(newKey)) {
			void avatarStore.previewCosmetic(newKey);
		}
		if (props.withSelf && !avatarStore.getSelfPreview(newKey)) {
			void avatarStore.previewCosmeticWithSelf(newKey);
		}
	},
	{ immediate: true }
);

// fetch the self-preview lazily if withSelf gets flipped on after mount
watch(
	() => props.withSelf,
	(next) => {
		if (!next) return;
		if (!props.cosmeticKey) return;
		if (avatarStore.getSelfPreview(props.cosmeticKey)) return;
		void avatarStore.previewCosmeticWithSelf(props.cosmeticKey);
	}
);
</script>

<style scoped>
.cosmetic-animated {
	animation: cosmetic-spin 8s linear infinite;
	transform-origin: center;
	will-change: transform;
}

@keyframes cosmetic-spin {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}

/* smooth swap when displayUrl changes (skeleton -> generic preview -> self preview) */
.cosmetic-preview-enter-active,
.cosmetic-preview-leave-active {
	transition: opacity 200ms ease;
}

.cosmetic-preview-enter-from,
.cosmetic-preview-leave-to {
	opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
	.cosmetic-animated {
		animation: none;
	}

	.cosmetic-preview-enter-active,
	.cosmetic-preview-leave-active {
		transition: none;
	}
}
</style>
