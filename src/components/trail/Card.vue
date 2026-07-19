<template>
	<component
		:is="rootComp"
		class="rounded-xl h-full *:h-full min-w-70"
		:thickness="highlight ? 2 : undefined"
		:data-trail-id="trail.id"
	>
		<div
			class="flex flex-col gap-3 p-4 h-full rounded-xl border bg-default hover:border-primary/50 transition-all"
			:class="
				trail.premium
					? 'border-warning/50 hover:border-warning/70'
					: 'border-neutral-200 dark:border-neutral-800'
			"
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
				:total="1"
				noun="Wonder"
				icon="mdi:map-marker-question-outline"
				class="self-start"
			/>

			<div class="flex items-center justify-between gap-2 mt-auto pt-1">
				<div class="flex items-center gap-3 text-xs opacity-70">
					<span class="flex items-center gap-1">
						<UIcon
							:name="practiceMeta.icon"
							class="size-3.5"
						/>
						{{ practiceMeta.label }}
					</span>
					<span class="flex items-center gap-1">
						<UIcon
							name="mdi:timer-sand"
							class="size-3.5"
						/>
						~{{ targetMinutes }} min
					</span>
				</div>
				<div class="flex items-center gap-1 shrink-0">
					<UButton
						variant="soft"
						color="info"
						size="sm"
						icon="mdi:eye-outline"
						square
						aria-label="Preview Trail"
						@click.stop="emit('preview', trail.id)"
					/>
					<UButton
						:color="trail.premium ? 'warning' : 'primary'"
						size="sm"
						icon="mdi:map-marker-path"
						@click.stop="emit('select', trail.id)"
						>Begin Trail</UButton
					>
				</div>
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
	preview: [id: string];
}>();

const trailsStore = useTrailsStore();
const practiceMeta = computed(() => trailPracticeMeta(props.trail.practice));
const targetMinutes = computed(() => trailTargetMinutes(props.trail));
// curiosity-gap: the single awe reveal stays hidden until the practice is done
const revealed = computed(() => (trailsStore.getRun(props.trail.id)?.completed ? 1 : 0));

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
		({
			nature: 'Nature',
			curiosity: 'Curiosity',
			creative: 'Creative',
			reflective: 'Reflective',
			mixed: 'Mixed'
		})[props.trail.theme] ?? 'Mixed'
);
</script>
