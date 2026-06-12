import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from 'stores/auth';
import { useNotificationStore } from 'stores/notification';
import type { UserNotification } from 'types/user';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// mock network helpers at the `utils` alias; keep pure helpers (valid, invalidateAPICache) real
vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return {
		...actual,
		makeAPIRequest: vi.fn(),
		makeClientAPIRequest: vi.fn()
	};
});

import { makeAPIRequest, makeClientAPIRequest } from 'utils';

function note(id: string, read = false, type: UserNotification['type'] = 'info'): UserNotification {
	return {
		id,
		title: `t-${id}`,
		user_id: 'me',
		message: `m-${id}`,
		type,
		source: 'system',
		read,
		created_at: Date.now()
	};
}

const ids = (ns: UserNotification[]) => ns.map((n) => n.id);

function authed(token: string | null = 'tok') {
	const auth = useAuthStore();
	auth.sessionToken = token;
	return auth;
}

describe('notification store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
	});

	describe('initial state + computed splits', () => {
		it('starts empty', () => {
			const store = useNotificationStore();
			expect(store.notifications).toEqual([]);
			expect(store.unreadCount).toBe(0);
			expect(store.unreadNotifications).toEqual([]);
			expect(store.readNotifications).toEqual([]);
		});

		it('splits read vs unread reactively', () => {
			const store = useNotificationStore();
			store.notifications = [note('a', false), note('b', true), note('c', false)];

			expect(ids(store.unreadNotifications)).toEqual(['a', 'c']);
			expect(ids(store.readNotifications)).toEqual(['b']);
		});
	});

	describe('fetchNotifications', () => {
		it('clears everything when unauthenticated', async () => {
			authed(null);
			const store = useNotificationStore();
			store.notifications = [note('a')];
			store.unreadCount = 1;
			store.hasWarnings = true;
			store.hasErrors = true;

			await store.fetchNotifications();

			expect(store.notifications).toEqual([]);
			expect(store.unreadCount).toBe(0);
			expect(store.hasWarnings).toBe(false);
			expect(store.hasErrors).toBe(false);
			expect(makeAPIRequest).not.toHaveBeenCalled();
		});

		it('populates list, counts, flags, and the per-id cache on success', async () => {
			authed();
			const store = useNotificationStore();

			vi.mocked(makeAPIRequest).mockResolvedValue({
				success: true,
				data: {
					unread_count: 2,
					has_warnings: true,
					has_errors: false,
					items: [note('a', false, 'warning'), note('b', true)]
				}
			});

			await store.fetchNotifications();

			expect(ids(store.notifications)).toEqual(['a', 'b']);
			expect(store.unreadCount).toBe(2);
			expect(store.hasWarnings).toBe(true);
			expect(store.hasErrors).toBe(false);
			expect(store.cache.get('a')?.id).toBe('a');
			expect(store.cache.get('b')?.id).toBe('b');
			expect(store.isLoading).toBe(false);
		});

		it('leaves state untouched and swallows a thrown request', async () => {
			authed();
			const store = useNotificationStore();
			store.notifications = [note('keep')];
			store.unreadCount = 1;

			vi.mocked(makeAPIRequest).mockRejectedValue(new Error('network'));

			await store.fetchNotifications();

			expect(ids(store.notifications)).toEqual(['keep']);
			expect(store.unreadCount).toBe(1);
			expect(store.isLoading).toBe(false);
		});

		it('dedupes concurrent fetches via the shared in-flight promise', async () => {
			authed();
			const store = useNotificationStore();

			let resolveFn: (v: any) => void = () => {};
			vi.mocked(makeAPIRequest).mockReturnValue(
				new Promise((resolve) => {
					resolveFn = resolve;
				}) as any
			);

			const p1 = store.fetchNotifications();
			const p2 = store.fetchNotifications();

			resolveFn({
				success: true,
				data: { unread_count: 1, has_warnings: false, has_errors: false, items: [note('a')] }
			});
			await Promise.all([p1, p2]);

			expect(makeAPIRequest).toHaveBeenCalledTimes(1);
			expect(ids(store.notifications)).toEqual(['a']);
		});
	});

	describe('fetchNotification (single)', () => {
		it('caches and returns the notification on success', async () => {
			authed();
			const store = useNotificationStore();

			vi.mocked(makeAPIRequest).mockResolvedValue({ success: true, data: note('a') });

			const res = await store.fetchNotification('a');

			expect(res?.id).toBe('a');
			expect(store.cache.get('a')?.id).toBe('a');
		});

		it('returns null on an invalid response', async () => {
			authed();
			const store = useNotificationStore();

			vi.mocked(makeAPIRequest).mockResolvedValue({ success: false, message: 'nope' });

			const res = await store.fetchNotification('a');

			expect(res).toBeNull();
			expect(store.cache.has('a')).toBe(false);
		});
	});

	describe('markRead', () => {
		it('flips read and decrements the unread count', async () => {
			authed();
			const store = useNotificationStore();
			store.notifications = [note('a', false)];
			store.cache.set('a', store.notifications[0]!);
			store.unreadCount = 1;

			vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true });

			await store.markRead('a');

			expect(store.notifications[0]!.read).toBe(true);
			expect(store.cache.get('a')!.read).toBe(true);
			expect(store.unreadCount).toBe(0);
		});

		it('does not mutate state when the call fails', async () => {
			authed();
			const store = useNotificationStore();
			store.notifications = [note('a', false)];
			store.unreadCount = 1;

			vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: false, message: 'x' });

			await store.markRead('a');

			expect(store.notifications[0]!.read).toBe(false);
			expect(store.unreadCount).toBe(1);
		});

		it('never drives the unread count below zero', async () => {
			authed();
			const store = useNotificationStore();
			store.notifications = [note('a', false)];
			store.unreadCount = 0; // already-floored count

			vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true });

			await store.markRead('a');

			expect(store.unreadCount).toBe(0);
		});

		// BUG: markRead decrements unreadCount even when the notification was already read,
		// so the count drifts below the true unread total. correct behavior: a no-op on the
		// count when read was already true.
		it('does not decrement when the notification was already read', async () => {
			authed();
			const store = useNotificationStore();
			store.notifications = [note('a', true)]; // already read
			store.unreadCount = 1; // one OTHER unread item conceptually

			vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true });

			await store.markRead('a');

			expect(store.unreadCount).toBe(1);
		});
	});

	describe('markUnread', () => {
		it('flips read off and increments the unread count', async () => {
			authed();
			const store = useNotificationStore();
			store.notifications = [note('a', true)];
			store.cache.set('a', store.notifications[0]!);
			store.unreadCount = 0;

			vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true });

			await store.markUnread('a');

			expect(store.notifications[0]!.read).toBe(false);
			expect(store.cache.get('a')!.read).toBe(false);
			expect(store.unreadCount).toBe(1);
		});

		it('does not mutate when the call fails', async () => {
			authed();
			const store = useNotificationStore();
			store.notifications = [note('a', true)];
			store.unreadCount = 0;

			vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: false });

			await store.markUnread('a');

			expect(store.notifications[0]!.read).toBe(true);
			expect(store.unreadCount).toBe(0);
		});

		// BUG: markUnread increments unreadCount even when the notification was already
		// unread, double-counting. correct behavior: a no-op on the count when read was false.
		it('does not increment when the notification was already unread', async () => {
			authed();
			const store = useNotificationStore();
			store.notifications = [note('a', false)]; // already unread
			store.unreadCount = 1;

			vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true });

			await store.markUnread('a');

			expect(store.unreadCount).toBe(1);
		});
	});

	describe('markAllRead', () => {
		it('optimistically marks all read and zeroes the count', async () => {
			authed();
			const store = useNotificationStore();
			store.notifications = [note('a', false), note('b', false)];
			for (const n of store.notifications) store.cache.set(n.id, n);
			store.unreadCount = 2;

			vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true });

			await store.markAllRead();

			expect(store.notifications.every((n) => n.read)).toBe(true);
			expect(store.cache.get('a')!.read).toBe(true);
			expect(store.unreadCount).toBe(0);
		});

		it('rolls back the optimistic update on failure', async () => {
			authed();
			const store = useNotificationStore();
			store.notifications = [note('a', false), note('b', true)];
			for (const n of store.notifications) store.cache.set(n.id, n);
			store.unreadCount = 1;

			vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: false, message: 'x' });

			await store.markAllRead();

			// original read flags restored
			expect(store.notifications.find((n) => n.id === 'a')!.read).toBe(false);
			expect(store.notifications.find((n) => n.id === 'b')!.read).toBe(true);
			expect(store.cache.get('a')!.read).toBe(false);
			expect(store.unreadCount).toBe(1);
		});
	});

	describe('markAllUnread', () => {
		it('optimistically marks all unread and sets count to length', async () => {
			authed();
			const store = useNotificationStore();
			store.notifications = [note('a', true), note('b', true)];
			for (const n of store.notifications) store.cache.set(n.id, n);
			store.unreadCount = 0;

			vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true });

			await store.markAllUnread();

			expect(store.notifications.every((n) => !n.read)).toBe(true);
			expect(store.unreadCount).toBe(2);
		});

		it('rolls back on failure', async () => {
			authed();
			const store = useNotificationStore();
			store.notifications = [note('a', true), note('b', false)];
			for (const n of store.notifications) store.cache.set(n.id, n);
			store.unreadCount = 1;

			vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: false });

			await store.markAllUnread();

			expect(store.notifications.find((n) => n.id === 'a')!.read).toBe(true);
			expect(store.notifications.find((n) => n.id === 'b')!.read).toBe(false);
			expect(store.unreadCount).toBe(1);
		});
	});

	describe('deleteNotification', () => {
		it('removes the item, drops the cache entry, and decrements unread when it was unread', async () => {
			authed();
			const store = useNotificationStore();
			store.notifications = [note('a', false), note('b', true)];
			for (const n of store.notifications) store.cache.set(n.id, n);
			store.unreadCount = 1;

			vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true });

			await store.deleteNotification('a');

			expect(ids(store.notifications)).toEqual(['b']);
			expect(store.cache.has('a')).toBe(false);
			expect(store.unreadCount).toBe(0);
		});

		it('does not decrement when the deleted item was already read', async () => {
			authed();
			const store = useNotificationStore();
			store.notifications = [note('a', true)];
			store.cache.set('a', store.notifications[0]!);
			store.unreadCount = 0;

			vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true });

			await store.deleteNotification('a');

			expect(ids(store.notifications)).toEqual([]);
			expect(store.unreadCount).toBe(0);
		});

		it('leaves state intact when the delete call fails', async () => {
			authed();
			const store = useNotificationStore();
			store.notifications = [note('a', false)];
			store.cache.set('a', store.notifications[0]!);
			store.unreadCount = 1;

			vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: false });

			await store.deleteNotification('a');

			expect(ids(store.notifications)).toEqual(['a']);
			expect(store.cache.has('a')).toBe(true);
			expect(store.unreadCount).toBe(1);
		});
	});

	describe('clearAll', () => {
		it('empties list, count, and cache on success', async () => {
			authed();
			const store = useNotificationStore();
			store.notifications = [note('a', false), note('b', false)];
			for (const n of store.notifications) store.cache.set(n.id, n);
			store.unreadCount = 2;

			vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true });

			await store.clearAll();

			expect(store.notifications).toEqual([]);
			expect(store.unreadCount).toBe(0);
			expect(store.cache.size).toBe(0);
		});

		it('restores list, count, and cache on failure', async () => {
			authed();
			const store = useNotificationStore();
			store.notifications = [note('a', false), note('b', false)];
			for (const n of store.notifications) store.cache.set(n.id, n);
			store.unreadCount = 2;

			vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: false, message: 'x' });

			await store.clearAll();

			expect(ids(store.notifications)).toEqual(['a', 'b']);
			expect(store.unreadCount).toBe(2);
			expect(store.cache.size).toBe(2);
		});
	});

	describe('addLiveNotification (websocket-driven)', () => {
		it('prepends, caches, bumps unread, and sets the warning flag', () => {
			const store = useNotificationStore();
			store.notifications = [note('old', true)];
			store.unreadCount = 0;

			store.addLiveNotification(note('new', false, 'warning'));

			expect(ids(store.notifications)).toEqual(['new', 'old']);
			expect(store.cache.get('new')?.id).toBe('new');
			expect(store.unreadCount).toBe(1);
			expect(store.hasWarnings).toBe(true);
			expect(store.hasErrors).toBe(false);
		});

		it('sets the error flag for an error notification', () => {
			const store = useNotificationStore();

			store.addLiveNotification(note('e', false, 'error'));

			expect(store.hasErrors).toBe(true);
		});

		it('does not bump unread for an already-read live notification', () => {
			const store = useNotificationStore();
			store.unreadCount = 0;

			store.addLiveNotification(note('r', true));

			expect(store.unreadCount).toBe(0);
		});

		it('dedupes a notification that is already present', () => {
			const store = useNotificationStore();
			store.notifications = [note('a', false)];
			store.unreadCount = 1;

			store.addLiveNotification(note('a', false));

			expect(ids(store.notifications)).toEqual(['a']);
			expect(store.unreadCount).toBe(1);
		});
	});
});
