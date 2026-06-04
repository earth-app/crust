import { useAuthStore } from 'stores/auth';
import { useUserStore } from 'stores/user';
import type { UserBadge, UserNotification } from 'types/user';
import { ref } from 'vue';

// shared singleton state — both crust + sky import this composable. holds the
// pending ribbon queue and exposes push/dismiss so the ribbon component stays a
// pure renderer.
export type BadgeUnlockEntry = {
	badgeId?: string;
	badgeName: string;
	badgeIcon?: string;
	trackerId?: string;
};

const queue = ref<BadgeUnlockEntry[]>([]);
const seenIds = new Set<string>();

const LAST_SEEN_KEY = 'badges_last_seen_at';
const BADGE_TITLE_PATTERN = /new badges? unlocked/i;
// "you've unlocked the \"Curious Mind\" badge!" — first capture is the name.
// also tolerates curly quotes the backend may emit on some platforms.
const SINGLE_NAME_PATTERN = /unlocked the ["“]([^"”]+)["”] badge/i;
// "you've unlocked the following badges: name1, name2."
const MULTI_NAMES_PATTERN = /unlocked the following badges:\s*(.+?)\.?$/i;

const readLastSeen = (): number => {
	if (!import.meta.client) return 0;
	try {
		const raw = localStorage.getItem(LAST_SEEN_KEY);
		const parsed = raw ? Number(raw) : 0;
		return Number.isFinite(parsed) ? parsed : 0;
	} catch {
		return 0;
	}
};

const writeLastSeen = (ms: number) => {
	if (!import.meta.client) return;
	try {
		localStorage.setItem(LAST_SEEN_KEY, String(ms));
	} catch {
		// swallow — private mode / quota
	}
};

const enqueueEntry = (entry: BadgeUnlockEntry, dedupeKey?: string) => {
	if (dedupeKey) {
		if (seenIds.has(dedupeKey)) return;
		seenIds.add(dedupeKey);
	}
	queue.value = [...queue.value, entry];
};

const resolveBadgeMeta = (
	name: string,
	currentUserId: string | undefined
): Partial<BadgeUnlockEntry> => {
	if (!currentUserId) return {};
	const userStore = useUserStore();
	const list = (userStore as any).badges?.get?.(currentUserId) as UserBadge[] | undefined;
	if (!list || !Array.isArray(list)) return {};
	const match = list.find(
		(b) => typeof b?.name === 'string' && b.name.toLowerCase() === name.toLowerCase()
	);
	if (!match) return {};
	return { badgeId: match.id, badgeIcon: match.icon, trackerId: match.tracker_id };
};

// parses a notification payload and pushes entries; returns count enqueued
const ingestNotification = (
	notification: Pick<UserNotification, 'title' | 'message' | 'id'>,
	currentUserId: string | undefined
): number => {
	if (!notification?.title || !BADGE_TITLE_PATTERN.test(notification.title)) return 0;

	const message = notification.message || '';
	const names: string[] = [];

	const single = message.match(SINGLE_NAME_PATTERN);
	if (single?.[1]) names.push(single[1].trim());

	if (names.length === 0) {
		const multi = message.match(MULTI_NAMES_PATTERN);
		if (multi?.[1]) {
			multi[1]
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean)
				.forEach((n) => names.push(n));
		}
	}

	if (names.length === 0) return 0;

	let pushed = 0;
	for (const name of names) {
		const meta = resolveBadgeMeta(name, currentUserId);
		const key = `notif:${notification.id || ''}:${name.toLowerCase()}`;
		const before = queue.value.length;
		enqueueEntry({ badgeName: name, ...meta }, key);
		if (queue.value.length > before) pushed += 1;
	}
	return pushed;
};

// diff fetched badges against the localStorage watermark and enqueue any that
// were granted after we last looked. polling-fallback path for missed ws events.
const ingestBadgesSnapshot = (badges: UserBadge[]) => {
	if (!badges?.length) return;
	const lastSeen = readLastSeen();
	let maxGrantedAt = lastSeen;

	for (const badge of badges) {
		if (!badge?.granted) continue;
		const grantedAtRaw = badge.granted_at;
		const grantedAt =
			typeof grantedAtRaw === 'number' ? grantedAtRaw : grantedAtRaw ? Number(grantedAtRaw) : 0;
		if (!Number.isFinite(grantedAt) || grantedAt <= 0) continue;
		if (grantedAt > maxGrantedAt) maxGrantedAt = grantedAt;
		if (grantedAt <= lastSeen) continue;
		const key = `badge:${badge.id}:${grantedAt}`;
		enqueueEntry(
			{
				badgeId: badge.id,
				badgeName: badge.name,
				badgeIcon: badge.icon,
				trackerId: badge.tracker_id
			},
			key
		);
	}

	if (maxGrantedAt > lastSeen) writeLastSeen(maxGrantedAt);
};

// pull current user's badges + diff against last_seen
const pollOnce = async () => {
	if (!import.meta.client) return;
	const authStore = useAuthStore();
	if (!authStore.sessionToken) return;
	const { user } = useAuth();
	const uid = user.value?.id;
	if (!uid) return;
	try {
		const userStore = useUserStore();
		const fetched = await userStore.fetchBadges(uid);
		ingestBadgesSnapshot(fetched);
	} catch (err) {
		console.warn('badge-unlock polling fallback failed:', err);
	}
};

let started = false;

export function useBadgeUnlockListener() {
	const push = (entry: BadgeUnlockEntry) => enqueueEntry(entry);

	const dismiss = () => {
		if (queue.value.length === 0) return;
		queue.value = queue.value.slice(1);
	};

	// hook called by the websocket plugin for any 'notification' payload. cheap to
	// call indiscriminately — the title regex filters non-badge events first.
	const onIncomingNotification = (notification: UserNotification) => {
		if (!import.meta.client) return;
		const { user } = useAuth();
		ingestNotification(notification, user.value?.id);
	};

	// idempotent bootstrap: schedules one poll on auth + one on focus to recover
	// any grants that landed while the ws was offline
	const start = () => {
		if (!import.meta.client || started) return;
		started = true;
		void pollOnce();
		const focusHandler = () => void pollOnce();
		window.addEventListener('focus', focusHandler);
		window.addEventListener('online', focusHandler);
	};

	return {
		queue,
		push,
		dismiss,
		start,
		onIncomingNotification
	};
}
