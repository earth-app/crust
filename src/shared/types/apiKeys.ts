// Type definitions for the API key store. Wire-format matches
// mantle2 `Mantle2Schemas::apiKey()` / `apiKeyScopeCatalog()`.

export type ApiKeyScopeId = string;

export interface ApiKeyScopeNode {
	description: string;
	children?: Record<ApiKeyScopeId, ApiKeyScopeNode>;
}

export interface ApiKeyExpiryPreset {
	seconds: number;
	days: number;
}

export interface ApiKeyScopeCatalog {
	scopes: Record<ApiKeyScopeId, ApiKeyScopeNode>;
	leaves: ApiKeyScopeId[];
	tier_limits: Record<string, number>;
	expiry_presets: Record<string, ApiKeyExpiryPreset>;
	token: {
		prefix: string;
		total_length: number;
		random_hex_length: number;
	};
	name: { min: number; max: number };
	description: { max: number };
}

export interface ApiKey {
	id: string;
	name: string;
	description?: string | null;
	scopes: ApiKeyScopeId[];
	token_prefix: string;
	created_at: string;
	expires_at: string | null;
	last_used_at: string | null;
	last_used_ip: string | null;
	revoked: boolean;
	revoked_at: string | null;
	expired: boolean;
	never_expires: boolean;
}

export interface ApiKeyListResponse {
	items: ApiKey[];
	count: number;
	active: number;
	max: number;
}

export interface ApiKeyCreated extends ApiKey {
	token: string;
	warning: string;
}

export type ApiKeyExpiryPresetKey = '7d' | '30d' | '60d' | '90d' | '180d' | '1y' | 'never';

export interface ApiKeyCreateInput {
	name: string;
	description?: string | null;
	scopes: ApiKeyScopeId[];
	// One of:
	expiry_preset?: ApiKeyExpiryPresetKey | null;
	expires_at?: number | null; // unix seconds
}

export interface ApiKeyUpdateInput {
	name?: string;
	description?: string | null;
	scopes?: ApiKeyScopeId[];
}
