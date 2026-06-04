<template>
	<ClientOnly>
		<Transition
			enter-active-class="transition duration-300 ease-out"
			leave-active-class="transition duration-200 ease-in"
			enter-from-class="opacity-0 translate-y-2"
			enter-to-class="opacity-100 translate-y-0"
			leave-from-class="opacity-100 translate-y-0"
			leave-to-class="opacity-0 translate-y-2"
		>
			<button
				v-if="visible"
				type="button"
				class="fixed left-1/2 -translate-x-1/2 z-40 bottom-20 flex items-center gap-2 px-4 py-2 rounded-full border border-default bg-elevated/95 backdrop-blur-sm shadow-lg shadow-black/30 text-sm font-medium hover:bg-elevated active:scale-95 transition-transform motion-preset-fade-md"
				aria-label="Scroll to Discover Quests"
				@click="onClick"
			>
				<span>Scroll to Discover Quests</span>
				<UIcon
					name="mdi:chevron-down"
					:class="reduced ? 'size-4' : 'size-4 animate-bounce'"
				/>
			</button>
		</Transition>
	</ClientOnly>
</template>

<script setup lang="ts">
// first-session scroll cue. quest-funneled. only renders for logged-in users on first 2 home visits
const STORAGE_DISMISSED = 'home_scroll_cue_dismissed_v1';
const STORAGE_VISITS = 'home_visits';
const VISIT_CAP = 2;
const SCROLL_THRESHOLD = 200;

const { user } = useAuth();
const router = useRouter();
const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');

const visible = ref(false);
let scrollHandler: (() => void) | null = null;

function dismiss(persist = true) {
	if (!visible.value) return;
	visible.value = false;
	if (persist && import.meta.client) {
		try {
			localStorage.setItem(STORAGE_DISMISSED, '1');
		} catch {
			// noop on storage failure
		}
	}
	teardown();
}

function teardown() {
	if (scrollHandler && import.meta.client) {
		window.removeEventListener('scroll', scrollHandler);
		scrollHandler = null;
	}
}

function onClick() {
	dismiss(true);
	// route to quests; matches site funnel
	void router.push('/profile/quests');
}

onMounted(() => {
	if (!user.value) return;

	let visits = 0;
	try {
		if (localStorage.getItem(STORAGE_DISMISSED)) return;
		visits = Number(localStorage.getItem(STORAGE_VISITS) || '0');
		if (visits >= VISIT_CAP) return;
		localStorage.setItem(STORAGE_VISITS, String(visits + 1));
	} catch {
		return;
	}

	visible.value = true;

	scrollHandler = () => {
		if (window.scrollY > SCROLL_THRESHOLD) dismiss(true);
	};
	window.addEventListener('scroll', scrollHandler, { passive: true });
});

onBeforeUnmount(() => {
	teardown();
});
</script>
