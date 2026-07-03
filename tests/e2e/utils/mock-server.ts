/**
 * Mock backend server for E2E tests.
 *
 * Listens on two ports and emulates a subset of:
 *   - mantle2 (`/v2/*`) on port 8787
 *   - cloud (`/v1/*` + `/ws/*`) on port 9898
 *
 * The server is a tiny in-memory router with the following ergonomics:
 *
 *   - Default handlers respond with sensible canned data for the most common GETs
 *     so individual tests don't have to wire up every endpoint to assert on a
 *     single page.
 *
 *   - Tests can override responses per-request by POSTing a directive to the
 *     control plane on `/__mock__/` (same port, distinct path). The override is
 *     a (method, path, response) tuple held in a stack - first match wins, and
 *     overrides are consumed (one-shot) by default. This is exposed via the
 *     `mockApi` Playwright fixture as `mockApi.set(...)`.
 *
 *   - The control plane also supports clearing all overrides and toggling
 *     identity: `mockApi.loginAs(user)` flips the global "current user" so any
 *     downstream `/v2/users/current` requests return that user.
 *
 *   - The server is started once by Playwright's globalSetup and reused across
 *     all workers. Per-test overrides are scoped by the X-Test-Id header which
 *     each fixture stamps onto routed requests (via `page.route`), so parallel
 *     workers don't bleed state.
 *
 * This file is dependency-free (just `node:http`) so it can be required from
 * any context - globalSetup, individual tests, or CLI invocation for
 * debugging (`bun tests/e2e/utils/mock-server.ts`).
 */

import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import {
	MOCK_ADMIN_TOKEN,
	MOCK_SESSION_TOKEN,
	makeActivity,
	makeAdmin,
	makeAnalytics,
	makeArticle,
	makeBadge,
	makeBlacklistEntry,
	makeEvent,
	makeMoodSnapshot,
	makeNotification,
	makePollVote,
	makePrompt,
	makePromptResponse,
	makeQuest,
	makeReferralStats,
	makeReportListItem,
	makeUser,
	paginate
} from './mock-data';

export const MANTLE_PORT = Number(process.env.MOCK_MANTLE_PORT ?? 8787);
export const CLOUD_PORT = Number(process.env.MOCK_CLOUD_PORT ?? 9898);

type Handler = (
	req: IncomingMessage,
	res: ServerResponse,
	ctx: RouteContext
) => void | Promise<void>;

interface RouteContext {
	url: URL;
	body: any;
	token: string | null;
	testId: string | null;
}

interface Override {
	method: string;
	path: string; // regex string
	testId: string | null;
	once: boolean;
	status: number;
	body: any;
	headers?: Record<string, string>;
}

interface BackendState {
	users: Record<string, any>;
	activities: Record<string, any>;
	articles: Record<string, any>;
	events: Record<string, any>;
	prompts: Record<string, any>;
	currentUserByToken: Record<string, string>; // token -> userId
	currentUserByTestId: Record<string, string | null>; // testId -> userId (overrides currentUserByToken)
	overrides: Override[];
	// wave-2: per-topic mood tallies, per-test blacklist rows (roundtrip state)
	mood: Record<string, Record<string, number>>;
	blacklist: any[];
}

function freshState(): BackendState {
	const testUser = makeUser({ id: 'test-user-1', username: 'testuser' });
	const adminUser = makeAdmin({ id: 'admin-user-1', username: 'admin' });
	const author = makeUser({ id: 'author-1', username: 'author' });
	const host = makeUser({ id: 'host-1', username: 'host', account: { account_type: 'ORGANIZER' } });
	const writer = makeUser({
		id: 'writer-1',
		username: 'writer',
		account: { account_type: 'WRITER' }
	});

	const activities = Array.from({ length: 30 }, (_, i) =>
		makeActivity({ id: `act-${i + 1}`, name: `Sample Activity ${i + 1}` })
	);
	const articles = Array.from({ length: 12 }, (_, i) =>
		makeArticle({
			id: `art-${i + 1}`,
			title: `Article ${i + 1}`,
			author: writer,
			author_id: writer.id
		})
	);
	const events = Array.from({ length: 8 }, (_, i) =>
		makeEvent({ id: `evt-${i + 1}`, name: `Event ${i + 1}`, host, hostId: host.id })
	);
	const prompts = Array.from({ length: 15 }, (_, i) =>
		makePrompt({
			id: `pmt-${i + 1}`,
			prompt: `Sample prompt ${i + 1}?`,
			owner: testUser,
			owner_id: testUser.id
		})
	);

	const usersObj = Object.fromEntries(
		[testUser, adminUser, author, host, writer].map((u) => [u.id, u])
	);

	return {
		users: usersObj,
		activities: Object.fromEntries(activities.map((a) => [a.id, a])),
		articles: Object.fromEntries(articles.map((a) => [a.id, a])),
		events: Object.fromEntries(events.map((e) => [e.id, e])),
		prompts: Object.fromEntries(prompts.map((p) => [p.id, p])),
		currentUserByToken: {
			[MOCK_SESSION_TOKEN]: testUser.id,
			[MOCK_ADMIN_TOKEN]: adminUser.id
		},
		currentUserByTestId: {},
		overrides: [],
		mood: {},
		blacklist: [
			makeBlacklistEntry({ kind: 'username', value: 'spammer', reason: 'Known abuser' }),
			makeBlacklistEntry({ kind: 'email', value: 'evil@bad.com', reason: 'Fraud' })
		]
	};
}

let state: BackendState = freshState();

export function resetState() {
	state = freshState();
}

