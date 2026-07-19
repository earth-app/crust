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
	makeExpedition,
	makeGarden,
	makeMoodSnapshot,
	makeNatureMinutes,
	makeNotification,
	makePollVote,
	makePrompt,
	makePromptResponse,
	makeQuest,
	makeReferralStats,
	makeReportListItem,
	makeTrail,
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
	// v0.6.0 cross-user feature state. keyed by per-test-unique uids/tokens so parallel
	// tests don't collide; trailmarks are geo-queried so specs use a unique location per test.
	trails: Record<string, any>; // shared read-only catalog by id
	trailmarks: TrailmarkRecord[];
	natureMinutes: Record<string, any>; // uid -> NatureMinutes
	trailJournal: Record<string, any[]>; // uid -> completed trail journal entries (newest first)
	trailRuns: Record<string, any>; // `${uid}:${trailId}` -> active run
	circleOwnerOf: Record<string, string>; // memberUid -> circle owner uid
	expeditionByOwner: Record<string, any>; // ownerUid -> Expedition
	gardenByOwner: Record<string, any>; // ownerUid -> CircleGarden
	notifications: Record<string, any[]>; // uid -> notifications (newest first)
	kudos: { from: string; to: string; key: string; phrase: string }[];
}

interface TrailmarkRecord {
	id: string;
	author_uid: string;
	author_username: string;
	geo: { lat: number; lng: number; place_label?: string };
	note: string;
	created_at: string;
	thanks: string[]; // uids who have thanked (private to the author)
	prompt_id?: string; // set when left as an answer to a daily prompt
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

	const trailDefs = [
		makeTrail({ id: 'trail-1', title: 'Neighborhood Wonders', theme: 'nature' }),
		makeTrail({ id: 'trail-2', title: 'Hidden Histories', theme: 'curiosity' }),
		makeTrail({ id: 'trail-3', title: 'Sketch the Skyline', theme: 'creative' }),
		makeTrail({ id: 'trail-4', title: 'Sunset Circuit', theme: 'mixed', rarity: 'amazing' }),
		makeTrail({ id: 'trail-5', title: 'Rare River Path', theme: 'nature', rarity: 'green' }),
		makeTrail({ id: 'trail-6', title: 'Premium Peaks', theme: 'nature', premium: true })
	];

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
		],
		trails: Object.fromEntries(trailDefs.map((t) => [t.id, t])),
		trailmarks: [],
		natureMinutes: {},
		trailJournal: {},
		trailRuns: {},
		circleOwnerOf: {},
		expeditionByOwner: {},
		gardenByOwner: {},
		notifications: {},
		kudos: []
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

// great-circle distance in meters; deterministic (same as the crust composable)
function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
	const R = 6371000;
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const lat1 = toRad(a.lat);
	const lat2 = toRad(b.lat);
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
	return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}

function pushNotification(uid: string, notif: any) {
	(state.notifications[uid] ??= []).unshift(notif);
}

// the private thanks tally is only ever returned to the author (never a public number)
function serializeTrailmark(m: TrailmarkRecord, viewer: string | null) {
	const out: any = {
		id: m.id,
		author_uid: m.author_uid,
		author_username: m.author_username,
		geo: m.geo,
		note: m.note,
		created_at: m.created_at,
		thanked_by_me: !!viewer && m.thanks.includes(viewer),
		...(m.prompt_id ? { prompt_id: m.prompt_id } : {})
	};
	if (viewer && viewer === m.author_uid) out.thanks_for_author = m.thanks.length;
	return out;
}

