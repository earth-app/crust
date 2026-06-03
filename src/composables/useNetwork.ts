const STORAGE_KEY = 'earth-app:offline-queue';

export type QueuedMutationKind = 'mark-read' | 'mark-all-read' | 'dismiss-onboarding';

export interface QueuedMutation {
	id: string;
	kind: QueuedMutationKind;
	payload?: Record<string, unknown>;
	attempts: number;
	enqueuedAt: number;
}

// shared state — module-level so any component can observe / dispatch
export const networkOffline = ref(false);
export const isOffline = computed(() => networkOffline.value);
export const pendingMutations = ref<QueuedMutation[]>([]);

const MAX_ATTEMPTS = 5;

function loadQueue(): QueuedMutation[] {
	if (!import.meta.client) return [];
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function persistQueue() {
	if (!import.meta.client) return;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingMutations.value));
	} catch {
		// quota or private-mode safari — ignore, replay still works in-memory
	}
}

export function enqueueMutation(kind: QueuedMutationKind, payload?: Record<string, unknown>) {
	const entry: QueuedMutation = {
		id: `${kind}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
		kind,
		payload,
		attempts: 0,
		enqueuedAt: Date.now()
	};
	pendingMutations.value = [...pendingMutations.value, entry];
	persistQueue();
}

function removeMutation(id: string) {
	pendingMutations.value = pendingMutations.value.filter((m) => m.id !== id);
	persistQueue();
}

// dispatcher table — registered by the consumer modules so this composable
// stays free of cross-module imports.
type Dispatcher = (m: QueuedMutation) => Promise<boolean>;
const dispatchers = new Map<QueuedMutationKind, Dispatcher>();

export function registerMutationDispatcher(kind: QueuedMutationKind, fn: Dispatcher) {
	dispatchers.set(kind, fn);
}

let replaying = false;
export async function replayPendingMutations() {
	if (replaying) return;
	if (isOffline.value) return;
	if (pendingMutations.value.length === 0) return;
	replaying = true;
	try {
		// snapshot since the queue mutates while we work
		const snapshot = [...pendingMutations.value];
		for (const entry of snapshot) {
			const dispatcher = dispatchers.get(entry.kind);
			if (!dispatcher) continue;
			try {
				const ok = await dispatcher(entry);
				if (ok) {
					removeMutation(entry.id);
				} else {
					entry.attempts += 1;
					if (entry.attempts >= MAX_ATTEMPTS) removeMutation(entry.id);
					else persistQueue();
				}
			} catch {
				entry.attempts += 1;
				if (entry.attempts >= MAX_ATTEMPTS) removeMutation(entry.id);
				else persistQueue();
			}
		}
	} finally {
		replaying = false;
	}
}

let initialized = false;
export function initNetworkMonitor() {
	if (initialized) return;
	if (!import.meta.client) return;
	initialized = true;

	pendingMutations.value = loadQueue();

	const apply = (online: boolean) => {
		const wasOffline = networkOffline.value;
		networkOffline.value = !online;
		if (online && wasOffline) {
			// just came back online — drain anything queued during the dark period
			void replayPendingMutations();
		}
	};

	apply(navigator.onLine);
	window.addEventListener('online', () => apply(true));
	window.addEventListener('offline', () => apply(false));
}

// helper: try the executor immediately when online; if it throws what looks like
// a network failure (or we're already offline), queue it instead and report
// optimistic success so the UI doesn't block. Only safe for idempotent mutations.
export async function runOrQueue<T>(
	kind: QueuedMutationKind,
	payload: Record<string, unknown> | undefined,
	executor: () => Promise<T>
): Promise<{ executed: boolean; queued: boolean; result?: T }> {
	if (isOffline.value) {
		enqueueMutation(kind, payload);
		return { executed: false, queued: true };
	}
	try {
		const result = await executor();
		return { executed: true, queued: false, result };
	} catch (e: any) {
		// crude network-error detector — fetch/$fetch failures don't carry a single
		// uniform signal across worker/browser so we look for the usual suspects
		const msg = String(e?.message || e?.name || '').toLowerCase();
		const looksLikeNetwork =
			msg.includes('network') ||
			msg.includes('fetch') ||
			msg.includes('failed to fetch') ||
			e?.code === 'ECONNREFUSED' ||
			e?.statusCode === 0;
		if (looksLikeNetwork) {
			enqueueMutation(kind, payload);
			return { executed: false, queued: true };
		}
		throw e;
	}
}
