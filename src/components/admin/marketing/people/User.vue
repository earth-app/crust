<template>
	<div
		v-if="displayOnly"
		class="pointer-events-none"
	>
		<UserCard :user="mockUser" />
		<div
			v-if="mockBadges.length"
			class="mt-4 flex flex-wrap gap-3"
		>
			<UserBadgeDisplay
				v-for="badge in mockBadges"
				:key="badge.id"
				:badge="badge"
				:is-granted="true"
				size="small"
			/>
		</div>
	</div>

	<div
		v-else
		class="grid grid-cols-1 gap-4 lg:grid-cols-2"
	>
		<div class="flex flex-col gap-3">
			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				<UFormField label="Full Name">
					<UInput
						v-model="form.full_name"
						placeholder="Maya Rivera"
					/>
				</UFormField>
				<UFormField label="Username">
					<UInput
						v-model="form.username"
						placeholder="mayawanders"
						:ui="{ leading: 'ps-2' }"
					>
						<template #leading>
							<span class="text-muted text-sm">@</span>
						</template>
					</UInput>
				</UFormField>
				<UFormField label="Account Type">
					<USelect
						v-model="form.account_type"
						:items="accountTypeItems"
						class="w-full"
					/>
				</UFormField>
				<UFormField label="Mutual Count">
					<UInput
						v-model.number="form.mutual_count"
						type="number"
						:min="0"
					/>
				</UFormField>
				<UFormField
					label="Bio"
					class="sm:col-span-2"
				>
					<UTextarea
						v-model="form.bio"
						:rows="2"
						placeholder="Chasing sunrises and quiet trails."
						class="w-full"
					/>
				</UFormField>
			</div>

			<div class="flex flex-wrap gap-4">
				<USwitch
					v-model="form.is_mutual"
					label="Mutual"
				/>
				<USwitch
					v-model="form.is_in_circle"
					label="In Your Circle"
				/>
			</div>

			<div class="flex flex-col gap-2">
				<span class="text-sm font-semibold">Activities</span>
				<div
					v-if="form.activities.length"
					class="flex flex-wrap gap-2"
				>
					<UBadge
						v-for="(activity, i) in form.activities"
						:key="`${activity.name}-${i}`"
						color="primary"
						variant="subtle"
						:icon="activity.icon || 'mdi:earth'"
						class="gap-1"
					>
						{{ activity.name }}
						<button
							type="button"
							class="ml-1 hover:cursor-pointer"
							aria-label="Remove Activity"
							@click="removeActivity(i)"
						>
							<UIcon
								name="mdi:close"
								class="size-3.5"
							/>
						</button>
					</UBadge>
				</div>
				<div class="flex flex-wrap items-end gap-2">
					<UInput
						v-model="activityDraft.name"
						placeholder="Hiking"
						class="flex-1 min-w-32"
						@keydown.enter="addActivity"
					/>
					<UInput
						v-model="activityDraft.icon"
						placeholder="mdi:hiking"
						class="flex-1 min-w-32"
						@keydown.enter="addActivity"
					/>
					<UButton
						icon="mdi:plus"
						color="neutral"
						variant="soft"
						:disabled="!activityDraft.name.trim()"
						@click="addActivity"
						>Add</UButton
					>
				</div>
			</div>

			<div class="flex flex-col gap-2">
				<span class="text-sm font-semibold">Badges</span>
				<div
					v-if="form.badges.length"
					class="flex flex-wrap gap-2"
				>
					<UBadge
						v-for="(badge, i) in form.badges"
						:key="`${badge.name}-${i}`"
						:color="rarityColor(badge.rarity)"
						variant="subtle"
						:icon="badge.icon || 'mdi:medal-outline'"
						class="gap-1"
					>
						{{ badge.name }}
						<button
							type="button"
							class="ml-1 hover:cursor-pointer"
							aria-label="Remove Badge"
							@click="removeBadge(i)"
						>
							<UIcon
								name="mdi:close"
								class="size-3.5"
							/>
						</button>
					</UBadge>
				</div>
				<div class="flex flex-wrap items-end gap-2">
					<UInput
						v-model="badgeDraft.name"
						placeholder="Trailblazer"
						class="flex-1 min-w-32"
						@keydown.enter="addBadge"
					/>
					<USelect
						v-model="badgeDraft.rarity"
						:items="rarityItems"
						class="min-w-28"
					/>
					<UButton
						icon="mdi:plus"
						color="neutral"
						variant="soft"
						:disabled="!badgeDraft.name.trim()"
						@click="addBadge"
						>Add</UButton
					>
				</div>
			</div>

			<div class="flex flex-wrap gap-2">
				<UButton
					icon="mdi:dice-5-outline"
					color="primary"
					variant="soft"
					@click="randomizePersona"
					>Randomize Persona</UButton
				>
				<UButton
					icon="mdi:cloud-download-outline"
					color="neutral"
					variant="soft"
					:loading="pulling"
					@click="pullLive"
					>Pull Live</UButton
				>
				<UButton
					icon="mdi:presentation"
					color="neutral"
					variant="ghost"
					@click="present = true"
					>Present</UButton
				>
			</div>

			<AdminMarketingPeopleSceneBar
				kind="user"
				:payload="form"
				:source="source"
				@load="onSceneLoad"
			/>
		</div>

		<div class="flex flex-col gap-4">
			<div class="text-sm font-semibold text-muted">Live Preview</div>
			<div class="pointer-events-none">
				<UserCard :user="mockUser" />
			</div>
			<div class="flex items-center gap-3">
				<span class="text-sm text-muted">Type Badge:</span>
				<div class="pointer-events-none">
					<UserTypeBadge :user="mockUser" />
				</div>
				<span
					v-if="form.account_type === 'FREE'"
					class="text-xs text-muted"
					>Free accounts show no badge</span
				>
			</div>
			<div
				v-if="mockBadges.length"
				class="flex flex-wrap gap-3 pointer-events-none"
			>
				<UserBadgeDisplay
					v-for="badge in mockBadges"
					:key="badge.id"
					:badge="badge"
					:is-granted="true"
					size="small"
				/>
			</div>
		</div>

		<AdminMarketingPeoplePresent
			v-model="present"
			label="Mock User"
		>
			<div class="pointer-events-none">
				<UserCard :user="mockUser" />
			</div>
			<div
				v-if="mockBadges.length"
				class="mt-4 flex flex-wrap justify-center gap-3 pointer-events-none"
			>
				<UserBadgeDisplay
					v-for="badge in mockBadges"
					:key="badge.id"
					:badge="badge"
					:is-granted="true"
					size="small"
				/>
			</div>
		</AdminMarketingPeoplePresent>
	</div>
