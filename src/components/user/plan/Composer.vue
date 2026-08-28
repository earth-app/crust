<template>
	<div
		id="user-plan"
		class="flex flex-col gap-3 w-full max-w-2xl p-4 bg-elevated light:bg-muted border-2 border-default rounded-lg"
	>
		<div class="flex items-start justify-between gap-3">
			<div class="min-w-0">
				<h3 class="text-lg font-semibold">Make One Plan</h3>
				<p class="text-sm text-muted">
					Pick when it happens and what you'll do. One plan, kept in your head, not a list.
				</p>
			</div>
			<UIcon
				name="mdi:map-marker-path"
				class="size-7 shrink-0 text-muted"
			/>
		</div>

		<USkeleton
			v-if="loading && stage === 'idle'"
			class="h-10 rounded-lg"
		/>

		<div
			v-else-if="stage === 'active'"
			id="plan-active"
			class="flex flex-col gap-2 p-3 rounded-lg bg-default border border-default"
		>
			<p class="text-sm font-medium">One Plan Running</p>
			<p class="text-xs text-muted">
				You know what it is. Nothing to check back on
				<template v-if="expiresLabel">- it rests {{ expiresLabel }}.</template>
			</p>
		</div>

		<template v-else-if="stage === 'formed'">
			<div
				id="plan-sentence"
				class="p-4 rounded-lg bg-default border-2 border-primary/40 motion-preset-fade-md"
			>
				<p class="text-base font-medium">{{ sentence }}</p>
			</div>
			<p class="text-xs text-muted">
				Read it once more, then close this. It is not saved anywhere you can look it up.
			</p>
			<UButton
				id="plan-rehearse"
				color="primary"
				variant="soft"
				icon="mdi:check"
				:loading="loading"
				:disabled="loading"
				@click="rehearse"
			>
				I've Got It
			</UButton>
		</template>

		<template v-else-if="stage === 'menu' && menu">
			<div class="flex flex-col gap-2">
				<p class="text-sm font-medium">When</p>
				<URadioGroup
					v-model="cueId"
					:items="cueItems"
					class="text-sm"
				/>
			</div>

			<div class="flex flex-col gap-2">
				<p class="text-sm font-medium">Then I Will</p>
				<URadioGroup
					v-model="responseId"
					:items="responseItems"
					class="text-sm"
				/>
			</div>

			<UButton
				id="plan-submit"
				color="primary"
				icon="mdi:check-bold"
				:loading="loading"
				:disabled="loading || !cueId || !responseId"
				@click="submit"
			>
				That's My Plan
			</UButton>
		</template>

		<p
			v-if="error"
			class="text-sm text-muted"
		>
			{{ error }}
		</p>

		<UButton
			v-if="stage === 'idle'"
			id="plan-start"
			color="primary"
			variant="soft"
			icon="mdi:pencil-outline"
			:loading="loading"
			:disabled="loading"
			@click="start"
		>
			Make a Plan
		</UButton>
	</div>
</template>

<script setup lang="ts">
import type { PlanMenu } from 'types/plans';

const props = defineProps<{ places?: string[] }>();

const { menu: fetchMenu, form, status, rehearsed } = usePlan();

type Stage = 'idle' | 'menu' | 'formed' | 'active';

const stage = ref<Stage>('idle');
const menu = ref<PlanMenu | null>(null);
const sentence = ref('');
const cueId = ref('');
const responseId = ref('');
const expiresAt = ref<number | null>(null);
const loading = ref(false);
const error = ref('');

const cueItems = computed(() =>
	(menu.value?.cues ?? []).map((cue) => ({ label: cue.text, value: cue.id }))
);

const responseItems = computed(() =>
	(menu.value?.responses ?? []).map((response) => ({
		label: response.text,
		value: response.id
	}))
);

const expiresLabel = computed(() => {
	if (!expiresAt.value) return '';
	const days = Math.ceil((expiresAt.value - Date.now()) / (24 * 60 * 60 * 1000));
	if (days <= 0) return 'today';
	return days === 1 ? 'tomorrow' : `in ${days} days`;
});

async function start() {
	loading.value = true;
	error.value = '';
	try {
		const res = await fetchMenu(props.places ?? []);
		if (!valid(res)) {
			error.value = 'Add a few activities first, then come back.';
			return;
		}
		menu.value = res.data;
		// the app writes the wording; the user does the linking, which is what keeps it theirs
		cueId.value = res.data.cues[0]?.id ?? '';
		responseId.value = res.data.responses[0]?.id ?? '';
		stage.value = 'menu';
	} finally {
		loading.value = false;
	}
}

async function submit() {
	if (!cueId.value || !responseId.value) return;

	loading.value = true;
	error.value = '';
	try {
		const res = await form(cueId.value, responseId.value);
		if (!valid(res)) {
			error.value = 'That plan could not be saved. Try once more.';
			return;
		}
		sentence.value = res.data.sentence;
		expiresAt.value = res.data.expires_at;
		menu.value = null;
		stage.value = 'formed';
	} finally {
		loading.value = false;
	}
}

async function rehearse() {
	loading.value = true;
	try {
		await rehearsed();
	} catch {
		// best-effort telemetry; a failed mark must never keep the sentence on screen
	} finally {
		// the sentence is dropped either way: it was shown once and that is the whole design
		sentence.value = '';
		stage.value = 'active';
		loading.value = false;
	}
}

onMounted(async () => {
	loading.value = true;
	try {
		const res = await status();
		if (valid(res) && res.data.active) {
			expiresAt.value = res.data.expires_at ?? null;
			stage.value = 'active';
		}
	} finally {
		loading.value = false;
	}
});
</script>
