<template>
	<div class="flex flex-col gap-4">
		<div class="flex flex-col gap-2">
			<span class="text-xs font-semibold text-muted uppercase tracking-wide"
				>Start From a Template</span
			>
			<div class="flex flex-wrap gap-2">
				<UButton
					v-for="template in templates"
					:key="template.id"
					:icon="template.icon"
					color="primary"
					variant="soft"
					size="sm"
					@click="applyTemplate(template.id)"
					>{{ template.label }}</UButton
				>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
			<UFormField
				label="Title"
				class="sm:col-span-2"
			>
				<UInput
					v-model="model.title"
					placeholder="Into the Wild"
					class="w-full"
				/>
			</UFormField>
			<UFormField
				label="Description"
				class="sm:col-span-2"
			>
				<UTextarea
					v-model="model.description"
					:rows="2"
					placeholder="Step outside and reconnect with the natural world around you."
					class="w-full"
				/>
			</UFormField>
			<UFormField label="Icon">
				<UInput
					v-model="model.icon"
					placeholder="mdi:pine-tree"
					class="w-full"
				>
					<template #trailing>
						<UIcon
							:name="model.icon || 'mdi:flag-checkered'"
							class="size-5 text-primary"
						/>
					</template>
				</UInput>
			</UFormField>
			<UFormField label="Rarity">
				<USelect
					v-model="model.rarity"
					:items="rarityItems"
					class="w-full"
				/>
			</UFormField>
			<UFormField label="Completion Reward">
				<UInput
					v-model.number="model.reward"
					type="number"
					:min="0"
				/>
			</UFormField>
		</div>

		<div class="flex flex-wrap items-center gap-4">
			<USwitch
				v-model="model.premium"
				label="Premium"
			/>
			<USwitch
				v-model="model.mobile_only"
				label="Mobile Only"
			/>
			<USwitch
				v-model="model.mastery"
				label="Badge Mastery"
			/>
		</div>

		<div class="flex flex-col gap-2">
			<span class="text-sm font-semibold">Required Permissions</span>
			<div class="flex flex-wrap gap-2">
				<UButton
					v-for="permission in permissions"
					:key="permission.value"
					:icon="permission.icon"
					:color="hasPermission(permission.value) ? 'primary' : 'neutral'"
					:variant="hasPermission(permission.value) ? 'solid' : 'soft'"
					size="sm"
					@click="togglePermission(permission.value)"
					>{{ permission.label }}</UButton
				>
			</div>
		</div>

		<div class="flex flex-col gap-3">
			<div class="flex items-center justify-between">
				<span class="text-sm font-semibold">Steps ({{ model.steps.length }})</span>
				<UButton
					icon="mdi:plus"
					color="neutral"
					variant="soft"
					size="sm"
					@click="addStep"
					>Add Step</UButton
				>
			</div>

			<AdminMarketingQuestStepEditor
				v-for="(step, index) in model.steps"
				:key="step._id"
				:step="step"
				:index="index"
				:total="model.steps.length"
				:in-alt-group="inAltGroup(index)"
				:grouped-with-previous="groupedWithPrevious(index)"
				@remove="removeStep(index)"
				@move-up="moveStep(index, -1)"
				@move-down="moveStep(index, 1)"
				@toggle-group="toggleGroup(index)"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
// BuilderQuest, QuestPermission, the builder factory helpers, and QUEST_* constants are all
// auto-imported (shared/utils + shared/types); leaving them unimported keeps the defineProps
// macro type resolver off the ~/shared alias path it cannot follow in a Vite build
const props = defineProps<{
	model: BuilderQuest;
}>();

const emit = defineEmits<{
	template: [title: string];
}>();

const templates = QUEST_TEMPLATES;

const rarityItems = QUEST_RARITIES.map((r) => ({
	label: r.charAt(0).toUpperCase() + r.slice(1),
	value: r
}));

const permissions: { value: QuestPermission; label: string; icon: string }[] = [
	{ value: 'camera', label: 'Camera', icon: 'mdi:camera-outline' },
	{ value: 'location', label: 'Location', icon: 'mdi:map-marker-outline' },
	{ value: 'record', label: 'Microphone', icon: 'mdi:microphone-outline' }
];

function hasPermission(p: QuestPermission) {
	return props.model.permissions.includes(p);
}

function togglePermission(p: QuestPermission) {
	const idx = props.model.permissions.indexOf(p);
	if (idx === -1) props.model.permissions.push(p);
	else props.model.permissions.splice(idx, 1);
}

function applyTemplate(id: string) {
	const template = questTemplate(id);
	if (!template) return;
	props.model.title = template.title;
	props.model.description = template.description;
	props.model.icon = template.icon;
	props.model.rarity = template.rarity;
	props.model.reward = template.reward;
	props.model.premium = template.premium;
	props.model.mobile_only = template.mobile_only;
	props.model.mastery = template.mastery;
	props.model.permissions = [...template.permissions];
	props.model.steps = template.steps;
	emit('template', template.title);
}

function addStep() {
	props.model.steps.push(newBuilderStep({ description: '' }));
}

function removeStep(index: number) {
	if (props.model.steps.length <= 1) return;
	props.model.steps.splice(index, 1);
}

function moveStep(index: number, direction: -1 | 1) {
	const target = index + direction;
	if (target < 0 || target >= props.model.steps.length) return;
	const steps = props.model.steps;
	[steps[index], steps[target]] = [steps[target], steps[index]];
}

// a step belongs to an alt-group when it shares a non-null groupId with an adjacent step
function inAltGroup(index: number) {
	const steps = props.model.steps;
	const gid = steps[index].groupId;
	if (!gid) return false;
	return steps[index - 1]?.groupId === gid || steps[index + 1]?.groupId === gid;
}

function groupedWithPrevious(index: number) {
	if (index === 0) return false;
	const steps = props.model.steps;
	const gid = steps[index].groupId;
	return !!gid && steps[index - 1]?.groupId === gid;
}

function toggleGroup(index: number) {
	if (index === 0) return;
	const steps = props.model.steps;
	if (groupedWithPrevious(index)) {
		steps[index].groupId = null;
		return;
	}
	// adopt the previous step's group, creating one if it has none
	const prev = steps[index - 1];
	if (!prev.groupId) prev.groupId = nextLocalId('grp');
	steps[index].groupId = prev.groupId;
}
</script>
