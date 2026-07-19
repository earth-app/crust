import type {
	Trail,
	TrailJournalEntry,
	TrailMood,
	TrailPractice,
	TrailPracticeMeta,
	TrailRarity
} from 'types/trails';

// #region practice metadata (the qualitative outdoor practices)

// FALLBACK only: the practice presentation metadata is authored in cloud (src/user/trails.ts
// TRAIL_PRACTICE_META) and delivered embedded as trail.practiceMeta. this map covers
// ssr/first-paint/offline/tests until the response fills the runtime cache below
export const TRAIL_PRACTICE_META: Record<TrailPractice, TrailPracticeMeta> = {
	sit_spot: {
		practice: 'sit_spot',
		label: 'Sit Spot',
		icon: 'mdi:meditation',
		verb: 'sit',
		cue: 'Find one spot, settle in, and let the place come to you.',
		defaultMinutes: 12,
		photos: false
	},
	photo_series: {
		practice: 'photo_series',
		label: 'Photo Series',
		icon: 'mdi:camera-iris',
		verb: 'photograph',
		cue: 'Follow one thread of light, color, or shape through a few frames.',
		defaultMinutes: 10,
		photos: true
	},
	sound_map: {
		practice: 'sound_map',
		label: 'Sound Map',
		icon: 'mdi:ear-hearing',
		verb: 'listen',
		cue: 'Close your eyes and place each sound you hear around you.',
		defaultMinutes: 8,
		photos: false
	},
	slow_look: {
		practice: 'slow_look',
		label: 'Slow Look',
		icon: 'mdi:magnify-scan',
		verb: 'observe',
		cue: 'Pick one small living thing and watch it far longer than feels normal.',
		defaultMinutes: 8,
		photos: false
	},
	sky_watch: {
		practice: 'sky_watch',
		label: 'Sky Watch',
		icon: 'mdi:weather-partly-cloudy',
		verb: 'watch',
		cue: 'Lie back and give the sky your full, unhurried attention.',
		defaultMinutes: 12,
		photos: false
	},
	wander: {
		practice: 'wander',
		label: 'Slow Wander',
		icon: 'mdi:foot-print',
		verb: 'wander',
		cue: 'Walk with no destination; follow whatever catches your curiosity.',
		defaultMinutes: 15,
		photos: false
	},
	texture: {
		practice: 'texture',
		label: 'Texture Hunt',
		icon: 'mdi:hand-back-left',
		verb: 'touch',
		cue: 'Find five textures worth touching and stay with each one.',
		defaultMinutes: 10,
		photos: false
	},
	water_sit: {
		practice: 'water_sit',
		label: 'Waterside',
		icon: 'mdi:waves',
		verb: 'rest',
		cue: 'Settle beside moving water and let it hold your attention.',
		defaultMinutes: 12,
		photos: false
	}
};

// runtime cache filled from cloud-authored trail.practiceMeta (see registerTrailPracticeMeta);
// lookups prefer this over the fallback map so cloud stays the source of truth
const practiceMetaCache = new Map<TrailPractice, TrailPracticeMeta>();

// stores a cloud-authored practiceMeta under its practice so later lookups prefer it over the
// fallback; a no-op when the trail carries no embedded meta (ssr/first-paint/offline)
export function registerTrailPracticeMeta(
	trail: Pick<Trail, 'practice' | 'practiceMeta'> | null | undefined
): void {
	if (!trail?.practice || !trail.practiceMeta) return;
	practiceMetaCache.set(trail.practice, trail.practiceMeta);
}

// drops every cached practiceMeta (used by tests + hard resets); the fallback map still stands
export function clearTrailPracticeMetaCache(): void {
	practiceMetaCache.clear();
}

export function trailPracticeMeta(
	practice: TrailPractice | string | undefined | null
): TrailPracticeMeta {
	const key = practice as TrailPractice;
	// cloud-authored cache first, then the static fallback, then the safe default
	return practiceMetaCache.get(key) ?? TRAIL_PRACTICE_META[key] ?? TRAIL_PRACTICE_META.sit_spot;
}

// the gentle presence target for a trail — its own duration, else the resolved practice default
export function trailTargetMinutes(trail: Pick<Trail, 'duration' | 'practice'>): number {
	const d = Number(trail?.duration);
	if (Number.isFinite(d) && d > 0) return Math.round(d);
	return trailPracticeMeta(trail?.practice).defaultMinutes;
}

// #endregion

// #region mood metadata (self-referential reflection, never compared)

export interface TrailMoodMeta {
	mood: TrailMood;
	label: string;
	icon: string;
}

export const TRAIL_MOOD_META: Record<TrailMood, TrailMoodMeta> = {
	calm: { mood: 'calm', label: 'Calm', icon: 'mdi:emoticon-outline' },
	curious: { mood: 'curious', label: 'Curious', icon: 'mdi:head-question-outline' },
	awed: { mood: 'awed', label: 'Awed', icon: 'mdi:star-shooting-outline' },
	grateful: { mood: 'grateful', label: 'Grateful', icon: 'mdi:hand-heart-outline' },
	refreshed: { mood: 'refreshed', label: 'Refreshed', icon: 'mdi:weather-windy' },
	unsettled: { mood: 'unsettled', label: 'Unsettled', icon: 'mdi:waves-arrow-up' }
};

export function trailMoodMeta(mood: TrailMood | string | undefined | null): TrailMoodMeta | null {
	return TRAIL_MOOD_META[mood as TrailMood] ?? null;
}

// #endregion

// #region journal helpers

// total unhurried minutes recorded across every reflected practice (self-monitoring)
export function journalTotalMinutes(entries: TrailJournalEntry[]): number {
	return (entries ?? []).reduce((sum, e) => sum + Math.max(0, Number(e?.presenceMinutes) || 0), 0);
}

// most recent first; pure + non-mutating
export function sortJournalByRecent(entries: TrailJournalEntry[]): TrailJournalEntry[] {
	return [...(entries ?? [])].sort(
		(a, b) => Date.parse(b?.completedAt ?? '') - Date.parse(a?.completedAt ?? '')
	);
}

// #endregion

// #region rarity ordering

export const TRAIL_RARITY_ORDER: TrailRarity[] = ['normal', 'rare', 'amazing', 'green'];

// sortable rank for a rarity; unknown rarities fall after the known set
export function trailRarityRank(rarity: TrailRarity | string | undefined | null): number {
	const i = TRAIL_RARITY_ORDER.indexOf(rarity as TrailRarity);
	return i === -1 ? TRAIL_RARITY_ORDER.length : i;
}

// #region sorting

export function sortTrailsByRarity(trails: Trail[]): Trail[] {
	return [...trails].sort((a, b) => {
		const byRarity = trailRarityRank(a.rarity) - trailRarityRank(b.rarity);
		if (byRarity !== 0) return byRarity;
		return (a.title ?? '').localeCompare(b.title ?? '');
	});
}

// #endregion
