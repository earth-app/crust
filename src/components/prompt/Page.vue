<template>
	<div class="flex flex-col items-center w-full px-16">
		<div class="flex flex-col items-center justify-center w-full px-4">
			<PromptCard
				:prompt="prompt"
				no-link
			/>
			<div class="flex w-full justify-center items-center my-2">
				<UTextarea
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
				<UButton
					class="ml-4"
					color="secondary"
					:loading="posting"
					:disabled="posting || !user || newResponse.trim().length === 0"
					@click="postResponse"
					>Post</UButton
				>
			</div>
			<USeparator class="my-4 mx-3 w-4/5" />
		</div>
		<div class="flex flex-col items-center justify-center min-w-100 w-3/5 my-8">
			<div
				v-for="response in responses"
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
	</div>
</template>

<script setup lang="ts">
import { type Prompt, type PromptResponse } from '~/shared/types/prompts';
import { makeClientAPIRequest } from '~/shared/util';

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

	const res = await createPromptResponse(props.prompt.id, newResponse.value);
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

		// Tap Prompts Journey
		const journeyRes = await tapCurrentJourney('prompt');
		if (journeyRes.success && journeyRes.data) {
			toast.add({
				title: 'Journey Updated',
				description: `Your prompts streak is now at ${journeyRes.data.count} prompts on your journey!`,
				icon: 'solar:flame-bold',
				color: 'success',
				duration: 5000
			});
		} else {
			toast.add({
				title: 'Journey Update Failed',
				description: journeyRes.message || 'An unknown error occurred.',
				icon: 'mdi:alert-circle-outline',
				color: 'error',
				duration: 5000
			});
		}
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
</script>