</template>

<script setup lang="ts">
import { useAuthStore } from 'stores/auth';
import { makeAPIRequest, valid } from 'utils';
import type { MockUserForm, Persona } from '~/shared/utils/marketingPeople';
import {
	emptyUserForm,
	makeMockBadges,
	makeMockUser,
	MOCK_ACCOUNT_TYPES,
	PERSONA_PRESETS,
	personaToForm,
	pickPersona,
	RARITIES,
	userToForm
} from '~/shared/utils/marketingPeople';
import type { MarketingScene, MarketingSource } from '../../../../shared/types/marketing';

const props = defineProps<{
	scene?: MarketingScene | null;
	displayOnly?: boolean;
}>();

const authStore = useAuthStore();
const toast = useToast();

const form = reactive<MockUserForm>(emptyUserForm());
const source = ref<MarketingSource>('manual');
const present = ref(false);
const pulling = ref(false);
const lastPersona = ref<number>(-1);

const activityDraft = reactive<{ name: string; icon: string }>({ name: '', icon: '' });
const badgeDraft = reactive<{ name: string; rarity: MockUserForm['badges'][number]['rarity'] }>({
	name: '',
	rarity: 'normal'
});

const accountTypeItems = MOCK_ACCOUNT_TYPES.map((t) => ({
	label: t.charAt(0) + t.slice(1).toLowerCase(),
	value: t
}));
const rarityItems = RARITIES.map((r) => ({
	label: r.charAt(0).toUpperCase() + r.slice(1),
	value: r
}));

const mockUser = computed(() => makeMockUser(form));
const mockBadges = computed(() => makeMockBadges(form.badges));

function rarityColor(rarity?: string) {
	switch (rarity) {
		case 'rare':
			return 'info';
		case 'amazing':
			return 'warning';
		case 'green':
			return 'success';
		default:
			return 'neutral';
	}
}

function applyForm(next: MockUserForm) {
	Object.assign(form, emptyUserForm(), next, {
		activities: (next.activities ?? []).map((a) => ({ ...a })),
		badges: (next.badges ?? []).map((b) => ({ ...b }))
	});
}

function addActivity() {
	if (!activityDraft.name.trim()) return;
	form.activities.push({ name: activityDraft.name.trim(), icon: activityDraft.icon.trim() });
	activityDraft.name = '';
	activityDraft.icon = '';
	source.value = 'manual';
}

function removeActivity(i: number) {
	form.activities.splice(i, 1);
}

function addBadge() {
	if (!badgeDraft.name.trim()) return;
	form.badges.push({ name: badgeDraft.name.trim(), rarity: badgeDraft.rarity });
	badgeDraft.name = '';
	badgeDraft.rarity = 'normal';
	source.value = 'manual';
}

function removeBadge(i: number) {
	form.badges.splice(i, 1);
}

function randomizePersona() {
	const count = PERSONA_PRESETS.length;
	let seed = Math.floor(Math.random() * count);
	if (seed === lastPersona.value) seed = (seed + 1) % count;
	lastPersona.value = seed;
	const persona: Persona = pickPersona(seed);
	applyForm(personaToForm(persona));
	source.value = 'ai';
	toast.add({
		title: 'Persona Loaded',
		description: `Now previewing ${persona.full_name}.`,
		icon: 'mdi:dice-5-outline',
		color: 'success'
	});
}

async function pullLive() {
	if (pulling.value) return;
	pulling.value = true;
	try {
		const res = await makeAPIRequest<{ items: User[] }>(
			`marketing-pull-user-${Date.now()}`,
			'/v2/users?limit=1&sort=rand',
			authStore.sessionToken
		);
		if (valid(res) && Array.isArray(res.data.items) && res.data.items[0]) {
			applyForm(userToForm(res.data.items[0]));
			source.value = 'live';
			toast.add({
				title: 'Live User Loaded',
				description: `Pulled @${form.username} for preview.`,
				icon: 'mdi:cloud-check-outline',
				color: 'success'
			});
		} else {
			toast.add({
				title: 'No User Found',
				description: 'Could not pull a live user right now.',
				icon: 'mdi:cloud-alert-outline',
				color: 'warning'
			});
		}
	} finally {
		pulling.value = false;
	}
}

function onSceneLoad(payload: unknown, scene: MarketingScene) {
	applyForm(payload as MockUserForm);
	source.value = scene.source ?? 'manual';
}

watch(
	() => props.scene,
	(scene) => {
		if (scene?.payload) {
			applyForm(scene.payload as MockUserForm);
			source.value = scene.source ?? 'manual';
		}
	},
	{ immediate: true }
);
</script>