function json(
	res: ServerResponse,
	status: number,
	body: any,
	headers: Record<string, string> = {}
) {
	// `Access-Control-Allow-Origin: *` together with `Allow-Credentials: true` is
	// rejected by browsers. We echo the request origin (set by the caller via
	// `_origin` header on the ServerResponse) so credentialed fetches still work.
	const origin = (res as any)._reqOrigin || '*';
	res.writeHead(status, {
		'content-type': 'application/json; charset=utf-8',
		'access-control-allow-origin': origin,
		'access-control-allow-credentials': 'true',
		'access-control-allow-headers': '*',
		'access-control-expose-headers': '*',
		'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
		vary: 'Origin',
		...headers
	});
	res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function notFound(res: ServerResponse, message = 'Not Found') {
	json(res, 404, { message, code: 404 });
}

function unauthorized(res: ServerResponse) {
	json(res, 401, { message: 'Unauthorized', code: 401 });
}

async function readBody(req: IncomingMessage): Promise<any> {
	return new Promise((resolve) => {
		const chunks: Buffer[] = [];
		req.on('data', (chunk: Buffer) => chunks.push(chunk));
		req.on('end', () => {
			const buf = Buffer.concat(chunks);
			if (!buf.length) return resolve(null);
			const ct = (req.headers['content-type'] || '').toString();
			if (ct.includes('application/json')) {
				try {
					resolve(JSON.parse(buf.toString('utf8')));
				} catch {
					resolve(null);
				}
			} else if (ct.includes('application/x-www-form-urlencoded')) {
				const params = new URLSearchParams(buf.toString('utf8'));
				resolve(Object.fromEntries(params.entries()));
			} else {
				resolve(buf);
			}
		});
		req.on('error', () => resolve(null));
	});
}

function tokenFor(req: IncomingMessage): string | null {
	const auth = req.headers.authorization;
	if (!auth) return null;
	if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
	if (auth.startsWith('Basic ')) return auth.slice(6).trim();
	return null;
}

function currentUserId(ctx: RouteContext): string | null {
	if (ctx.testId && state.currentUserByTestId[ctx.testId] !== undefined) {
		return state.currentUserByTestId[ctx.testId] ?? null;
	}
	if (ctx.token && state.currentUserByToken[ctx.token]) {
		return state.currentUserByToken[ctx.token] ?? null;
	}
	return null;
}

function findUser(idOrUsername: string): any | undefined {
	if (state.users[idOrUsername]) return state.users[idOrUsername];
	return Object.values(state.users).find((u: any) => u.username === idOrUsername);
}

// ---------------------------------------------------------------------------
// Route table - mantle2 (/v2/*)
// ---------------------------------------------------------------------------

const mantleRoutes: Array<{ method: string; pattern: RegExp; handler: Handler }> = [
	// Health check
	{
		method: 'GET',
		pattern: /^\/v2\/hello\/?$/,
		handler: (_req, res) =>
			json(res, 200, { message: 'Hello from mantle2 mock', version: 'mock-1.0.0' })
	},

	// Login -- Basic auth
	{
		method: 'POST',
		pattern: /^\/v2\/users\/login\/?$/,
		handler: (req, res) => {
			const auth = req.headers.authorization;
			if (!auth?.startsWith('Basic ')) return unauthorized(res);
			const decoded = Buffer.from(auth.slice(6).trim(), 'base64').toString('utf8');
			const [username, password] = decoded.split(':');
			if (!username || !password) return unauthorized(res);

			// Magic credentials for tests
			if (password === 'wrongpassword' || password === 'invalid') return unauthorized(res);
			if (username === 'lockedout') return json(res, 429, { message: 'Too many login attempts' });

			const user = findUser(username);
			if (!user) return json(res, 404, { message: 'User not found' });
			json(res, 200, { session_token: MOCK_SESSION_TOKEN });
		}
	},

	// Create user (signup)
	{
		method: 'POST',
		pattern: /^\/v2\/users\/create\/?$/,
		handler: async (_req, res, ctx) => {
			const body = ctx.body ?? {};
			if (!body.username || !body.password) {
				return json(res, 400, { message: 'username and password required' });
			}
			if (body.username === 'taken') {
				return json(res, 409, { message: 'Username already taken' });
			}
			const newUser = makeUser({
				id: `new-${body.username}`,
				username: body.username,
				account: {
					email: body.email,
					email_verified: false,
					first_name: body.first_name,
					last_name: body.last_name
				}
			});
			state.users[newUser.id] = newUser;
			state.currentUserByToken[MOCK_SESSION_TOKEN] = newUser.id;
			json(res, 201, { user: newUser, session_token: MOCK_SESSION_TOKEN });
		}
	},

	// Logout
	{
		method: 'POST',
		pattern: /^\/v2\/users\/logout\/?$/,
		handler: (_req, res) => json(res, 200, { message: 'Logged out' })
	},

	// Current user
	{
		method: 'GET',
		pattern: /^\/v2\/users\/current\/?$/,
		handler: (_req, res, ctx) => {
			const id = currentUserId(ctx);
			if (!id) return unauthorized(res);
			const user = state.users[id];
			if (!user) return unauthorized(res);
			json(res, 200, user);
		}
	},

	// Send email verification
	{
		method: 'POST',
		pattern: /^\/v2\/users\/current\/send_email_verification\/?$/,
		handler: (_req, res, ctx) => {
			const id = currentUserId(ctx);
			if (!id) return unauthorized(res);
			json(res, 204, '');
		}
	},

	// api-keys scope catalog (ProfileEditor's ApiKeys section fetches this on mount)
	{
		method: 'GET',
		pattern: /^\/v2\/api-keys\/scopes\/?$/,
		handler: (_req, res) =>
			json(res, 200, {
				scopes: {},
				leaves: [],
				tier_limits: { FREE: 3, PRO: 25 },
				expiry_presets: {},
				token: { prefix: 'ea_', total_length: 40, random_hex_length: 32 },
				name: { min: 1, max: 60 },
				description: { max: 255 }
			})
	},

	// api-keys list for the current user
	{
		method: 'GET',
		pattern: /^\/v2\/users\/current\/api-keys\/?$/,
		handler: (_req, res, ctx) => {
			const id = currentUserId(ctx);
			if (!id) return unauthorized(res);
			json(res, 200, { items: [], count: 0, active: 0, max: 3 });
		}
	},

	// Verify email
	{
		method: 'POST',
		pattern: /^\/v2\/users\/current\/verify_email\/?$/,
		handler: (_req, res, ctx) => {
			const id = currentUserId(ctx);
			if (!id) return unauthorized(res);
			const code = ctx.url.searchParams.get('code');
			if (!code || code === 'invalid') {
				return json(res, 400, { message: 'Invalid verification code' });
			}
			if (code === 'expired') {
				return json(res, 410, { message: 'Code expired' });
			}
			const user = state.users[id];
			if (user) user.account.email_verified = true;
			json(res, 204, '');
		}
	},

	// Change password
	{
		method: 'POST',
		pattern: /^\/v2\/users\/current\/change_password\/?$/,
		handler: (_req, res, ctx) => {
			const id = currentUserId(ctx);
			if (!id) return unauthorized(res);
			const oldPass = ctx.url.searchParams.get('old_password');
			if (oldPass === 'wrong') return json(res, 401, { message: 'Old password incorrect' });
			json(res, 204, '');
		}
	},

	// Forgot password (reset_password)
	{
		method: 'POST',
		pattern: /^\/v2\/users\/reset_password\/?$/,
		handler: (_req, res, ctx) => {
			const email = ctx.url.searchParams.get('email');
			if (!email) return json(res, 400, { message: 'email required' });
			json(res, 204, '');
		}
	},

	// Update current user
	{
		method: 'PATCH',
		pattern: /^\/v2\/users\/current\/?$/,
		handler: (_req, res, ctx) => {
			const id = currentUserId(ctx);
			if (!id) return unauthorized(res);
			const user = state.users[id];
			if (!user) return unauthorized(res);
			Object.assign(user, ctx.body ?? {});
			json(res, 200, user);
		}
	},

	// User listing (admin)
	{
		method: 'GET',
		pattern: /^\/v2\/users\/?$/,
		handler: (_req, res, ctx) => {
			const page = Number(ctx.url.searchParams.get('page') ?? '1');
			const limit = Number(ctx.url.searchParams.get('limit') ?? '25');
			const search = ctx.url.searchParams.get('search') ?? '';
			const users = Object.values(state.users).filter(
				(u: any) => !search || u.username.toLowerCase().includes(search.toLowerCase())
			);
			json(res, 200, paginate(users, page, limit));
		}
	},

	// Specific user by username or id
	{
		method: 'GET',
		pattern: /^\/v2\/users\/(?!current)([^/?]+)\/?$/,
		handler: (_req, res, ctx) => {
			const match = ctx.url.pathname.match(/^\/v2\/users\/([^/?]+)$/);
			if (!match) return notFound(res);
			const user = findUser(match[1]!);
			if (!user) return notFound(res, 'User not found');
			json(res, 200, user);
		}
	},

	// User activities
	{
		method: 'GET',
		pattern: /^\/v2\/users\/[^/]+\/activities\/?$/,
		handler: (_req, res) => {
			json(res, 200, paginate(Object.values(state.activities).slice(0, 5), 1, 5));
		}
	},

	// Recommended activities for current user
	{
		method: 'POST',
		pattern: /^\/v2\/users\/current\/activities\/recommend\/?$/,
		handler: (_req, res, ctx) => {
			const id = currentUserId(ctx);
			if (!id) return unauthorized(res);
			json(res, 200, Object.values(state.activities).slice(0, 4));
		}
	},

	// Field privacy
	{
		method: 'PATCH',
		pattern: /^\/v2\/users\/current\/field_privacy\/?$/,
		handler: (_req, res, ctx) => {
			const id = currentUserId(ctx);
			if (!id) return unauthorized(res);
			json(res, 204, '');
		}
	},

	// Activities list
	{
		method: 'GET',
		pattern: /^\/v2\/activities\/?$/,
		handler: (_req, res, ctx) => {
			const page = Number(ctx.url.searchParams.get('page') ?? '1');
			const limit = Number(ctx.url.searchParams.get('limit') ?? '25');
			const search = ctx.url.searchParams.get('search') ?? '';
			const items = Object.values(state.activities).filter(
				(a: any) => !search || a.name.toLowerCase().includes(search.toLowerCase())
			);
			json(res, 200, paginate(items, page, limit));
		}
	},

	// Activity count
	{
		method: 'GET',
		pattern: /^\/v2\/activities\/count\/?$/,
		handler: (_req, res) => json(res, 200, { count: Object.values(state.activities).length })
	},

	// Activity by id
	{
		method: 'GET',
		pattern: /^\/v2\/activities\/([^/?]+)\/?$/,
		handler: (_req, res, ctx) => {
			const match = ctx.url.pathname.match(/^\/v2\/activities\/([^/?]+)$/);
			if (!match) return notFound(res);
			const activity = state.activities[match[1]!];
			if (!activity) return notFound(res, 'Activity not found');
			json(res, 200, activity);
		}
	},

	// Articles list
	{
		method: 'GET',
		pattern: /^\/v2\/articles\/?$/,
		handler: (_req, res, ctx) => {
			const page = Number(ctx.url.searchParams.get('page') ?? '1');
			const limit = Number(ctx.url.searchParams.get('limit') ?? '25');
			json(res, 200, paginate(Object.values(state.articles), page, limit));
		}
	},

	// Random / recent articles
	{
		method: 'GET',
		pattern: /^\/v2\/articles\/(random|recent|older)\/?$/,
		handler: (_req, res) => json(res, 200, Object.values(state.articles).slice(0, 5))
	},

	// Article by id
	{
		method: 'GET',
		pattern: /^\/v2\/articles\/([a-zA-Z0-9-]+)\/?$/,
		handler: (_req, res, ctx) => {
			const id = ctx.url.pathname.split('/').pop();
			if (!id) return notFound(res);
			if (['random', 'recent', 'older'].includes(id)) return notFound(res); // handled above
			const article = state.articles[id];
			if (!article) return notFound(res, 'Article not found');
			json(res, 200, article);
		}
	},

	// Create article
	{
		method: 'POST',
		pattern: /^\/v2\/articles\/?$/,
		handler: (_req, res, ctx) => {
			const userId = currentUserId(ctx);
			if (!userId) return unauthorized(res);
			const body = ctx.body ?? {};
			const article = makeArticle({ ...body, author_id: userId, author: state.users[userId] });
			state.articles[article.id] = article;
			json(res, 201, article);
		}
	},

	// Events list
	{
		method: 'GET',
		pattern: /^\/v2\/events\/?$/,
		handler: (_req, res, ctx) => {
			const page = Number(ctx.url.searchParams.get('page') ?? '1');
			const limit = Number(ctx.url.searchParams.get('limit') ?? '25');
			json(res, 200, paginate(Object.values(state.events), page, limit));
		}
	},

	// Random/recent/upcoming events
	{
		method: 'GET',
		pattern: /^\/v2\/events\/(random|recent|upcoming)\/?$/,
		handler: (_req, res) => json(res, 200, Object.values(state.events).slice(0, 4))
	},

	// Event by id
	{
		method: 'GET',
		pattern: /^\/v2\/events\/([a-zA-Z0-9-]+)\/?$/,
		handler: (_req, res, ctx) => {
			const id = ctx.url.pathname.split('/').pop();
			if (!id) return notFound(res);
			if (['random', 'recent', 'upcoming'].includes(id)) return notFound(res);
			const event = state.events[id];
			if (!event) return notFound(res, 'Event not found');
			json(res, 200, event);
		}
	},

	// Event attendees
	{
		method: 'GET',
		pattern: /^\/v2\/events\/[^/]+\/attendees\/?$/,
		handler: (_req, res) =>
			json(res, 200, paginate([state.users['test-user-1']!, state.users['author-1']!], 1, 25))
	},

	// Event update / delete
	{
		method: 'PATCH',
		pattern: /^\/v2\/events\/[^/]+\/?$/,
		handler: (_req, res, ctx) => {
			const id = ctx.url.pathname.split('/').pop()!;
			const event = state.events[id];
			if (!event) return notFound(res);
			Object.assign(event, ctx.body ?? {});
			json(res, 200, event);
		}
	},
	{
		method: 'DELETE',
		pattern: /^\/v2\/events\/[^/]+\/?$/,
		handler: (_req, res, ctx) => {
			const id = ctx.url.pathname.split('/').pop()!;
			delete state.events[id];
			json(res, 204, '');
		}
	},

	// Prompts list / random
	{
		method: 'GET',
		pattern: /^\/v2\/prompts\/?$/,
		handler: (_req, res, ctx) => {
			const page = Number(ctx.url.searchParams.get('page') ?? '1');
			const limit = Number(ctx.url.searchParams.get('limit') ?? '25');
			json(res, 200, paginate(Object.values(state.prompts), page, limit));
		}
	},
	{
		method: 'GET',
		pattern: /^\/v2\/prompts\/random\/?$/,
		handler: (_req, res) => json(res, 200, Object.values(state.prompts).slice(0, 10))
	},

	// Prompt by id
	{
		method: 'GET',
		pattern: /^\/v2\/prompts\/([a-zA-Z0-9-]+)\/?$/,
		handler: (_req, res, ctx) => {
			const id = ctx.url.pathname.split('/').pop();
			if (!id) return notFound(res);
			if (id === 'random') return notFound(res);
			const prompt = state.prompts[id];
			if (!prompt) return notFound(res, 'Prompt not found');
			json(res, 200, prompt);
		}
	},

	// Prompt responses
	{
		method: 'GET',
		pattern: /^\/v2\/prompts\/[^/]+\/responses\/?$/,
		handler: (_req, res) =>
			json(res, 200, paginate([makePromptResponse({}), makePromptResponse({ id: 'pr-2' })], 1, 25))
	},

	// Create prompt
	{
		method: 'POST',
		pattern: /^\/v2\/prompts\/?$/,
		handler: (_req, res, ctx) => {
			const userId = currentUserId(ctx);
			if (!userId) return unauthorized(res);
			const body = ctx.body ?? {};
			const prompt = makePrompt({ ...body, owner_id: userId, owner: state.users[userId] });
			state.prompts[prompt.id] = prompt;
			json(res, 201, prompt);
		}
	},

	// Shareable quest achievement card (public OG image) - 1x1 png so the <img> resolves
	{
		method: 'GET',
		pattern: /^\/v2\/users\/[^/]+\/share\/quest\/[^/]+\/?$/,
		handler: (_req, res) => {
			const png = Buffer.from(
				'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
				'base64'
			);
			res.writeHead(200, {
				'content-type': 'image/png',
				'access-control-allow-origin': (res as any)._reqOrigin || '*'
			});
			res.end(png);
		}
	},
	// Referral code (current user)
	{
		method: 'GET',
		pattern: /^\/v2\/users\/current\/referral\/?$/,
		handler: (_req, res, ctx) => {
			if (!currentUserId(ctx)) return unauthorized(res);
			json(res, 200, { code: 'ABC234' });
		}
	},
	// Referral stats (current user)
	{
		method: 'GET',
		pattern: /^\/v2\/users\/current\/referral\/stats\/?$/,
		handler: (_req, res, ctx) => {
			if (!currentUserId(ctx)) return unauthorized(res);
			json(res, 200, makeReferralStats());
		}
	},
	// Scoped leaderboard - friends/circle resolve here; global is proxied via cloud
	{
		method: 'GET',
		pattern: /^\/v2\/users\/[^/]+\/leaderboard\/?$/,
		handler: (_req, res, ctx) => {
			if (!currentUserId(ctx)) return unauthorized(res);
			const type = ctx.url.searchParams.get('type') ?? 'points';
			const scope = ctx.url.searchParams.get('scope') ?? 'friends';
			const members = [
				state.users['author-1'],
				state.users['host-1'],
				state.users['writer-1']
			].filter(Boolean);
			const items = members.map((user: any, i: number) => ({
				rank: i + 1,
				value: type === 'points' ? 800 - i * 200 : 9 - i * 2,
				user
			}));
			json(res, 200, { scope, type, items, total: items.length });
		}
	},
	// Quest co-op challenge - view (current user); default: no challenge for this quest
	{
		method: 'GET',
		pattern: /^\/v2\/users\/current\/quest\/challenge\/?$/,
		handler: (_req, res, ctx) => {
			if (!currentUserId(ctx)) return unauthorized(res);
			json(res, 200, { challenge: null, other_user: null, other_progress: null });
		}
	},
	// Quest co-op challenge - create (current user challenges a friend to a quest)
	{
		method: 'POST',
		pattern: /^\/v2\/users\/current\/quest\/challenge\/?$/,
		handler: (_req, res, ctx) => {
			if (!currentUserId(ctx)) return unauthorized(res);
			const friend = ctx.url.searchParams.get('friend');
			const quest = ctx.url.searchParams.get('quest');
			if (!friend || !quest) return json(res, 400, { message: 'friend and quest required' });
			json(res, 201, {
				notification: makeNotification({ title: 'Quest Challenge', user_id: friend }),
				challenge: { id: 'chal-new', quest_id: quest, recipient_id: friend, status: 'pending' }
			});
		}
	},
	// Quest co-op challenge - accept / decline (current user, by challenge id)
	{
		method: 'POST',
		pattern: /^\/v2\/users\/current\/quest\/challenge\/[^/]+\/(accept|decline)\/?$/,
		handler: (_req, res, ctx) => {
			if (!currentUserId(ctx)) return unauthorized(res);
			json(res, 200, { ok: true });
		}
	},
	// MOTD
	{
		method: 'GET',
		pattern: /^\/v2\/motd\/?$/,
		handler: (_req, res) =>
			json(res, 200, {
				motd: 'Welcome to The Earth App!',
				ttl: 3600,
				icon: 'mdi:earth',
				type: 'info'
			})
	},
	{
		method: 'POST',
		pattern: /^\/v2\/motd\/?$/,
		handler: (_req, res, ctx) => {
			const userId = currentUserId(ctx);
			if (!userId) return unauthorized(res);
			const user = state.users[userId];
			if (!user?.is_admin) return json(res, 403, { message: 'Forbidden' });
			json(res, 204, '');
		}
	},

	// GET current tally for a topic/date; POST records a vote and returns the new snapshot
	{
		method: 'GET',
		pattern: /^\/v2\/mood\/[^/]+\/[^/]+\/?$/,
		handler: (_req, res, ctx) => {
			const topic = ctx.url.pathname.split('/')[3] ?? 'today';
			json(res, 200, makeMoodSnapshot({ counts: state.mood[topic] ?? {} }));
		}
	},
	{
		method: 'POST',
		pattern: /^\/v2\/mood\/[^/]+\/[^/]+\/?$/,
		handler: (_req, res, ctx) => {
			const topic = ctx.url.pathname.split('/')[3] ?? 'today';
			const emoji = ctx.body?.emoji as string | undefined;
			if (!emoji) return json(res, 400, { message: 'emoji required' });
			const counts = (state.mood[topic] ??= {});
			counts[emoji] = (counts[emoji] ?? 0) + 1;
			json(res, 200, makeMoodSnapshot({ counts }));
		}
	},
	{
		method: 'GET',
		pattern: /^\/v2\/users\/current\/poll\/?$/,
		handler: (_req, res, ctx) => {
			if (!currentUserId(ctx)) return unauthorized(res);
			json(res, 200, { items: [] });
		}
	},
	{
		method: 'POST',
		pattern: /^\/v2\/users\/current\/poll\/?$/,
		handler: (_req, res, ctx) => {
			if (!currentUserId(ctx)) return unauthorized(res);
			const body = ctx.body ?? {};
			json(
				res,
				200,
				makePollVote({
					poll_id: body.poll_id,
					option_index: body.option_index ?? 0,
					question: body.question,
					options: body.options
				})
			);
		}
	},
	{
		method: 'DELETE',
		pattern: /^\/v2\/users\/current\/poll\/?$/,
		handler: (_req, res, ctx) => {
			if (!currentUserId(ctx)) return unauthorized(res);
			json(res, 200, { removed: true, poll_id: ctx.body?.poll_id ?? '' });
		}
	},
	{
		method: 'GET',
		pattern: /^\/v2\/admin\/polls\/?$/,
		handler: (_req, res, ctx) => {
			const id = currentUserId(ctx);
			if (!id) return unauthorized(res);
			if (!state.users[id]?.is_admin) return json(res, 403, { message: 'Forbidden' });
			json(res, 200, {
				items: [
					{
						poll_id: 'q-sample',
						question: 'Where do you do this most often?',
						options: ['Alone', 'With Friends', 'With Family'],
						counts: [5, 3, 2],
						total: 10,
						updated_at: Math.floor(Date.now() / 1000)
					}
				]
			});
		}
	},

	// --- wave-2: reports ---
	// POST create (anon allowed); GET admin list; PATCH admin action
	{
		method: 'POST',
		pattern: /^\/v2\/reports\/?$/,
		handler: (_req, res, ctx) => {
			const body = ctx.body ?? {};
			const report = makeReportListItem({
				content_type: body.content_type,
				content_id: body.content_id,
				reason: body.reason,
				description: body.description ?? ''
			});
			json(res, 200, { report, deduped: false });
		}
	},
	{
		method: 'GET',
		pattern: /^\/v2\/reports\/?$/,
		handler: (_req, res, ctx) => {
			const id = currentUserId(ctx);
			if (!id) return unauthorized(res);
			if (!state.users[id]?.is_admin) return json(res, 403, { message: 'Forbidden' });
			const status = (ctx.url.searchParams.get('status') ?? 'pending') as string;
			const reports =
				status === 'pending'
					? [
							makeReportListItem({ id: 'rpt-1', reason: 'spam', report_count: 3 }),
							makeReportListItem({
								id: 'rpt-2',
								content_type: 'article',
								reason: 'hate_speech',
								source: 'ai'
							})
						]
					: [];
			json(res, 200, { reports, page: 1, limit: 50, total: reports.length });
		}
	},
	{
		method: 'PATCH',
		pattern: /^\/v2\/reports\/[^/]+\/?$/,
		handler: (_req, res, ctx) => {
			const id = currentUserId(ctx);
			if (!id) return unauthorized(res);
			if (!state.users[id]?.is_admin) return json(res, 403, { message: 'Forbidden' });
			const reportId = ctx.url.pathname.split('/').pop()!;
			const action = ctx.body?.action as string | undefined;
			const enforced =
				action === 'ban_user'
					? 'permanent_ban'
					: action === 'delete_content'
						? 'disable_1_month'
						: 'none';
			json(res, 200, {
				...makeReportListItem({ id: reportId, status: 'actioned', reviewed_by: 'admin' }),
				enforced_action: enforced
			});
		}
	},

	// --- wave-2: admin analytics ---
	{
		method: 'GET',
		pattern: /^\/v2\/admin\/analytics\/?$/,
		handler: (_req, res, ctx) => {
			const id = currentUserId(ctx);
			if (!id) return unauthorized(res);
			if (!state.users[id]?.is_admin) return json(res, 403, { message: 'Forbidden' });
			json(
				res,
				200,
				makeAnalytics({
					since: ctx.url.searchParams.get('since') ?? undefined,
					until: ctx.url.searchParams.get('until') ?? undefined
				})
			);
		}
	},
	{
		method: 'GET',
		pattern: /^\/v2\/admin\/blacklist\/?$/,
		handler: (_req, res, ctx) => {
			const id = currentUserId(ctx);
			if (!id) return unauthorized(res);
			if (!state.users[id]?.is_admin) return json(res, 403, { message: 'Forbidden' });
			json(res, 200, { entries: state.blacklist });
		}
	},
	{
		method: 'POST',
		pattern: /^\/v2\/admin\/blacklist\/?$/,
		handler: (_req, res, ctx) => {
			const id = currentUserId(ctx);
			if (!id) return unauthorized(res);
			if (!state.users[id]?.is_admin) return json(res, 403, { message: 'Forbidden' });
			const body = ctx.body ?? {};
			if (!body.value) return json(res, 400, { message: 'value required' });
			const entry = makeBlacklistEntry({
				kind: body.kind ?? 'username',
				value: body.value,
				reason: body.reason ?? ''
			});
			state.blacklist.unshift(entry);
			json(res, 200, { entry });
		}
	},
	{
		method: 'DELETE',
		pattern: /^\/v2\/admin\/blacklist\/?$/,
		handler: (_req, res, ctx) => {
			const id = currentUserId(ctx);
			if (!id) return unauthorized(res);
			if (!state.users[id]?.is_admin) return json(res, 403, { message: 'Forbidden' });
			const kind = ctx.url.searchParams.get('kind');
			const value = ctx.url.searchParams.get('value');
			state.blacklist = state.blacklist.filter(
				(e) => !(e.kind === kind && e.original_value === value)
			);
			json(res, 204, '');
		}
	},

	// --- wave-2: content delete (prompts + articles; events delete already above) ---
	{
		method: 'DELETE',
		pattern: /^\/v2\/prompts\/[^/]+\/?$/,
		handler: (_req, res, ctx) => {
			const id = ctx.url.pathname.split('/').pop()!;
			delete state.prompts[id];
			json(res, 204, '');
		}
	},
	{
		method: 'DELETE',
		pattern: /^\/v2\/articles\/[^/]+\/?$/,
		handler: (_req, res, ctx) => {
			const id = ctx.url.pathname.split('/').pop()!;
			delete state.articles[id];
			json(res, 204, '');
		}
	}
];

// ---------------------------------------------------------------------------
// Route table - cloud (/v1/*, /ws/*)
// ---------------------------------------------------------------------------

const cloudRoutes: Array<{ method: string; pattern: RegExp; handler: Handler }> = [
	// Health
	{
		method: 'GET',
		pattern: /^\/?$/,
		handler: (_req, res) => json(res, 200, 'Woosh!')
	},

	// Activity enrichment (icon, sources)
	{
		method: 'GET',
		pattern: /^\/v1\/activity\/[^/]+\/?$/,
		handler: (_req, res, ctx) => {
			const id = ctx.url.pathname.split('/').pop()!;
			const activity = state.activities[id];
			if (!activity) return notFound(res);
			json(res, 200, {
				...activity,
				icon: 'mdi:earth',
				wikipedia: { url: 'https://en.wikipedia.org/wiki/Example' }
			});
		}
	},

	// Article quiz - create/score/submit
	{
		method: 'POST',
		pattern: /^\/v1\/articles\/quiz\/create\/?$/,
		handler: (_req, res) =>
			json(res, 200, {
				quiz: {
					questions: [
						{
							question: 'What is 2+2?',
							type: 'multiple_choice',
							options: ['3', '4', '5'],
							correct_answer: '4'
						}
					]
				}
			})
	},
	{
		method: 'POST',
		pattern: /^\/v1\/articles\/quiz\/score\/?$/,
		handler: (_req, res) => json(res, 200, { score: 1, total: 1 })
	},
	{
		method: 'POST',
		pattern: /^\/v1\/articles\/quiz\/submit\/?$/,
		handler: (_req, res) => json(res, 204, '')
	},

	// Recommended articles / events
	{
		method: 'POST',
		pattern: /^\/v1\/articles\/recommend_similar_articles\/?$/,
		handler: (_req, res) => json(res, 200, Object.values(state.articles).slice(0, 3))
	},
	{
		method: 'POST',
		pattern: /^\/v1\/events\/recommend_similar_events\/?$/,
		handler: (_req, res) => json(res, 200, Object.values(state.events).slice(0, 3))
	},
	{
		method: 'POST',
		pattern: /^\/v1\/users\/recommend_articles\/?$/,
		handler: (_req, res) => json(res, 200, Object.values(state.articles).slice(0, 3))
	},
	{
		method: 'POST',
		pattern: /^\/v1\/users\/recommend_events\/?$/,
		handler: (_req, res) => json(res, 200, Object.values(state.events).slice(0, 3))
	},

	// Event thumbnails
	{
		method: 'GET',
		pattern: /^\/v1\/events\/thumbnail\/[^/]+\/?$/,
		handler: (_req, res) => {
			res.writeHead(204);
			res.end();
		}
	},
	{
		method: 'GET',
		pattern: /^\/v1\/events\/thumbnail\/[^/]+\/metadata\/?$/,
		handler: (_req, res) => json(res, 200, { source: 'test', generated_at: '2026-05-21T12:00:00Z' })
	},

	// Journey
	{
		method: 'GET',
		// exclude the {type}/leaderboard path so it falls through to the leaderboard route below
		pattern: /^\/v1\/users\/journey\/[^/]+\/(?!leaderboard)[^/]+\/?$/,
		handler: (_req, res) => json(res, 200, { count: 5, progress: 0.5 })
	},
	{
		method: 'POST',
		pattern: /^\/v1\/users\/journey\/[^/]+\/[^/]+\/?$/,
		handler: (_req, res) => json(res, 200, { incremented: true, count: 6 })
	},
	{
		method: 'DELETE',
		pattern: /^\/v1\/users\/journey\/[^/]+\/[^/]+\/delete\/?$/,
		handler: (_req, res) => json(res, 204, '')
	},
	{
		method: 'GET',
		pattern: /^\/v1\/users\/journey\/[^/]+\/leaderboard\/?$/,
		handler: (_req, res) =>
			// real cloud returns { id, streak } rows; the crust proxy fans each id out
			// to /v2/users/{id} so the ids must reference seeded mock users.
			json(res, 200, [
				{ id: 'test-user-1', streak: 12, rank: 1 },
				{ id: 'author-1', streak: 8, rank: 2 },
				{ id: 'host-1', streak: 5, rank: 3 }
			])
	},
	// Impact points leaderboard (global) - { id, points } rows
	{
		method: 'GET',
		pattern: /^\/v1\/users\/impact_points\/leaderboard\/?$/,
		handler: (_req, res) =>
			json(res, 200, [
				{ id: 'test-user-1', points: 1500 },
				{ id: 'author-1', points: 1200 },
				{ id: 'host-1', points: 900 },
				{ id: 'writer-1', points: 600 },
				{ id: 'admin-user-1', points: 300 }
			])
	},
	{
		method: 'GET',
		pattern: /^\/v1\/users\/impact_points\/[^/]+\/rank\/?$/,
		handler: (_req, res) => json(res, 200, { rank: 3 })
	},
	// Referral click ping (proxied by the crust /api/user/referral/click route)
	{
		method: 'POST',
		pattern: /^\/v1\/users\/referral\/click\/?$/,
		handler: (_req, res) => json(res, 200, { ok: true })
	},
	{
		method: 'GET',
		pattern: /^\/v1\/users\/journey\/[^/]+\/[^/]+\/rank\/?$/,
		handler: (_req, res) => json(res, 200, { rank: 3, count: 7 })
	},

	// Quests
	{
		method: 'GET',
		pattern: /^\/v1\/users\/quests\/?$/,
		handler: (_req, res) => json(res, 200, [makeQuest({ id: 'q-1' }), makeQuest({ id: 'q-2' })])
	},
	{
		method: 'GET',
		pattern: /^\/v1\/users\/quests\/current\/?$/,
		handler: (_req, res) => json(res, 200, { quest: makeQuest({ id: 'q-current' }), progress: 2 })
	},
	{
		method: 'GET',
		pattern: /^\/v1\/users\/quests\/history\/?$/,
		handler: (_req, res) => json(res, 200, [])
	},
	{
		method: 'POST',
		pattern: /^\/v1\/users\/quests\/progress\/[^/]+\/update\/?$/,
		handler: (_req, res) => json(res, 200, { updated: true })
	},

	// Badges
	{
		method: 'GET',
		pattern: /^\/v1\/users\/[^/]+\/badges\/?$/,
		handler: (_req, res) =>
			json(res, 200, [makeBadge({ id: 'b-1', granted: true }), makeBadge({ id: 'b-2' })])
	},

	// Timer
	{
		method: 'POST',
		pattern: /^\/v1\/users\/timer\/?$/,
		handler: (_req, res) => json(res, 200, { recorded: true })
	},

	// WebSocket ticket
	{
		method: 'GET',
		pattern: /^\/ws\/users\/[^/]+\/ticket\/?$/,
		handler: (_req, res) => json(res, 200, { ticket: 'mock-ticket-123' })
	}
];

// ---------------------------------------------------------------------------
// Control plane - /__mock__/*
// ---------------------------------------------------------------------------

const controlRoutes: Array<{ method: string; pattern: RegExp; handler: Handler }> = [
	{
		method: 'POST',
		pattern: /^\/__mock__\/override\/?$/,
		handler: async (_req, res, ctx) => {
			const body = ctx.body as Override;
			if (!body?.method || !body?.path)
				return json(res, 400, { message: 'method and path required' });
			state.overrides.unshift({
				...body,
				once: body.once ?? true,
				testId: body.testId ?? null,
				status: body.status ?? 200
			});
			json(res, 200, { ok: true, count: state.overrides.length });
		}
	},
	{
		method: 'POST',
		pattern: /^\/__mock__\/reset\/?$/,
		handler: async (_req, res, ctx) => {
			const testId = ctx.body?.testId as string | undefined;
			if (testId) {
				state.overrides = state.overrides.filter((o) => o.testId !== testId);
				delete state.currentUserByTestId[testId];
			} else {
				resetState();
			}
			json(res, 200, { ok: true });
		}
	},
	{
		method: 'POST',
		pattern: /^\/__mock__\/login-as\/?$/,
		handler: async (_req, res, ctx) => {
			const userId = ctx.body?.userId as string | null;
			const testId = (ctx.body?.testId as string) ?? null;
			const token = (ctx.body?.token as string | null) ?? null;
			if (!testId) return json(res, 400, { message: 'testId required' });
			if (userId === null) delete state.currentUserByTestId[testId];
			else state.currentUserByTestId[testId] = userId;
			if (token && userId) state.currentUserByToken[token] = userId;
			if (token && userId === null) delete state.currentUserByToken[token];
			json(res, 200, { ok: true, userId });
		}
	},
	{
		method: 'POST',
		pattern: /^\/__mock__\/user\/?$/,
		handler: async (_req, res, ctx) => {
			const user = ctx.body?.user;
			if (!user?.id) return json(res, 400, { message: 'user.id required' });
			state.users[user.id] = user;
			json(res, 200, { ok: true });
		}
	},
	{
		method: 'GET',
		pattern: /^\/__mock__\/health\/?$/,
		handler: (_req, res) => json(res, 200, { ok: true, overrides: state.overrides.length })
	}
];

function findOverride(req: IncomingMessage, ctx: RouteContext): Override | undefined {
	for (let i = 0; i < state.overrides.length; i++) {
		const o = state.overrides[i]!;
		if (o.method !== req.method) continue;
		if (o.testId && ctx.testId && ctx.testId !== o.testId) continue;

		const regex = new RegExp(o.path);
		if (regex.test(ctx.url.pathname)) {
			if (o.once) state.overrides.splice(i, 1);
			return o;
		}
	}
	return undefined;
}

async function dispatch(
	routes: Array<{ method: string; pattern: RegExp; handler: Handler }>,
	req: IncomingMessage,
	res: ServerResponse,
	defaultLabel: string
) {
	const reqOrigin = (req.headers.origin as string) || '*';
	(res as any)._reqOrigin = reqOrigin;

	if (req.method === 'OPTIONS') {
		res.writeHead(204, {
			'access-control-allow-origin': reqOrigin,
			'access-control-allow-credentials': 'true',
			'access-control-allow-headers': '*',
			'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
			vary: 'Origin'
		});
		return res.end();
	}

	const url = new URL(req.url ?? '/', `http://localhost`);
	const body = await readBody(req);
	const testId = (req.headers['x-test-id'] as string) ?? null;
	const ctx: RouteContext = { url, body, token: tokenFor(req), testId };

	// 1. Control plane (any host)
	for (const route of controlRoutes) {
		if (route.method === req.method && route.pattern.test(url.pathname)) {
			return route.handler(req, res, ctx);
		}
	}

	// 2. Per-test overrides
	const override = findOverride(req, ctx);
	if (override) {
		return json(res, override.status, override.body, override.headers ?? {});
	}

	// 3. Default routes
	for (const route of routes) {
		if (route.method === req.method && route.pattern.test(url.pathname)) {
			return route.handler(req, res, ctx);
		}
	}

	// 4. Fallback
	if (process.env.MOCK_VERBOSE) {
		console.warn(`[mock-${defaultLabel}] unhandled ${req.method} ${url.pathname}`);
	}
	notFound(res, `Unhandled ${req.method} ${url.pathname} on ${defaultLabel} mock`);
}

let mantleServer: http.Server | null = null;
let cloudServer: http.Server | null = null;

export async function startMockServers(): Promise<{ mantle: http.Server; cloud: http.Server }> {
	if (mantleServer && cloudServer) return { mantle: mantleServer, cloud: cloudServer };
	resetState();
	mantleServer = http.createServer((req, res) => dispatch(mantleRoutes, req, res, 'mantle2'));
	cloudServer = http.createServer((req, res) => dispatch(cloudRoutes, req, res, 'cloud'));

	await new Promise<void>((resolve, reject) => {
		mantleServer!.once('error', reject);
		mantleServer!.listen(MANTLE_PORT, '127.0.0.1', () => resolve());
	});
	await new Promise<void>((resolve, reject) => {
		cloudServer!.once('error', reject);
		cloudServer!.listen(CLOUD_PORT, '127.0.0.1', () => resolve());
	});

	if (!process.env.MOCK_QUIET) {
		console.log(`[mock] mantle2 → http://127.0.0.1:${MANTLE_PORT}`);
		console.log(`[mock] cloud   → http://127.0.0.1:${CLOUD_PORT}`);
	}

	return { mantle: mantleServer, cloud: cloudServer };
}

export async function stopMockServers(): Promise<void> {
	const closers: Promise<void>[] = [];
	if (mantleServer) {
		const s = mantleServer;
		mantleServer = null;
		closers.push(new Promise((r) => s.close(() => r())));
	}
	if (cloudServer) {
		const s = cloudServer;
		cloudServer = null;
		closers.push(new Promise((r) => s.close(() => r())));
	}
	await Promise.all(closers);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	startMockServers().then(() => {
		process.on('SIGINT', () => stopMockServers().then(() => process.exit(0)));
	});
}
