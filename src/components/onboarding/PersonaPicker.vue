<template>
	<UModal
		:open="open"
		:dismissible="!saving"
		title="Tell Us What You Like"
		@update:open="onOpenChange"
	>
		<template #content>
			<div class="p-6 flex flex-col gap-4 max-w-lg">
				<div class="flex items-start gap-3">
					<UIcon
						name="mdi:sparkles"
						class="size-7 text-secondary shrink-0"
					/>
					<div>
						<h2 class="text-lg font-semibold">Tailor Your Experience</h2>
						<p class="text-sm text-muted mt-1">
							Pick a vibe and three interests. We'll surface activities, quests, and prompts that
							match.
						</p>
					</div>
				</div>

				<div>
					<p class="text-xs font-medium text-muted mb-2 uppercase tracking-wide">
						I'm here mostly to…
					</p>
					<div class="grid grid-cols-2 gap-2">
						<button
							v-for="p in personas"
							:key="p.id"
							type="button"
							class="text-left rounded-lg border px-3 py-2 transition-colors"
							:class="
								persona === p.id
									? 'border-primary bg-primary/10'
									: 'border-default hover:border-secondary/50'
							"
							@click="persona = p.id"
						>
							<div class="flex items-center gap-2">
								<UIcon
									:name="p.icon"
									class="size-4"
								/>
								<span class="font-medium text-sm">{{ p.label }}</span>
							</div>
							<p class="text-xs text-muted mt-1">{{ p.blurb }}</p>
						</button>
					</div>
				</div>

				<div>
					<div class="flex items-center justify-between mb-2">
						<p class="text-xs font-medium text-muted uppercase tracking-wide">
							Interests ({{ interests.length }}/5)
						</p>
						<p
							v-if="interests.length < 3"
							class="text-xs text-warning"
						>
							Pick at least 3
						</p>
					</div>
					<div class="flex flex-wrap gap-2">
						<button
							v-for="i in suggestedInterests"
							:key="i.label"
							type="button"
							class="rounded-full border px-3 py-1 text-xs transition-colors"
							:class="
								interests.includes(i.label)
									? 'border-primary bg-primary text-inverted'
									: 'border-default hover:border-primary/50'
							"
							:disabled="!interests.includes(i.label) && interests.length >= 5"
							@click="toggleInterest(i.label)"
						>
							<UIcon
								:name="i.icon"
								class="size-3.5 inline-block mr-1"
							/>
							{{ i.label }}
						</button>
					</div>
				</div>

				<div class="flex gap-2 justify-end pt-2">
					<UButton
						variant="ghost"
						color="neutral"
						:disabled="saving"
						@click="close"
						>Cancel</UButton
					>
					<UButton
						color="primary"
						icon="mdi:check"
						:loading="saving"
						:disabled="!persona || interests.length < 3 || saving"
						@click="save"
					>
						Save & Start
					</UButton>
				</div>
			</div>
		</template>
	</UModal>
</template>

<script setup lang="ts">
const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
	(event: 'update:modelValue', value: boolean): void;
	(event: 'done'): void;
}>();

const open = computed(() => props.modelValue);
const onboarding = useOnboarding();
const toast = useToast();

const personas = [
	{
		id: 'learn',
		label: 'Learn',
		blurb: 'Read, take quizzes, deep-dive.',
		icon: 'mdi:book-open-variant'
	},
	{ id: 'do', label: 'Do', blurb: 'Hands-on activities and quests.', icon: 'mdi:hammer-wrench' },
	{
		id: 'connect',
		label: 'Connect',
		blurb: 'Meet people at events and prompts.',
		icon: 'mdi:account-group'
	},
	{ id: 'reflect', label: 'Reflect', blurb: 'Journal, prompts, slower pace.', icon: 'mdi:leaf' }
];

const suggestedInterests = [
	{ label: 'Hiking', icon: 'mdi:hiking' },
	{ label: 'Cooking', icon: 'mdi:chef-hat' },
	{ label: 'Photography', icon: 'mdi:camera' },
	{ label: 'Music', icon: 'mdi:music' },
	{ label: 'Reading', icon: 'mdi:book' },
	{ label: 'Gardening', icon: 'mdi:flower' },
	{ label: 'Travel', icon: 'mdi:airplane' },
	{ label: 'Fitness', icon: 'mdi:dumbbell' },
	{ label: 'Art', icon: 'mdi:palette' },
	{ label: 'Gaming', icon: 'mdi:gamepad-variant' },
	{ label: 'Science', icon: 'mdi:atom' },
	{ label: 'Writing', icon: 'mdi:pen' },
	{ label: 'Volunteering', icon: 'mdi:hand-heart' },
	{ label: 'Sustainability', icon: 'mdi:recycle' },
	{ label: 'Cycling', icon: 'mdi:bike' },
	{ label: 'Languages', icon: 'mdi:translate' }
];

const persona = ref<string>('');
const interests = ref<string[]>([]);
const saving = ref(false);

function toggleInterest(label: string) {
	const idx = interests.value.indexOf(label);
	if (idx >= 0) {
		interests.value.splice(idx, 1);
	} else if (interests.value.length < 5) {
		interests.value.push(label);
	}
}

function close() {
	emit('update:modelValue', false);
}

function onOpenChange(v: boolean) {
	if (!v && !saving.value) close();
}

async function save() {
	if (!persona.value || interests.value.length < 3 || saving.value) return;
	saving.value = true;
	try {
		const ok = await onboarding.setPersona(persona.value, interests.value);
		if (!ok) {
			toast.add({
				title: "Couldn't Save Personalization",
				description: 'Please try again in a moment — your selection wasn’t recorded.',
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 5000
			});
			return;
		}
		toast.add({
			title: 'Personalized',
			description: "We'll use this to tailor what you see next.",
			icon: 'mdi:sparkles',
			color: 'success',
			duration: 3000
		});
		emit('done');
		close();
	} finally {
		saving.value = false;
	}
}
</script>
