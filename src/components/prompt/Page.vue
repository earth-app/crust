<template>
	<div class="flex flex-col items-center w-full px-16">
		<div class="flex flex-col items-center justify-center w-full px-4">
			<LazyPromptCard
				:prompt="prompt"
				no-link
				hydrate-on-idle
			/>
			<div class="flex w-full justify-center items-center my-2">
				<UTextarea
					id="response-input"
					v-model="newResponse"
					:avatar="
						user
							? {
									src: avatar128,
									alt: handle
								}
							: undefined
					"
					:rows="2"
					size="xl"
					class="w-3/5 min-w-50"
					:placeholder="user ? `Write your response...` : 'Please log in to respond'"
					autoresize
					:loading="posting"
					:disabled="posting || !user"
					@keyup.enter="postResponse"
				/>
				<div class="flex ml-4 gap-1">
					<UButton
						id="post-button"
						color="secondary"
						:loading="posting"
						:disabled="posting || !user || newResponse.trim().length === 0"
						@click="postResponse"
						>Post</UButton
					>
					<UButton
						color="secondary"
						variant="subtle"
						icon="mdi:progress-question"
						@click="startTour('prompt-profile')"
					/>
				</div>
			</div>
			<USeparator class="my-4 mx-3 w-4/5" />
		</div>
		<div class="flex flex-col items-center justify-center min-w-100 w-3/5 my-8">
			<div
				v-for="(response, i) in responses"
				:id="`response-${i}`"
				:key="response.id"
				class="w-full mx-3 my-2"
			>
				<PromptResponse
					:response="response"
					@deleted="
						responses.splice(
							responses.findIndex((r) => r.id === response.id),
							1
						)
					"
				/>
			</div>
			<div
				v-if="hasMore"
				ref="sentinelEl"
				class="h-1"
			></div>
			<p
				v-if="isLoading"
				class="text-gray-500 my-4"
			>
				Loading more responses...
			</p>
		</div>

		<ClientOnly>
			<SiteTour
				:steps="promptTour"
				name="Prompt Tour"
				tour-id="prompt-profile"
			/>
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
import { makeClientAPIRequest } from 'utils';

const { user, avatar128 } = useAuth();
const { handle } = useDisplayName(user);

const toast = useToast();

const responses = ref<PromptResponse[]>([]);
const page = ref(1);
const isLoading = ref(false);
const hasMore = ref(true);
const props = defineProps<{
	prompt: Prompt;
}>();

const posting = ref(false);
const newResponse = ref('');

async function postResponse() {
	if (posting.value) return;

	posting.value = true;

	const promptStore = usePromptStore();
	const res = await promptStore.createResponse(props.prompt.id, { content: newResponse.value });
	if (valid(res)) {
		responses.value.unshift(res.data);
		newResponse.value = '';
	}

	posting.value = false;
}

const sentinelEl = useTemplateRef<HTMLElement>('sentinelEl');

useIntersectionObserver(sentinelEl, async (entries) => {
	if (entries[0]?.isIntersecting) await loadResponses();
});

async function loadResponses() {
	if (isLoading.value || !hasMore.value) return;

	isLoading.value = true;

	// Directly fetch without using the composable's caching
	const res = await makeClientAPIRequest<{ items: PromptResponse[] }>(
		`/v2/prompts/${props.prompt.id}/responses?page=${page.value}&limit=25`
	);

	if (valid(res)) {
		const newItems = res.data.items;
		if (newItems.length > 0) {
			responses.value.push(...newItems);
			page.value++;
		} else {
			hasMore.value = false;
		}
	} else {
		hasMore.value = false;
	}

	isLoading.value = false;
}

onMounted(async () => {
	// Clear any existing responses to ensure fresh data on page load
	responses.value = [];
	page.value = 1;
	hasMore.value = true;

	await loadResponses();
});

// prompt tour

const { startTour } = useSiteTour();

const promptTour: SiteTourStep[] = [
	{
		title: 'Welcome to Prompts',
		description:
			'Prompts are short, creative or thoughtful questions designed to make you think - and to spark conversation. Read the prompt above, then scroll to see what the community wrote.',
		footer: 'There’s no right answer. The best responses are honest and specific.',
		icon: 'mdi:lightbulb-on-outline',
		placement: 'center',
		dim: true
	},
	{
		id: 'response-input',
		title: 'Write Your Response',
		description:
			'Type your thoughts here. Keep it as short or as long as you like - a sentence is fine, an essay is fine. Press Enter to submit, Shift+Enter for a new line.',
		footer: 'You must be signed in to post. Responses inherit your account privacy settings.',
		icon: 'mdi:text-box-edit-outline',
		actions: user.value ? [{ type: 'focus', target: 'response-input', delay: 300 }] : undefined
	},
	{
		id: 'post-button',
		title: 'Post & Join the Conversation',
		description:
			'Click Post to share your response. It joins the feed below where others can read, react, and reply. You can edit or delete it later from your own profile.',
		footer: 'Posting a thoughtful prompt response earns Impact Points.',
		icon: 'mdi:send'
	}
];
</script>
