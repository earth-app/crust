<template>
	<ClientOnly>
		<UInputMenu
			placeholder="Select activities..."
			v-model="selectedActivities"
			:items="allActivities"
			:size="size"
			:class="className"
			multiple
			deleteIcon="i-lucide-trash"
			:loading="activitiesLoading"
			@update:modelValue="handleUpdate"
			@update:searchTerm="updateActivitiesList"
			:ui="{ tagsItemDeleteIcon: 'text-red-500' }"
		>
			<template #tags-item-text="{ item, index }">
				<div class="flex items-center justify-center">
					<UIcon
						:name="item.icon || 'material-symbols:activity-zone'"
						class="inline-block mr-1 size-4 md:size-5 lg:size-6"
					/>
					<span class="mr-1">{{ item.label }}</span>
				</div>
			</template>
		</UInputMenu>
		<template #fallback>
			<div :class="className + ' p-2 border rounded-md text-gray-500'">Loading activities...</div>
		</template>
	</ClientOnly>
</template>

<script setup lang="ts">
import type { Activity } from '~/shared/types/activity';

interface ActivityItem {
	label: string;
	value: string;
	icon: string;
	disabled?: boolean;
}

const props = defineProps<{
	/**
	 * Array of activity IDs (strings) or Activity objects
	 */
	modelValue: string[] | Activity[];
	/**
	 * Size of the input menu
	 */
	size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
	/**
	 * Additional CSS classes
	 */
	class?: string;
	/**
	 * Maximum number of activities that can be selected
	 */
	maxActivities?: number;
}>();

const emit = defineEmits<{
	'update:modelValue': [value: string[]];
}>();

const toast = useToast();

const className = computed(() => props.class || 'min-w-105 w-3/7 max-w-140 mt-2');
const size = computed(() => props.size || 'xl');

const allActivities = ref<ActivityItem[]>([]);
const selectedActivities = ref<ActivityItem[]>([]);

const activitiesSearch = ref<string>('');
const activitiesLoading = ref(false);

// Initialize activities from modelValue
onMounted(() => {
	initializeActivities();
});

watch(
	() => props.modelValue,
	() => {
		initializeActivities();
	},
	{ deep: true }
);

function initializeActivities() {
	if (!props.modelValue || props.modelValue.length === 0) {
		selectedActivities.value = [];
		return;
	}

	// Check if modelValue contains Activity objects or just IDs
	const firstItem = props.modelValue[0];
	if (typeof firstItem === 'string') {
		// modelValue is array of IDs - fetch activity details if we don't have them
		const existingIds = allActivities.value.map((a) => a.value);
		const newIds = props.modelValue.filter((id) => !existingIds.includes(id as string));

		if (newIds.length > 0) {
			// Trigger a search to load these activities
			activitiesLoading.value = true;
			getAllActivities(-1, '').then((res) => {
				if (res.success && res.data) {
					const activities = res.data
						.filter((activity) => (props.modelValue as string[]).includes(activity.id))
						.map((activity) => ({
							label: activity.name,
							value: activity.id,
							icon: activity.fields['icon'] || 'material-symbols:activity-zone'
						}));

					allActivities.value = allActivities.value
						.concat(activities)
						.filter(
							(activity, index, self) => index === self.findIndex((a) => a.value === activity.value)
						);

					selectedActivities.value = allActivities.value.filter((a) =>
						(props.modelValue as string[]).includes(a.value)
					);
				}
				activitiesLoading.value = false;
			});
		} else {
			// We already have these activities loaded
			selectedActivities.value = allActivities.value.filter((a) =>
				(props.modelValue as string[]).includes(a.value)
			);
		}
	} else {
		// modelValue is array of Activity objects
		const activities = props.modelValue as Activity[];
		const current = activities
			.map((activity) => ({
				label: activity.name,
				value: activity.id,
				icon: activity.fields['icon'] || 'material-symbols:activity-zone'
			}))
			.filter(Boolean);

		allActivities.value = current;
		selectedActivities.value = current;
	}
}

function updateActivitiesList(search: string) {
	activitiesSearch.value = search;
	activitiesLoading.value = true;

	getAllActivities(-1, activitiesSearch.value).then((res) => {
		if (res.success) {
			const activities =
				res.data?.map((activity) => ({
					label: activity.name,
					value: activity.id,
					icon: activity.fields['icon'] || 'material-symbols:activity-zone'
				})) || [];

			allActivities.value = allActivities.value
				.concat(activities)
				.filter(
					(activity, index, self) => index === self.findIndex((a) => a.value === activity.value)
				); // Remove duplicates

			activitiesLoading.value = false;
		} else {
			console.error(res.message || 'Failed to fetch activities.');
			toast.add({
				title: 'Error',
				description: res.message || 'Failed to fetch activities.',
				icon: 'mdi:alert',
				color: 'error',
				duration: 5000
			});
			allActivities.value = [];
			activitiesLoading.value = false;
		}
	});
}

function handleUpdate() {
	if (selectedActivities.value.length === 0) {
		emit('update:modelValue', []);
		return;
	}

	const maxActivities = props.maxActivities || 10;
	if (selectedActivities.value.length > maxActivities) {
		toast.add({
			title: 'Too Many Activities',
			description: `You can only select up to ${maxActivities} activities.`,
			color: 'warning',
			duration: 5000
		});
		return;
	}

	// Emit array of activity IDs
	emit(
		'update:modelValue',
		selectedActivities.value.map((activity) => activity.value)
	);
}
</script>
