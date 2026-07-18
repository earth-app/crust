import type {
	MarketingKind,
	MarketingResult,
	MarketingScene,
	MarketingSceneInput
} from '~/shared/types/marketing';

// shared facade for the Marketing studio: AI-generate / pull-live sample content
// and save/load reusable mock scenes; every method returns a neutral envelope so
// each panel surfaces its own toast
export function useMarketingStudio() {
	const authStore = useAuthStore();

	async function generate<T = unknown>(
		kind: MarketingKind,
		hint?: string
	): Promise<MarketingResult<T>> {
		const res = await makeServerRequest<T>(
			null,
			'/api/admin/marketing/generate',
			authStore.sessionToken,
			{ method: 'POST', body: { kind, hint } }
		);
		return res.success ? { success: true, data: res.data } : { success: false, error: res.message };
	}

	async function pullLive<T = unknown>(
		kind: MarketingKind,
		options: Record<string, string | number> = {}
	): Promise<MarketingResult<T>> {
		const res = await makeServerRequest<T>(
			null,
			'/api/admin/marketing/pull',
			authStore.sessionToken,
			{ query: { kind, ...options } }
		);
		return res.success ? { success: true, data: res.data } : { success: false, error: res.message };
	}

	async function listScenes(kind?: MarketingKind): Promise<MarketingResult<MarketingScene[]>> {
		const res = await makeServerRequest<MarketingScene[]>(
			null,
			'/api/admin/marketing/scenes',
			authStore.sessionToken,
			{ query: kind ? { kind } : {} }
		);
		return res.success
			? { success: true, data: res.data ?? [] }
			: { success: false, error: res.message };
	}

	async function saveScene<T = unknown>(
		input: MarketingSceneInput<T>
	): Promise<MarketingResult<MarketingScene<T>>> {
		const res = await makeServerRequest<MarketingScene<T>>(
			null,
			'/api/admin/marketing/scenes',
			authStore.sessionToken,
			{ method: 'POST', body: input }
		);
		return res.success ? { success: true, data: res.data } : { success: false, error: res.message };
	}

	async function deleteScene(id: string): Promise<MarketingResult<void>> {
		const res = await makeServerRequest<void>(
			null,
			`/api/admin/marketing/scenes/${id}`,
			authStore.sessionToken,
			{ method: 'DELETE' }
		);
		return res.success ? { success: true } : { success: false, error: res.message };
	}

	return { generate, pullLive, listScenes, saveScene, deleteScene };
}
