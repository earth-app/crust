<template>
	<UModal
		v-model:open="isOpen"
		close
		:ui="{ content: 'sm:min-w-100 md:min-w-130 lg:min-w-160 xl:min-w-200' }"
	>
		<slot />

		<template #title>
			<div class="flex items-center">
				<UAvatar
					:src="avatar128"
					class="mr-2"
				/>
				<span>{{ mode === 'create' ? 'Create New Event' : 'Edit Event' }}</span>
			</div>
		</template>

		<template #body>
			<EventForm
				:mode="mode"
				:event="event"
				@submitted="isOpen = false"
			/>
		</template>
	</UModal>
</template>

<script setup lang="ts">
import type { Event } from '~/shared/types/event';

const props = defineProps<{
	event?: Partial<Event>;
	mode: 'create' | 'edit';
}>();

const { user } = useAuth();
const { avatar128 } = useUser(props.event?.hostId || user.value?.id || '');

const isOpen = ref(false);
</script>
