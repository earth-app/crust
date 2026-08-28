<template>
	<div
		id="activity-surprise"
		class="flex flex-col gap-3 w-full max-w-2xl p-4 bg-elevated light:bg-muted border-2 border-default rounded-lg"
	>
		<div class="flex items-start justify-between gap-3">
			<div class="min-w-0">
				<h3 class="text-lg font-semibold">Something Unexpected</h3>
				<p class="text-sm text-muted">
					A draw from the far side of the catalog: whatever your activities are least like.
				</p>
			</div>
			<UIcon
				name="mdi:dice-multiple-outline"
				class="size-7 shrink-0 text-muted"
			/>
		</div>

		<InfoCardSkeleton
			v-if="loading && !activity"
			content-size="small"
		/>

		<ActivityCard
			v-else-if="activity"
			:activity="activity"
			class="motion-preset-fade-md"
		/>

		<p
			v-else-if="error"
			class="text-sm text-muted"
		>
			{{ error }}
		</p>

		<div class="flex items-center gap-2">
			<UButton
				color="primary"
				variant="soft"
				icon="mdi:refresh"
				:loading="loading"
				:disabled="loading"
				@click="draw"
			>
				{{ activity ? 'Draw Another' : 'Surprise Me' }}
			</UButton>
			<span
				v-if="activity && unrelated"
				class="text-xs text-muted"
			>
				Nothing about this overlaps what you already do.
			</span>
		</div>
	</div>
</template>

<script setup lang="ts">
const { drawSurpriseActivity } = useAuth();

const activity = ref<Activity | null>(null);
const unrelated = ref(false);
const loading = ref(false);
const error = ref('');

async function draw() {
	if (loading.value) return;

	loading.value = true;
	error.value = '';

	try {
		const res = await drawSurpriseActivity();
		if (valid(res)) {
			activity.value = res.data.activity;
			unrelated.value = Boolean(res.data.unrelated);
		} else {
			error.value = extractServerMessage(res, 'Nothing unexpected to show right now.');
		}
	} catch (err) {
		error.value = extractServerMessage(err, 'Nothing unexpected to show right now.');
	} finally {
		loading.value = false;
	}
}

defineExpose({ draw });
</script>
