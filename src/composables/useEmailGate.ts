import { computed, ref } from 'vue';

// shared singleton state so the modal mounts once but every composable call sees the same store
const open = ref(false);
const action = ref<string | null>(null);
const hasEmailOverride = ref<boolean | null>(null);

export function useEmailGate() {
	const { user } = useAuth();

	const hasEmail = computed(() => {
		if (hasEmailOverride.value !== null) return hasEmailOverride.value;
		const email = user.value?.account?.email;
		return typeof email === 'string' && email.trim().length > 0;
	});

	const isVerified = computed(() => Boolean(user.value?.account?.email_verified));

	const isAdmin = computed(() => user.value?.account?.account_type === 'ADMINISTRATOR');

	const isGated = computed(() => {
		if (!user.value) return false;
		if (isAdmin.value) return false;
		return !isVerified.value;
	});

	function openModal(forAction?: string) {
		action.value = forAction || null;
		hasEmailOverride.value = null;
		open.value = true;
	}

	function close() {
		open.value = false;
		action.value = null;
		hasEmailOverride.value = null;
	}

	// returns true if allowed to proceed; otherwise opens the modal and returns false
	function requireVerified(forAction?: string): boolean {
		if (!user.value) return true; // unauth flows handled elsewhere (login redirect)
		if (!isGated.value) return true;
		openModal(forAction);
		return false;
	}

	// inspects a thrown error / non-2xx response and reopens the gate if the
	// backend says EMAIL_VERIFICATION_REQUIRED. used after the optimistic UI gate
	// to handle stale local state. returns true if it handled the error.
	function handleServerError(err: unknown, forAction?: string): boolean {
		const body = extractErrorBody(err);
		if (body && body.reason === 'EMAIL_VERIFICATION_REQUIRED') {
			hasEmailOverride.value = body.has_email === true;
			openModal(forAction || body.message);
			return true;
		}
		return false;
	}

	return {
		open,
		action,
		hasEmail,
		isVerified,
		isGated,
		openModal,
		close,
		requireVerified,
		handleServerError
	};
}

type GateErrorBody = { reason?: string; has_email?: boolean; message?: string };

function extractErrorBody(err: unknown): GateErrorBody | null {
	if (!err) return null;
	if (typeof err === 'object') {
		const e = err as { data?: unknown; response?: { _data?: unknown }; message?: string };
		const candidates: unknown[] = [e.data, e.response?._data, err];
		for (const c of candidates) {
			if (c && typeof c === 'object' && 'reason' in c) {
				return c as GateErrorBody;
			}
		}
	}
	return null;
}
