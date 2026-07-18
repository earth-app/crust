<template>
	<component
		:is="rootComp"
		class="rounded-xl"
		:thickness="highlight ? 2 : undefined"
	>
		<div
			class="flex flex-col gap-3 p-4 h-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-default hover:border-primary/50 transition-colors"
		>
			<div class="flex items-start gap-3">
				<div
					class="flex items-center justify-center size-11 rounded-lg bg-primary/10 text-primary shrink-0"
				>
					<UIcon
						:name="trail.icon || 'mdi:map-marker-path'"
						class="size-6"
					/>
				</div>
				<div class="flex flex-col min-w-0">
					<h3 class="font-semibold truncate">{{ trail.title }}</h3>
					<div class="flex flex-wrap items-center gap-1 mt-0.5">
						<UBadge
							:color="rarityColor"
							variant="subtle"
							size="xs"
							>{{ rarityLabel }}</UBadge
						>
						<UBadge
							color="neutral"
							variant="soft"
							size="xs"
							>{{ themeLabel }}</UBadge
						>
						<UBadge
							v-if="trail.seasonal"
							color="warning"
							variant="soft"
							size="xs"
							icon="mdi:calendar-star"
							>Seasonal</UBadge
						>
						<UBadge
							v-if="trail.premium"
							color="primary"
							variant="soft"
							size="xs"
							icon="mdi:diamond-stone"
							>Premium</UBadge
						>
					</div>
				</div>
			</div>

			<p class="text-sm opacity-80 line-clamp-3 wrap-break-word">{{ trail.description }}</p>

			<UiCuriosityTeaser
				:revealed="revealed"
				:total="stepCount"
				noun="Discovery"
				icon="mdi:map-marker-question-outline"
				class="self-start"
			/>

			<div class="flex items-center justify-between mt-auto pt-1">
				<div class="flex items-center gap-3 text-xs opacity-70">
					<span class="flex items-center gap-1">
						<UIcon
							name="mdi:flag-variant-outline"
							class="size-3.5"
						/>
						{{ stepCount }} {{ stepCount === 1 ? 'Step' : 'Steps' }}
					</span>
					<span class="flex items-center gap-1">
						<UIcon
							name="mdi:leaf"
							class="size-3.5"
						/>
						+{{ trail.reward }}
					</span>
				</div>
				<UButton
					color="primary"
					size="sm"
					icon="mdi:map-marker-path"
					@click="emit('select', trail.id)"
					>Begin Trail</UButton
				>
			</div>
		</div>
	</component>
</template>

<script setup lang="ts">
import { useTrailsStore } from 'stores/trails';

const props = defineProps<{
	trail: Trail;
}>();

const emit = defineEmits<{
	select: [id: string];
}>();

const trailsStore = useTrailsStore();
const stepCount = computed(() => props.trail.steps?.length ?? 0);
// curiosity-gap: how many awe reveals this trail still hides (Loewenstein info-gap)
const revealed = computed(() => {
	const run = trailsStore.getRun(props.trail.id);
	return run ? run.stepRevealed.filter(Boolean).length : 0;
});

// amazing/green trails earn the animated border; keep normal/rare calm
const highlight = computed(
	() => props.trail.rarity === 'amazing' || props.trail.rarity === 'green'
);
const GradientBorder = resolveComponent('UiAnimatedGradientBorder');
const rootComp = computed(() => (highlight.value ? GradientBorder : 'div'));

const rarityLabel = computed(
	() =>
		({ normal: 'Normal', rare: 'Rare', amazing: 'Amazing', green: 'Green' })[props.trail.rarity] ??
		'Normal'
);
const rarityColor = computed(
	() =>
		(({ normal: 'neutral', rare: 'info', amazing: 'warning', green: 'success' }) as const)[
			props.trail.rarity
		] ?? 'neutral'
);
const themeLabel = computed(
	() =>
		({ nature: 'Nature', curiosity: 'Curiosity', creative: 'Creative', mixed: 'Mixed' })[
			props.trail.theme
		] ?? 'Mixed'
);
</script>
