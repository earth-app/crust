import { useAuthStore } from 'stores/auth';
import type {
	ApiKey,
	ApiKeyCreateInput,
	ApiKeyCreated,
	ApiKeyListResponse,
	ApiKeyScopeCatalog,
	ApiKeyScopeId,
	ApiKeyUpdateInput
} from 'types/apiKeys';

// module-level state so every useApiKeys() consumer (section, modal, sky page)
// shares the same reactive list — otherwise the modal's createKey() would
// only refresh its own copy and the parent stays stale until a manual reload
const catalogState = ref<ApiKeyScopeCatalog | null>(null);
const catalogLoading = ref(false);
const keysState = ref<ApiKey[]>([]);
const activeState = ref(0);
const maxState = ref(0);
const loadingState = ref(false);
const errorState = ref<string | null>(null);

// neutral result envelope returned by every mutating method so each consumer
// can surface success/failure with its own toast (rich Nuxt UI in crust,
// capacitor Toast.show in sky)
export interface ApiKeyResult<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
}

/**
 * api key management composable. side-effect-free with respect to UI — never
 * raises toasts directly so crust web (rich Nuxt UI) and sky mobile
 * (capacitor Toast) can each provide their own feedback layer
 */
export function useApiKeys() {
	const authStore = useAuthStore();

	const fetchCatalog = async (force = false): Promise<ApiKeyScopeCatalog | null> => {
		if (catalogState.value && !force) return catalogState.value;
		if (catalogLoading.value) return catalogState.value;
		catalogLoading.value = true;
		try {
			const res = await makeClientAPIRequest<ApiKeyScopeCatalog>(
				'/v2/api-keys/scopes',
				authStore.sessionToken
			);
			if (res.success && res.data) {
				catalogState.value = res.data;
				return res.data;
			}
			throw new Error(res.message || 'Failed to load API key scope catalog');
		} finally {
			catalogLoading.value = false;
		}
	};

	const fetchKeys = async (): Promise<ApiKeyResult<ApiKeyListResponse>> => {
		loadingState.value = true;
		errorState.value = null;
		try {
			const res = await makeClientAPIRequest<ApiKeyListResponse>(
				'/v2/users/current/api-keys',
				authStore.sessionToken
			);
			if (!res.success || !res.data) {
				throw new Error(res.message || 'Failed to load API keys');
			}
			keysState.value = res.data.items;
			activeState.value = res.data.active;
			maxState.value = res.data.max;
			return { success: true, data: res.data };
		} catch (e: any) {
			const message = e?.message || 'Failed to load API keys';
			errorState.value = message;
			return { success: false, error: message };
		} finally {
			loadingState.value = false;
		}
	};

	const createKey = async (input: ApiKeyCreateInput): Promise<ApiKeyResult<ApiKeyCreated>> => {
		loadingState.value = true;
		errorState.value = null;
		try {
			const res = await makeClientAPIRequest<ApiKeyCreated>(
				'/v2/users/current/api-keys',
				authStore.sessionToken,
				{ method: 'POST', body: input }
			);
			if (!res.success || !res.data) {
				throw new Error(res.message || 'Failed to create API key');
			}

			// optimistic prepend (sans the raw token, which never lives in the list)
			// so the parent's list updates the moment the reveal modal opens —
			// fetchKeys() then reconciles authoritative state (last_used, etc.)
			const { token: _token, warning: _warning, ...stored } = res.data;
			keysState.value = [stored as ApiKey, ...keysState.value];
			activeState.value += 1;
			await fetchKeys();

			return { success: true, data: res.data };
		} catch (e: any) {
			const message = e?.message || 'Failed to create API key';
			errorState.value = message;
			return { success: false, error: message };
		} finally {
			loadingState.value = false;
		}
	};

	const updateKey = async (
		keyId: string,
		patch: ApiKeyUpdateInput
	): Promise<ApiKeyResult<ApiKey>> => {
		try {
			const res = await makeClientAPIRequest<ApiKey>(
				`/v2/users/current/api-keys/${keyId}`,
				authStore.sessionToken,
				{ method: 'PATCH', body: patch }
			);
			if (!res.success || !res.data) {
				throw new Error(res.message || 'Failed to update API key');
			}

			// patch in place to avoid a full re-fetch flicker
			const idx = keysState.value.findIndex((k) => k.id === keyId);
			if (idx !== -1) keysState.value[idx] = res.data;
			return { success: true, data: res.data };
		} catch (e: any) {
			return { success: false, error: e?.message || 'Failed to update API key' };
		}
	};

	const revokeKey = async (keyId: string): Promise<ApiKeyResult> => {
		try {
			const res = await makeClientAPIRequest<unknown>(
				`/v2/users/current/api-keys/${keyId}`,
				authStore.sessionToken,
				{ method: 'DELETE' }
			);
			if (!res.success) {
				throw new Error(res.message || 'Failed to revoke API key');
			}

			// soft-update locally so the list reflects the revoked state without
			// waiting for the round-trip
			const idx = keysState.value.findIndex((k) => k.id === keyId);
			if (idx !== -1) {
				keysState.value[idx] = {
					...keysState.value[idx]!,
					revoked: true,
					revoked_at: new Date().toISOString()
				};
				activeState.value = Math.max(0, activeState.value - 1);
			}
			return { success: true };
		} catch (e: any) {
			return { success: false, error: e?.message || 'Failed to revoke API key' };
		}
	};

	const revokeAllKeys = async (): Promise<ApiKeyResult<{ revoked: number }>> => {
		try {
			const res = await makeClientAPIRequest<{ revoked: number }>(
				'/v2/users/current/api-keys/revoke_all',
				authStore.sessionToken,
				{ method: 'POST' }
			);
			if (!res.success || !res.data) {
				throw new Error(res.message || 'Failed to revoke API keys');
			}
			await fetchKeys();
			return { success: true, data: res.data };
		} catch (e: any) {
			return { success: false, error: e?.message || 'Failed to revoke API keys' };
		}
	};

	return {
		keys: keysState,
		active: activeState,
		max: maxState,
		loading: loadingState,
		error: errorState,
		fetchKeys,
		fetchCatalog,
		catalog: catalogState,
		createKey,
		updateKey,
		revokeKey,
		revokeAllKeys
	};
}

/**
 * resolve a granted scope set into its effective leaves (mirror of the
 * backend's `ApiKeyScope::expand`)
 */
export function expandApiKeyScopes(
	granted: ApiKeyScopeId[],
	catalog: ApiKeyScopeCatalog
): ApiKeyScopeId[] {
	const out = new Set<ApiKeyScopeId>();
	const collectLeaves = (
		tree: Record<string, { description: string; children?: any }>,
		target: string
	): string[] | null => {
		for (const [name, node] of Object.entries(tree)) {
			if (name === target) {
				if (!node.children) return [target];
				const leaves: string[] = [];
				const walk = (sub: Record<string, any>) => {
					for (const [k, n] of Object.entries(sub)) {
						if (!n.children) leaves.push(k);
						else walk(n.children);
					}
				};
				walk(node.children);
				return leaves;
			}
			if (node.children) {
				const nested = collectLeaves(node.children, target);
				if (nested) return nested;
			}
		}
		return null;
	};

	for (const scope of granted) {
		const leaves = collectLeaves(catalog.scopes, scope);
		if (leaves) {
			for (const l of leaves) out.add(l);
		}
	}
	return [...out].sort();
}
