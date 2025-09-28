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
									src: avatar,
									alt: user?.full_name || `@${user?.username || 'anonymous'}`
								}
							: undefined
					"
					:rows="2"
					size="xl"
					class="w-3/5"
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
		<div class="flex items-center justify-center min-w-100 w-3/5 my-8">
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
		</div>
	</div>
</template>

<script setup lang="ts">
import { createPromptResponse, usePromptResponses } from '~/compostables/usePrompt';
import { useAuth } from '~/compostables/useUser';
import { type Prompt, type PromptResponse } from '~/shared/types/prompts';

const { user, photo } = useAuth();
const avatar = ref<string>('https://cdn.earth-app.com/earth-app.png');
watch(
	() => photo.value,
	(photo) => {
		if (photo) {
			if (avatar.value && avatar.value.startsWith('blob:')) URL.revokeObjectURL(avatar.value);

			const blob = URL.createObjectURL(photo);
			avatar.value = blob;
		}
	},
	{ immediate: true }
);

onBeforeUnmount(() => {
	if (avatar.value && avatar.value.startsWith('blob:')) URL.revokeObjectURL(avatar.value);
});

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
		responses.value.unshift(res.data);
		newResponse.value = '';
	}

	posting.value = false;
}

let observer: IntersectionObserver | null = null;

async function loadResponses() {
	if (isLoading.value || !hasMore.value) return;

	isLoading.value = true;
	const { responses } = usePromptResponses(props.prompt.id);
	if (responses.value.length > 0) {
		responses.value.push(...responses.value);
		page.value++;
	} else {
		hasMore.value = false;
	}
}

onMounted(async () => {
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
