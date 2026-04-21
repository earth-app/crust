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
				id="scroll-sentinel"
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
	if (res.success && res.data) {
		if ('message' in res.data) {
			toast.add({
				title: 'Error Posting Response',
				description: res.data.message || 'An unknown error occurred.',
				icon: 'mdi:alert-circle-outline',
				color: 'error',
				duration: 5000
			});

			posting.value = false;
			return;
		}

		responses.value.unshift(res.data);
		newResponse.value = '';
	}

	posting.value = false;
}

let observer: IntersectionObserver | null = null;

async function loadResponses() {
	if (isLoading.value || !hasMore.value) return;

	isLoading.value = true;

	// Directly fetch without using the composable's caching
	const res = await makeClientAPIRequest<{ items: PromptResponse[] }>(
		`/v2/prompts/${props.prompt.id}/responses?page=${page.value}&limit=25`
	);

	if (res.success && res.data && !('message' in res.data)) {
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

	const sentinel = document.querySelector('#scroll-sentinel');
	observer = new IntersectionObserver(async (entries) => {
		if (entries[0]?.isIntersecting) await loadResponses();
	});

	if (sentinel) observer.observe(sentinel);
});

onBeforeUnmount(() => {
	if (observer) observer.disconnect();
});

// prompt tour

const { startTour } = useSiteTour();

const promptTour: SiteTourStep[] = [
	{
		title: 'Welcome to Prompts!',
		description:
			'Prompts are a fun way to ask intellectual questions and share creative ideas with the community. This card displays the prompt details, including the prompt question, description, and any associated media.',
		footer: 'You can read the prompt and scroll down to see how others have responded to it!'
	},
	{
		id: 'response-input',
		title: 'Write a Response',
		description:
			'If you have a thought or idea related to the prompt, you can share it by writing a response in the input box. Just type your response and click the "Post" button to share it with the community!',
		footer: 'Try posting your own response to the prompt!'
	},
	{
		id: 'post-button',
		title: 'Posting a Response',
		description:
			'After you write your response, click the "Post" button to share it with the community. Your response will appear below, and others can read it and even reply to it!',
		footer: 'Go ahead and post your response to join the conversation!'
	}
];
</script>
