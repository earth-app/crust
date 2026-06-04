<template>
	<div class="flex flex-col items-center justify-center mt-24 sm:mt-4">
		<h2
			class="text-2xl font-semibold mr-4"
			id="prompts-title"
		>
			Today's Prompts
		</h2>
		<div
			id="prompts-toolbar"
			class="flex gap-x-2"
		>
			<UButton
				title="Refresh"
				icon="i-lucide-refresh-cw"
				color="neutral"
				variant="outline"
				class="mt-2"
				:loading="promptsList.isLoading"
				:disabled="promptsList.isLoading"
				@click="fetchPrompts"
			/>
			<UTooltip
				arrow
				:text="
					newDisabled
						? `You've reached your prompt limit. Upgrade to create more!`
						: `Click to create a prompt`
				"
			>
				<UButton
					title="Create Prompt"
					icon="mdi:plus"
					color="neutral"
					variant="outline"
					class="mt-2"
					:disabled="newDisabled"
					@click="$router.push('/prompts/new')"
				/>
			</UTooltip>
			<UButton
				icon="mdi:progress-question"
				color="secondary"
				variant="subtle"
				class="mt-2"
				@click="startTour('prompts-index')"
			/>
		</div>
		<div
			id="prompts"
			class="mt-12 w-9/10 grid grid-cols-1 lg:grid-cols-2 gap-x-8"
		>
			<LazyPromptCard
				v-for="prompt in promptsList.items"
				:key="prompt.id"
				:prompt="prompt"
				class="motion-preset-fade-md"
				hydrate-on-visible
			/>
			<InfoCardSkeleton
				v-for="n in promptsList.remaining"
				:key="`prompt-skel-${n}`"
				content-size="xs"
				class="mb-4"
			/>
		</div>
		<div class="flex justify-center w-full px-4 mt-8 mb-4">
			<div class="w-full max-w-2xl">
				<LazyWidgetSlot
					kind="MicroReflection"
					topic="prompts"
					hydrate-on-visible
				/>
			</div>
		</div>
	</div>

	<ClientOnly>
		<SiteTour
			:steps="promptsIndexTour"
			name="Prompts Index Tour"
			tour-id="prompts-index"
		/>
	</ClientOnly>
</template>

<script setup lang="ts">
const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Prompts');

const toast = useToast();

const promptsList = useIncrementalList<Prompt>({ staggerMs: 60, initialExpectedCount: 5 });

const { user, fetchUser } = useAuth();
const total = ref(0);
const newDisabled = computed(() => {
	switch (user.value?.account.account_type) {
		case 'ADMINISTRATOR':
			return false;
		case 'ORGANIZER':
		case 'WRITER':
			return total.value >= 10;
		default:
			return total.value >= 1;
	}
});

async function fetchPrompts() {
	promptsList.reset(5);
	await promptsList.load(async () => {
		const { fetchRandom } = usePrompts();
		const res = await fetchRandom(25);
		if (valid(res)) return res.data;

		toast.add({
			title: 'Error',
			icon: 'mdi:comment-off-outline',
			description: res.message || 'Failed to load prompts.',
			color: 'error',
			duration: 5000
		});
		console.error('Failed to load prompts:', res.message);
		return null;
	});
}

onMounted(async () => {
	await fetchUser();
	if (user.value) {
		const { total: total0 } = useUserPrompts(user.value.id);
		total.value = total0.value;
	}
	await fetchPrompts();
});

const { startTour } = useSiteTour();

const promptsIndexTour: SiteTourStep[] = [
	{
		id: 'prompts-title',
		title: "Today's Prompts",
		description:
			'A fresh batch of creative or thoughtful questions. Read one, answer one, or scroll until something catches your eye.',
		footer: 'Prompts rotate over time. Hit Refresh to see a new mix.',
		icon: 'mdi:lightbulb-on-outline'
	},
	{
		id: 'prompts-toolbar',
		title: 'Refresh & Create',
		description:
			'Refresh shuffles new prompts in. The plus button creates your own prompt - Writers and above can post multiple per day; Free accounts can post one.',
		footer: 'Want to post more? Upgrading to PRO removes the daily limit.',
		icon: 'mdi:plus-box-outline',
		highlightPadding: 8
	},
	{
		id: 'prompts',
		title: 'Prompt Cards',
		description:
			"Click any card to open the prompt page where you can read everyone's responses and post your own.",
		footer: 'Best practice: write your own response BEFORE reading others, for an unbiased take.',
		icon: 'mdi:cards-outline',
		highlightPadding: 12,
		waitFor: 'prompts',
		waitTimeout: 3000
	}
];
</script>