// grow the shared garden from combined outdoor minutes (deterministic level + element count)
function growGarden(owner: string, minutes: number) {
	const g =
		state.gardenByOwner[owner] ??
		makeGarden({ owner_uid: owner, level: 1, total_minutes: 0, elementCount: 0 });
	g.total_minutes += minutes;
	g.level = Math.max(1, Math.min(12, Math.floor(g.total_minutes / 120) + 1));
	const kinds = ['tree', 'flower', 'water', 'stone', 'creature', 'star'];
	const targetCount = Math.min(80, Math.floor(g.total_minutes / 15));
	while (g.elements.length < targetCount) {
		g.elements.push({
			kind: kinds[g.elements.length % kinds.length],
			seed: 2000 + g.elements.length,
			growth: 0.6
		});
	}
	g.updated_at = new Date().toISOString();
	state.gardenByOwner[owner] = g;
}

// outdoor time credits the member's circle expedition (nature_minutes goal) and shared garden
function creditExpeditionAndGarden(uid: string, minutes: number) {
	if (minutes <= 0) return;
	const owner = state.circleOwnerOf[uid];
	if (!owner) return;
	const exp = state.expeditionByOwner[owner];
	if (exp && exp.goal === 'nature_minutes' && exp.status === 'active') {
		let c = exp.contributors.find((x: any) => x.uid === uid);
		if (!c) {
			c = { uid, username: state.users[uid]?.username ?? uid, contribution: 0 };
			exp.contributors.push(c);
		}
		c.contribution += minutes;
		c.last_contributed_at = new Date().toISOString();
		exp.progress = exp.contributors.reduce((s: number, x: any) => s + x.contribution, 0);
	}
	growGarden(owner, minutes);
}

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
	{
		method: 'GET',
		pattern: /^\/v2\/users\/trails\/?$/,
		handler: (_req, res, ctx) => {
			const theme = ctx.url.searchParams.get('theme');
			const premium = ctx.url.searchParams.get('premium') === 'true';
			let items = Object.values(state.trails);
			if (theme) items = items.filter((t: any) => t.theme === theme);
			if (premium) items = items.filter((t: any) => t.premium === true);
			json(res, 200, { items });
		}
	},
	{
		method: 'GET',
		pattern: /^\/v2\/users\/trails\/([^/?]+)\/?$/,
		handler: (_req, res, ctx) => {
			const id = decodeURIComponent(ctx.url.pathname.split('/').pop()!);
			const trail = state.trails[id];
			if (!trail) return notFound(res, 'Trail not found');
			json(res, 200, trail);
		}
	},
	{
		method: 'GET',
		pattern: /^\/v2\/users\/([^/]+)\/nature-minutes\/?$/,
		handler: (_req, res, ctx) => {
			const uid = decodeURIComponent(ctx.url.pathname.split('/')[3]!);
			json(res, 200, state.natureMinutes[uid] ?? makeNatureMinutes({ minutes: 0, best: 0 }));
		}
	},
	{
		method: 'POST',
		pattern: /^\/v2\/users\/([^/]+)\/nature-minutes\/?$/,
		handler: (_req, res, ctx) => {
			const uid = decodeURIComponent(ctx.url.pathname.split('/')[3]!);
			const source = ctx.body?.source ?? {};
			const add = Math.max(0, Number(source.minutes) || 0);
			const cur =
				state.natureMinutes[uid] ?? makeNatureMinutes({ minutes: 0, best: 0, sources: [] });
			const minutes = (cur.minutes || 0) + add;
			const updated = {
				...cur,
				minutes,
				best: Math.max(cur.best || 0, minutes),
				sources: [...(cur.sources ?? []), source],
				updated_at: new Date().toISOString()
			};
			state.natureMinutes[uid] = updated;
			creditExpeditionAndGarden(uid, add);
			json(res, 200, updated);
		}
	},
	{
		method: 'POST',
		pattern: /^\/v2\/users\/current\/trails\/([^/]+)\/start\/?$/,
		handler: (_req, res, ctx) => {
			const uid = currentUserId(ctx);
			if (!uid) return unauthorized(res);
			const trailId = decodeURIComponent(ctx.url.pathname.split('/')[5]!);
			const run = {
				trailId,
				pledge: ctx.body?.pledge ?? undefined,
				startedAt: new Date().toISOString(),
				presenceMinutes: 0,
				completed: false
			};
			state.trailRuns[`${uid}:${trailId}`] = run;
			json(res, 201, run);
		}
	},
	{
		method: 'POST',
		pattern: /^\/v2\/users\/current\/trails\/([^/]+)\/complete\/?$/,
		handler: (_req, res, ctx) => {
			const uid = currentUserId(ctx);
			if (!uid) return unauthorized(res);
			const trailId = decodeURIComponent(ctx.url.pathname.split('/')[5]!);
			const minutes = Math.max(0, Math.min(180, Number(ctx.body?.presenceMinutes) || 0));
			const reflection = ctx.body?.reflection ?? { at: new Date().toISOString() };
			const trail = state.trails[trailId];
			const cur =
				state.natureMinutes[uid] ?? makeNatureMinutes({ minutes: 0, best: 0, sources: [] });
			const total = (cur.minutes || 0) + minutes;
			const natureMinutes = {
				...cur,
				minutes: total,
				best: Math.max(cur.best || 0, total),
				sources: [
					...(cur.sources ?? []),
					{ kind: 'trail', ref_id: trailId, minutes, at: reflection.at }
				],
				updated_at: new Date().toISOString()
			};
			state.natureMinutes[uid] = natureMinutes;
			creditExpeditionAndGarden(uid, minutes);
			const entry = {
				trailId,
				title: trail?.title ?? 'Trail',
				practice: trail?.practice ?? 'sit_spot',
				presenceMinutes: minutes,
				reflection,
				completedAt: new Date().toISOString()
			};
			(state.trailJournal[uid] ??= []).unshift(entry);
			const run = {
				...(state.trailRuns[`${uid}:${trailId}`] ?? { trailId, startedAt: entry.completedAt }),
				presenceMinutes: minutes,
				completed: true
			};
			state.trailRuns[`${uid}:${trailId}`] = run;
			json(res, 200, { run, entry, natureMinutes });
		}
	},
	{
		method: 'GET',
		pattern: /^\/v2\/users\/current\/trail-journal\/?$/,
		handler: (_req, res, ctx) => {
			const uid = currentUserId(ctx);
			if (!uid) return unauthorized(res);
			json(res, 200, { items: state.trailJournal[uid] ?? [] });
		}
	},
	{
		method: 'GET',
		pattern: /^\/v2\/users\/current\/expedition\/?$/,
		handler: (_req, res, ctx) => {
			const uid = currentUserId(ctx);
			if (!uid) return unauthorized(res);
			const owner = state.circleOwnerOf[uid] ?? uid;
			const exp = state.expeditionByOwner[owner];
			if (!exp) return json(res, 204, '');
			json(res, 200, exp);
		}
	},
	{
		method: 'POST',
		pattern: /^\/v2\/users\/current\/expedition\/?$/,
		handler: (_req, res, ctx) => {
			const uid = currentUserId(ctx);
			if (!uid) return unauthorized(res);
			const body = ctx.body ?? {};
			const owner = state.circleOwnerOf[uid] ?? uid;
			const memberUids = Object.keys(state.circleOwnerOf).filter(
				(m) => state.circleOwnerOf[m] === owner
			);
			const members = memberUids.length ? memberUids : [uid];
			const contributors = members.map((m) => ({
				uid: m,
				username: state.users[m]?.username ?? m,
				contribution: 0
			}));
			const exp = makeExpedition({
				id: `exp-${owner}`,
				owner_uid: owner,
				title: body.title ?? 'Expedition',
				goal: body.goal ?? 'nature_minutes',
				target: Math.max(1, Math.round(Number(body.target)) || 600),
				contributors,
				progress: 0,
				days: body.days ? Math.max(1, Math.round(body.days)) : 7
			});
			state.expeditionByOwner[owner] = exp;
			json(res, 201, exp);
		}
	},
	{
		method: 'GET',
		pattern: /^\/v2\/users\/([^/]+)\/garden\/?$/,
		handler: (_req, res, ctx) => {
			const owner = decodeURIComponent(ctx.url.pathname.split('/')[3]!);
			const key = state.circleOwnerOf[owner] ?? owner;
			const g = state.gardenByOwner[key];
			if (!g) return json(res, 204, '');
			json(res, 200, g);
		}
	},
	{
		method: 'POST',
		pattern: /^\/v2\/users\/([^/]+)\/kudos\/?$/,
		handler: (_req, res, ctx) => {
			const giver = currentUserId(ctx);
			if (!giver) return unauthorized(res);
			const toUid = decodeURIComponent(ctx.url.pathname.split('/')[3]!);
			const body = ctx.body ?? {};
			const key = `${body.context_type}:${body.context_ref ?? ''}:${giver}:${toUid}`;
			if (state.kudos.some((k) => k.key === key)) {
				return json(res, 409, { message: 'Already sent' });
			}
			state.kudos.push({ from: giver, to: toUid, key, phrase: body.phrase });
			const giverName = state.users[giver]?.username ?? 'someone';
			pushNotification(
				toUid,
				makeNotification({
					id: `kudos-${state.kudos.length}`,
					user_id: toUid,
					title: 'A Cheer From Your Circle',
					message: `@${giverName} cheered you on. A little encouragement goes a long way.`,
					type: 'success',
					source: 'kudos'
				})
			);
			json(res, 200, { success: true, alreadySent: false });
		}
	},

	// --- v0.6.0: notifications feed (kudos + trailmark thanks land here) ---
	{
		method: 'GET',
		pattern: /^\/v2\/users\/current\/notifications\/?$/,
		handler: (_req, res, ctx) => {
			const uid = currentUserId(ctx);
			if (!uid) return unauthorized(res);
			const items = state.notifications[uid] ?? [];
			json(res, 200, {
				unread_count: items.filter((n: any) => !n.read).length,
				has_warnings: false,
				has_errors: false,
				items
			});
		}
	},
	{
		method: 'POST',
		pattern: /^\/v2\/users\/current\/notifications\/.+/,
		handler: (_req, res, ctx) => {
			if (!currentUserId(ctx)) return unauthorized(res);
			json(res, 204, '');
		}
	},
	{
		method: 'GET',
		pattern: /^\/v2\/trailmarks\/?$/,
		handler: (_req, res, ctx) => {
			const viewer = currentUserId(ctx);
			const lat = Number(ctx.url.searchParams.get('lat'));
			const lng = Number(ctx.url.searchParams.get('lng'));
			const radius = Math.min(Number(ctx.url.searchParams.get('radius')) || 500, 2000);
			const items = state.trailmarks
				.filter((m) => Number.isFinite(lat) && haversineMeters({ lat, lng }, m.geo) <= radius)
				.map((m) => serializeTrailmark(m, viewer));
			json(res, 200, { items });
		}
	},
	{
		method: 'POST',
		pattern: /^\/v2\/trailmarks\/?$/,
		handler: (_req, res, ctx) => {
			const uid = currentUserId(ctx);
			if (!uid) return unauthorized(res);
			const body = ctx.body ?? {};
			if (!body?.note || !body?.geo) return json(res, 400, { message: 'note and geo required' });
			// mock of the cloud sentiment gate: negative notes are gently rejected
			if (/\b(hate|awful|terrible|worst|stupid)\b/i.test(String(body.note))) {
				return json(res, 400, {
					message: "Let's keep trailmarks kind and encouraging - try rephrasing."
				});
			}
			const rec: TrailmarkRecord = {
				id: `tm-${uid}-${state.trailmarks.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
				author_uid: uid,
				author_username: state.users[uid]?.username ?? uid,
				geo: body.geo,
				note: String(body.note).slice(0, 240),
				created_at: new Date().toISOString(),
				thanks: [],
				...(body.prompt_id ? { prompt_id: String(body.prompt_id) } : {})
			};
			state.trailmarks.push(rec);
			// author's own fresh note omits the private tally so the card reads "Your Note"
			json(res, 201, {
				id: rec.id,
				author_uid: rec.author_uid,
				author_username: rec.author_username,
				geo: rec.geo,
				note: rec.note,
				created_at: rec.created_at,
				...(rec.prompt_id ? { prompt_id: rec.prompt_id } : {})
			});
		}
	},
	{
		method: 'POST',
		pattern: /^\/v2\/trailmarks\/([^/]+)\/thank\/?$/,
		handler: (_req, res, ctx) => {
			const uid = currentUserId(ctx);
			if (!uid) return unauthorized(res);
			const id = decodeURIComponent(ctx.url.pathname.split('/')[3]!);
			const rec = state.trailmarks.find((m) => m.id === id);
			if (!rec) return notFound(res, 'Trailmark not found');
			if (rec.author_uid === uid) return json(res, 409, { message: 'Cannot thank your own note' });
			if (rec.thanks.includes(uid)) return json(res, 409, { message: 'Already thanked' });
			rec.thanks.push(uid);
			pushNotification(
				rec.author_uid,
				makeNotification({
					id: `thanks-${rec.id}-${rec.thanks.length}`,
					user_id: rec.author_uid,
					title: 'Someone Thanked Your Trailmark',
					message: 'A passer-by appreciated the note you left. Your words reached them.',
					type: 'success',
					source: 'trailmark'
				})
			);
			json(res, 200, { success: true });
		}
	},
	// the current user's circle members (other people), paginated {items,total}. drives the
	// Members list + the expedition empty-circle guard. registered before the greedy user route
	{
		method: 'GET',
		pattern: /^\/v2\/users\/([^/]+)\/circle\/?$/,
		handler: (_req, res, ctx) => {
			const asked = decodeURIComponent(ctx.url.pathname.split('/')[3]!);
			const self = asked === 'current' ? currentUserId(ctx) : asked;
			if (!self) return unauthorized(res);
			const owner = state.circleOwnerOf[self] ?? self;
			const items = Object.keys(state.circleOwnerOf)
				.filter((m) => state.circleOwnerOf[m] === owner && m !== self)
				.map((uid) => state.users[uid])
				.filter(Boolean);
			json(res, 200, { items, total: items.length });
		}
	},
	// trailmarks left as answers to a given prompt (the 'from outside' section)
	{
		method: 'GET',
		pattern: /^\/v2\/prompts\/([^/]+)\/trailmarks\/?$/,
		handler: (_req, res, ctx) => {
			const viewer = currentUserId(ctx);
			const promptId = decodeURIComponent(ctx.url.pathname.split('/')[3]!);
			const items = state.trailmarks
				.filter((m) => m.prompt_id === promptId)
				.map((m) => serializeTrailmark(m, viewer));
			json(res, 200, { items });
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
		method: 'POST',
		pattern: /^\/__mock__\/circle\/?$/,
		handler: async (_req, res, ctx) => {
			const owner = ctx.body?.ownerUid as string;
			const members = (ctx.body?.members as string[]) ?? [];
			if (!owner) return json(res, 400, { message: 'ownerUid required' });
			for (const m of members) state.circleOwnerOf[m] = owner;
			json(res, 200, { ok: true });
		}
	},
	{
		method: 'POST',
		pattern: /^\/__mock__\/expedition\/?$/,
		handler: async (_req, res, ctx) => {
			const exp = ctx.body?.expedition;
			if (!exp?.owner_uid) return json(res, 400, { message: 'expedition.owner_uid required' });
			state.expeditionByOwner[exp.owner_uid] = exp;
			json(res, 200, { ok: true });
		}
	},
	{
		method: 'POST',
		pattern: /^\/__mock__\/garden\/?$/,
		handler: async (_req, res, ctx) => {
			const garden = ctx.body?.garden;
			if (!garden?.owner_uid) return json(res, 400, { message: 'garden.owner_uid required' });
			state.gardenByOwner[garden.owner_uid] = garden;
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
