import type { BrowserContext } from '@playwright/test';
import type { MockClient } from './mock-client';
import { makeUser } from './mock-data';

export interface TestActor {
	user: Record<string, any>;
	token: string;
}

// deterministic far-apart lat/lng per test so parallel trailmark specs never share
// a geo bucket (0.1deg grid, spacing >> the 2km max radius)
export function uniqueGeo(testId: string): { latitude: number; longitude: number } {
	let h = 0;
	for (const c of testId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
	const latitude = Number(((h % 1200) / 10 - 60).toFixed(4));
	const longitude = Number((((h >>> 8) % 3200) / 10 - 160).toFixed(4));
	return { latitude, longitude };
}

export async function grantGeolocation(
	context: BrowserContext,
	geo: { latitude: number; longitude: number }
): Promise<void> {
	await context.grantPermissions(['geolocation']);
	await context.setGeolocation(geo);
}

// build a per-test-unique actor (id/username/token embed the testId)
export function makeActor(
	testId: string,
	key: string,
	overrides: Record<string, any> = {}
): TestActor {
	const user = makeUser({
		id: `${key}-${testId.slice(0, 8)}`,
		username: `${key}-${testId.slice(0, 6)}`,
		...overrides
	});
	return { user, token: `tok-${key}-${testId}` };
}

// register actors with the mock so /v2/users/current resolves each of them
export async function registerActors(mockApi: MockClient, ...actors: TestActor[]): Promise<void> {
	for (const actor of actors) await mockApi.registerUser(actor.user);
}

// swap both the browser session cookie and the mock identity to act as this actor.
// direct calls resolve via the (unchanged) X-Test-Id header -> this actor; nitro-proxied
// calls resolve via the actor's session token. call goto() after this to reload the page.
export async function actAs(
	context: BrowserContext,
	mockApi: MockClient,
	actor: TestActor
): Promise<void> {
	await mockApi.loginAs(actor.user.id, actor.token);
	await context.clearCookies({ name: 'session_token' });
	await context.addCookies([
		{
			name: 'session_token',
			value: actor.token,
			domain: '127.0.0.1',
			path: '/',
			sameSite: 'Lax',
			secure: false
		}
	]);
}
