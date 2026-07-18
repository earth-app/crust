<template>
	<div class="flex flex-col gap-3 rounded-lg border border-default bg-elevated/30 p-3">
		<div class="flex items-center justify-between gap-2">
			<div class="flex items-center gap-2">
				<UIcon
					:name="stepIcon"
					class="size-5 text-primary"
				/>
				<span class="text-sm font-semibold">Step {{ index + 1 }}</span>
				<UBadge
					v-if="inAltGroup"
					color="secondary"
					variant="subtle"
					icon="mdi:vector-difference"
					size="xs"
					>Either / Or</UBadge
				>
				<UBadge
					v-if="isAlwaysMobile"
					color="info"
					variant="subtle"
					icon="mdi:cellphone-lock"
					size="xs"
					>Mobile Only</UBadge
				>
			</div>
			<div class="flex items-center gap-1">
				<UButton
					icon="mdi:arrow-up"
					color="neutral"
					variant="ghost"
					size="xs"
					:disabled="index === 0"
					aria-label="Move Step Up"
					@click="emit('move-up')"
				/>
				<UButton
					icon="mdi:arrow-down"
					color="neutral"
					variant="ghost"
					size="xs"
					:disabled="index === total - 1"
					aria-label="Move Step Down"
					@click="emit('move-down')"
				/>
				<UButton
					icon="mdi:trash-can-outline"
					color="error"
					variant="ghost"
					size="xs"
					:disabled="total <= 1"
					aria-label="Remove Step"
					@click="emit('remove')"
				/>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
			<UFormField label="Step Type">
				<USelect
					v-model="step.type"
					:items="stepTypeItems"
					class="w-full"
				/>
			</UFormField>
			<UFormField label="Coaching Hint">
				<UInput
					v-model="hintModel"
					placeholder="Shown as a first-quest tip on this step"
					class="w-full"
				/>
			</UFormField>
			<UFormField
				label="Description"
				class="sm:col-span-2"
			>
				<UTextarea
					v-model="step.description"
					:rows="2"
					placeholder="What should the user do for this step?"
					class="w-full"
				/>
			</UFormField>
			<UFormField label="Bonus Points">
				<UInput
					v-model.number="rewardModel"
					type="number"
					:min="0"
					placeholder="0"
				/>
			</UFormField>
			<UFormField label="Delay (Seconds)">
				<UInput
					v-model.number="delayModel"
					type="number"
					:min="0"
					placeholder="0"
				/>
			</UFormField>
		</div>

		<div class="flex flex-wrap items-center gap-4">
			<USwitch
				v-if="!isAlwaysMobile"
				v-model="mobileModel"
				label="Mobile Only"
			/>
			<USwitch
				v-if="index > 0"
				:model-value="groupedWithPrevious"
				label="Group With Previous (Either / Or)"
				@update:model-value="emit('toggle-group')"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
// BuilderStep + the QUEST_STEP_* constants are auto-imported from shared/utils; keep them
// unimported so the defineProps macro type resolver never has to follow a ~/shared alias
const props = defineProps<{
	step: BuilderStep;
	index: number;
	total: number;
	inAltGroup: boolean;
	groupedWithPrevious: boolean;
}>();

const emit = defineEmits<{
	remove: [];
	'move-up': [];
	'move-down': [];
	'toggle-group': [];
}>();

const { getStepIcon } = useQuests();

const stepTypeItems = QUEST_STEP_TYPES.map((type) => ({
	label: QUEST_STEP_TYPE_LABELS[type],
	value: type
}));

const stepIcon = computed(() => getStepIcon(props.step.type));
const isAlwaysMobile = computed(() => MOBILE_ONLY_STEP_TYPES.includes(props.step.type));

const hintModel = computed({
	get: () => props.step.tutorial_hint ?? '',
	set: (v: string) => (props.step.tutorial_hint = v)
});
const rewardModel = computed({
	get: () => props.step.reward ?? 0,
	set: (v: number) => (props.step.reward = Number.isFinite(v) ? v : 0)
});
const delayModel = computed({
	get: () => props.step.delay ?? 0,
	set: (v: number) => (props.step.delay = Number.isFinite(v) ? v : 0)
});
const mobileModel = computed({
	get: () => props.step.mobile_only === true,
	set: (v: boolean) => (props.step.mobile_only = v)
});
</script>
