<template>
	<ClientOnly>
		<Transition
			enter-active-class="transition duration-200 ease-out"
			leave-active-class="transition duration-150 ease-in"
			enter-from-class="opacity-0 -translate-y-2"
			enter-to-class="opacity-100 translate-y-0"
			leave-from-class="opacity-100 translate-y-0"
			leave-to-class="opacity-0 -translate-y-2"
		>
			<div
				v-if="show"
				id="cloud-degraded-banner"
				role="status"
				aria-live="polite"
				class="sticky top-0 z-50 flex w-full items-center justify-center gap-2 bg-warning px-3 py-2 text-sm text-inverted shadow-md"
			>
				<UIcon
					name="mdi:cloud-alert-outline"
					class="size-4 shrink-0"
				/>
				<span class="font-medium">Some Features are Unavailable</span>
				<span class="hidden opacity-90 sm:inline">
					Quests, trails and gardens may not load. Everything else works normally.
				</span>
				<UButton
					:to="STATUS_PAGE_URL"
					external
					target="_blank"
					size="xs"
					color="neutral"
					variant="ghost"
					class="ml-1"
					>Status</UButton
				>
				<UButton
					icon="mdi:close"
					size="xs"
					color="neutral"
					variant="ghost"
					aria-label="Dismiss"
					@click="dismissed = true"
				/>
			</div>
		</Transition>
	</ClientOnly>
</template>

<script setup lang="ts">
import { STATUS_PAGE_URL } from 'backend';
import { useBackendStore } from 'stores/backend';

const backend = useBackendStore();

/* dismissible per page load, not persisted: the state is live, so a stored dismissal would hide a
   real outage on a later visit. it comes back on reload, which is the honest behaviour */
const dismissed = ref(false);

const show = computed(() => backend.isDegraded && !dismissed.value);

// a recovered cloud clears the dismissal so a LATER outage is not silently swallowed
watch(
	() => backend.isDegraded,
	(degraded) => {
		if (!degraded) dismissed.value = false;
	}
);
</script>
