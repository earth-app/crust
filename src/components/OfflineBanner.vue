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
				v-if="isOffline"
				role="status"
				aria-live="polite"
				class="sticky top-0 z-50 w-full bg-warning-600 text-white text-sm flex items-center justify-center gap-2 px-3 py-2 shadow-md light:bg-warning-100 light:text-warning-900"
			>
				<UIcon
					name="mdi:cloud-off-outline"
					class="size-4"
				/>
				<span class="font-medium">You're offline.</span>
				<span class="opacity-90 hidden sm:inline">
					Changes you make will be saved and synced when you reconnect.
				</span>
				<span
					v-if="pendingMutations.length > 0"
					class="ml-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold"
				>
					<UIcon
						name="mdi:cloud-upload-outline"
						class="size-3"
					/>
					{{ pendingMutations.length }} pending
				</span>
			</div>
		</Transition>
	</ClientOnly>
</template>

<script setup lang="ts">
import { isOffline, pendingMutations } from '~/composables/useNetwork';
</script>
