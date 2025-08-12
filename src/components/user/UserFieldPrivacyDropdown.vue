<template>
	<ClientOnly>
		<UDropdownMenu
			title="Privacy Settings"
			:items="items"
			:ui="{ content: 'w-48' }"
		>
			<UButton
				:icon="loading ? 'eos-icons:loading' : icons[selectedIndex]"
				:label="label"
				color="neutral"
				variant="outline"
			/>
			<template #item="{ item }">
				<button
					class="flex items-center w-full px-2 py-1.5 gap-2 text-left"
					@click="updatePrivacy(item)"
				>
					<div class="flex flex-col">
						<div class="flex flex-row items-center gap-1">
							<UIcon
								name="i-heroicons-check"
								class="w-4 h-4 text-primary"
								v-show="selected === item.value"
							/>
							<UIcon
								:name="item.icon || 'mdi:lock'"
								class="w-4 h-4 text-gray-600"
								v-show="selected !== item.value"
							/>
							<span class="font-medium text-sm">
								{{ item.label }}
								<span
									v-if="
										com.earthapp.account.Account.isNeverPublic(props.field) &&
										item.value === 'PUBLIC'
									"
								>
									(Disabled)</span
								>
							</span>
						</div>
						<span
							v-if="item.description"
							class="text-xs text-gray-500"
							>{{ item.description }}</span
						>
					</div>
				</button>
			</template>
		</UDropdownMenu>
		<template #fallback>
			<UButton
				:icon="loading ? 'eos-icons:loading' : icons[selectedIndex]"
				:label="label"
				color="neutral"
				variant="outline"
				disabled
			/>
		</template>
	</ClientOnly>
</template>

<script setup lang="ts">
import { com } from '@earth-app/ocean';
import type { DropdownMenuItem } from '@nuxt/ui';
import { updateFieldPrivacy } from '~/compostables/useUser';
import type { User } from '~/shared/types/user';

const props = defineProps<{
	user: User;
	label: string;
	field: keyof User['account']['field_privacy'];
}>();

const user = props.user;

const loading = ref(false);
const selected = ref(user.account.field_privacy[props.field] || 'PRIVATE');
const selectedIndex = computed(() => {
	return com.earthapp.account.Privacy.values().findIndex((value) => value.name === selected.value);
});

const icons = ['mdi:lock', 'mdi:circle-outline', 'mdi:account-box', 'mdi:office-building'];
const descriptions = [
	'Only you can see',
	'Your choose who can see',
	'Your mutual friends can see',
	'Everyone can see'
];
const items = ref<DropdownMenuItem[]>(
	com.earthapp.account.Privacy.values().map((value) => ({
		label: value.name.charAt(0).toUpperCase() + value.name.slice(1).toLowerCase(),
		icon: icons[value.ordinal],
		value: value.name,
		description: descriptions[value.ordinal],
		checked: selected.value === value.name,
		disabled:
			(com.earthapp.account.Account.isNeverPublic(props.field) && value.name === 'PUBLIC') ||
			selected.value === value.name
	}))
);

async function updatePrivacy(item: DropdownMenuItem) {
	if (item.disabled) return;
	loading.value = true;

	const res = await updateFieldPrivacy({ [props.field]: item.value });
	if (!res.success) {
		console.error('Failed to update privacy:', res.message);

		const toast = useToast();
		toast.add({
			title: 'Error',
			description: res.message || 'Failed to update privacy setting.',
			color: 'error',
			duration: 5000
		});

		return;
	}

	user.account.field_privacy[props.field] = item.value as any;
	selected.value = item.value;

	const toast = useToast();
	toast.add({
		title: 'Success',
		description: `Privacy updated to ${item.label}.`,
		color: 'success',
		duration: 3000
	});

	loading.value = false;
}
</script>
