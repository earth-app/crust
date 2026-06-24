<template>
	<div class="flex flex-col gap-3">
		<div
			v-if="flatEntries.length === 0"
			class="text-sm text-muted py-3 text-center rounded border border-default border-dashed"
		>
			No recorded progress.
		</div>

		<div
			v-for="(entry, i) in flatEntries"
			:key="`${entry.index}-${entry.altIndex ?? 0}-${i}`"
			class="rounded-lg border border-default p-3 flex flex-col gap-2 bg-neutral-800"
		>
			<div class="flex items-center justify-between gap-2 flex-wrap">
				<div class="flex items-center gap-2 min-w-0">
					<UIcon
						:name="getStepIcon(entry.type)"
						class="size-5 shrink-0"
					/>
					<span class="font-medium truncate">{{ prettyType(entry.type) }}</span>
					<UBadge
						color="neutral"
						variant="subtle"
						size="xs"
						>Step {{ (entry.index ?? 0) + 1
						}}<span v-if="entry.altIndex !== undefined">
							· alt {{ entry.altIndex + 1 }}</span
						></UBadge
					>
				</div>
				<div class="flex items-center gap-1.5 flex-wrap">
					<UBadge
						v-if="typeof entry.pointsAwarded === 'number'"
						color="success"
						variant="subtle"
						size="xs"
						icon="mdi:star"
						>+{{ entry.pointsAwarded }}</UBadge
					>
					<span
						v-if="entry.submittedAt"
						class="text-xs text-muted"
						>{{ when(entry.submittedAt) }}</span
					>
				</div>
			</div>

			<div
				v-if="entry.migrated"
				class="text-xs text-warning flex items-center gap-1.5"
			>
				<UIcon name="mdi:alert-outline" />
				<span>Migrated placeholder — original submission data is no longer available.</span>
			</div>

			<div
				v-else
				class="flex flex-col gap-2"
			>
				<img
					v-if="entry.data && isImageData(entry.data)"
					:src="entry.data"
					alt="Submitted image"
					class="self-center max-w-full max-h-72! rounded-lg object-contain border-2 border-neutral-600"
				/>
				<audio
					v-else-if="entry.data && isAudioData(entry.data)"
					:src="entry.data"
					controls
					class="w-full max-w-sm"
				/>

				<p
					v-if="entry.prompt"
					class="text-sm italic wrap-break-word"
				>
					"{{ entry.prompt }}"
				</p>
				<p
					v-if="entry.text"
					class="text-sm wrap-break-word whitespace-pre-line"
				>
					{{ entry.text }}
				</p>

				<div class="flex flex-wrap gap-1.5 text-xs">
					<UBadge
						v-if="typeof entry.score === 'number'"
						color="info"
						variant="subtle"
						size="sm"
						>Score: {{ entry.score }}</UBadge
					>
					<UBadge
						v-if="entry.kind"
						color="neutral"
						variant="subtle"
						size="sm"
						>{{ entry.kind }}<span v-if="entry.title">: {{ entry.title }}</span></UBadge
					>
					<UBadge
						v-if="typeof entry.distance === 'number'"
						color="neutral"
						variant="subtle"
						size="sm"
						>{{ comma(entry.distance) }} m</UBadge
					>
					<UBadge
						v-if="typeof entry.duration === 'number'"
						color="neutral"
						variant="subtle"
						size="sm"
						>{{ comma(entry.duration) }} s</UBadge
					>
				</div>

				<!-- referenced content (event/article); optional card since content auto-deletes
				     while the quest step is preserved -->
				<AdminQuestContentRef
					v-for="ref in contentRefs(entry)"
					:key="ref.kind + ref.id"
					:kind="ref.kind"
					:id="ref.id"
				/>

				<!-- moderation metadata: device + location can flag spoofed/mismatched submissions.
				     location is omitted when both coords are 0 (placeholder; not captured for the step) -->
				<div
					v-if="entry.device?.os || entry.device?.model || entry.device?.make || hasLocation(entry)"
					class="flex flex-wrap items-center gap-1.5 text-xs text-muted"
				>
					<UIcon
						name="mdi:cellphone-information"
						class="size-3.5"
					/>
					<span v-if="entry.device?.os">{{ entry.device.os }}</span>
					<span v-if="entry.device?.model">· {{ entry.device.model }}</span>
					<span v-if="entry.device?.make">· {{ entry.device.make }}</span>
					<span v-if="hasLocation(entry)">
						· {{ deviceLat(entry)?.toFixed(4) }}, {{ deviceLng(entry)?.toFixed(4) }}</span
					>
				</div>

				<a
					v-if="entry.data"
					:href="entry.data"
					:download="`quest-${entry.index ?? 0}-${entry.altIndex ?? 0}`"
					class="text-xs text-blue-500 hover:underline self-start"
					>Download Submission</a
				>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';

const props = defineProps<{
	progress?: (QuestProgressEntry | QuestProgressEntry[])[];
}>();

const { getStepIcon } = useQuests();

const flatEntries = computed<QuestProgressEntry[]>(() =>
	(props.progress ?? []).flatMap((slot) => (Array.isArray(slot) ? slot : slot ? [slot] : []))
);

function prettyType(type: string): string {
	return type
		.split('_')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

// content the step references; the id stays even after the content is auto-deleted
function contentRefs(entry: QuestProgressEntry): { kind: 'article' | 'event'; id: string }[] {
	if (entry.type === 'article_quiz' && entry.scoreKey) {
		// scoreKey is `article:quiz_score:{userId}:{articleId}`
		const articleId = entry.scoreKey.split(':')[3];
		if (articleId) return [{ kind: 'article', id: articleId }];
	}
	if ((entry.type === 'attend_event' || entry.type === 'submit_event_image') && entry.eventId) {
		return [{ kind: 'event', id: entry.eventId }];
	}
	return [];
}

function isImageData(data: string): boolean {
	return data.startsWith('data:image');
}

function isAudioData(data: string): boolean {
	return data.startsWith('data:audio');
}

function deviceLat(entry: QuestProgressEntry): number | undefined {
	return entry.lat ?? entry.device?.latitude;
}

function deviceLng(entry: QuestProgressEntry): number | undefined {
	return entry.lng ?? entry.device?.longitude;
}

// 0,0 is the placeholder sent when a step doesn't capture location; treat it as absent
function hasLocation(entry: QuestProgressEntry): boolean {
	const la = deviceLat(entry);
	const ln = deviceLng(entry);
	if (la === undefined || ln === undefined) return false;
	return !(la === 0 && ln === 0);
}

function when(ms: number): string {
	return DateTime.fromMillis(ms).toRelative() || 'recently';
}
</script>
