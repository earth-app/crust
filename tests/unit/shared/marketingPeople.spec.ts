import { describe, expect, it } from 'vitest';
import type { User } from '~/shared/types/user';
import {
	emptyMotdForm,
	emptyNotificationForm,
	emptyUserForm,
	makeMockBadges,
	makeMockNotification,
	makeMockUser,
	MOCK_ACCOUNT_TYPES,
	MOTD_PRESETS,
	normalizeMotdForm,
	normalizeUsername,
	NOTIFICATION_PRESETS,
	NOTIFICATION_TYPES,
	notificationToastOptions,
	parseList,
	PERSONA_PRESETS,
	personaToForm,
	pickPersona,
	slugify,
	userToForm
} from '~/shared/utils/marketingPeople';

describe('marketingPeople helpers', () => {
	describe('slugify', () => {
		it('lowercases and dashes non-alphanumerics', () => {
			expect(slugify('Maya Rivera')).toBe('maya-rivera');
			expect(slugify('Trail Running!')).toBe('trail-running');
		});

		it('collapses runs and trims edge dashes', () => {
			expect(slugify('  --Hello__World--  ')).toBe('hello-world');
		});

		it('falls back to "item" for empty or symbol-only input', () => {
			expect(slugify('')).toBe('item');
			expect(slugify('***')).toBe('item');
		});
	});

	describe('normalizeUsername', () => {
		it('strips a leading @ and interior whitespace', () => {
			expect(normalizeUsername('@maya wanders')).toBe('mayawanders');
			expect(normalizeUsername('  theo grows ')).toBe('theogrows');
		});

		it('strips multiple leading @', () => {
			expect(normalizeUsername('@@sofia')).toBe('sofia');
		});
	});

	describe('parseList', () => {
		it('splits, trims, and drops empties', () => {
			expect(parseList('Hiking, Yoga ,, Reading')).toEqual(['Hiking', 'Yoga', 'Reading']);
		});

		it('returns an empty array for empty input', () => {
			expect(parseList('')).toEqual([]);
		});
	});
});

describe('user factories', () => {
	it('emptyUserForm has safe defaults', () => {
		const f = emptyUserForm();
		expect(f.account_type).toBe('FREE');
		expect(f.activities).toEqual([]);
		expect(f.badges).toEqual([]);
		expect(f.is_mutual).toBe(false);
		expect(f.mutual_count).toBe(0);
	});

	describe('personaToForm', () => {
		it('adds an empty avatar_url and deep-clones collections', () => {
			const persona = PERSONA_PRESETS[0]!;
			const form = personaToForm(persona);
			expect(form.avatar_url).toBe('');
			expect(form.full_name).toBe(persona.full_name);

			form.activities.push({ name: 'Injected' });
			form.badges[0]!.name = 'Mutated';
			// mutating the form must not leak back into the preset
			expect(persona.activities).toHaveLength(3);
			expect(persona.badges[0]!.name).not.toBe('Mutated');
		});
	});

	describe('pickPersona', () => {
		it('is deterministic for a seed and wraps modulo', () => {
			const n = PERSONA_PRESETS.length;
			expect(pickPersona(0)).toBe(PERSONA_PRESETS[0]);
			expect(pickPersona(n)).toBe(PERSONA_PRESETS[0]);
			expect(pickPersona(1)).toBe(PERSONA_PRESETS[1]);
		});

		it('handles negative seeds without returning undefined', () => {
			expect(pickPersona(-1)).toBe(PERSONA_PRESETS[PERSONA_PRESETS.length - 1]);
		});

		it('returns a valid persona with no seed', () => {
			expect(PERSONA_PRESETS).toContain(pickPersona());
		});
	});

	describe('userToForm', () => {
		const baseUser = (over: Partial<User> = {}): User =>
			({
				id: 'real-123',
				username: 'realuser',
				full_name: 'Real User',
				is_mutual: true,
				is_in_circle: false,
				mutual_count: 9,
				activities: [{ id: 'a1', name: 'Hiking', fields: { icon: 'mdi:hiking' } }],
				account: { account_type: 'PRO', avatar_url: 'https://cdn.example/a.png', bio: 'hi' },
				...over
			}) as unknown as User;

		it('maps public fields into the form', () => {
			const form = userToForm(baseUser());
			expect(form.username).toBe('realuser');
			expect(form.account_type).toBe('PRO');
			expect(form.avatar_url).toBe('https://cdn.example/a.png');
			expect(form.activities).toEqual([{ name: 'Hiking', icon: 'mdi:hiking' }]);
			expect(form.is_mutual).toBe(true);
			expect(form.mutual_count).toBe(9);
			expect(form.badges).toEqual([]);
		});

		it('drops a non-http avatar (partial-serialization guard)', () => {
			const form = userToForm(baseUser({ account: { avatar_url: [] } as any }));
			expect(form.avatar_url).toBe('');
		});

		it('falls back the activity icon and coerces a missing mutual_count', () => {
			const form = userToForm(
				baseUser({
					activities: [{ id: 'a', name: 'Yoga', fields: {} } as any],
					mutual_count: undefined as any
				})
			);
			expect(form.activities[0]).toEqual({ name: 'Yoga', icon: 'mdi:earth' });
			expect(form.mutual_count).toBe(0);
		});
	});

	describe('makeMockUser', () => {
		it('builds a complete, mock-prefixed user that cannot collide with a real id', () => {
			const user = makeMockUser({
				...emptyUserForm(),
				full_name: 'Maya Rivera',
				username: '@mayawanders',
				account_type: 'PRO',
				mutual_count: 42,
				is_mutual: true,
				is_in_circle: true
			});
			expect(user.id).toBe('mock-user-mayawanders');
			expect(user.id.startsWith('mock-user-')).toBe(true);
			expect(user.username).toBe('mayawanders');
			expect(user.is_mutual).toBe(true);
			expect(user.is_in_my_circle).toBe(true);
			expect(user.account.account_type).toBe('PRO');
			expect(user.account.subscribed).toBe(true);
			expect(user.mutual_count).toBe(42);
			expect(user.account.field_privacy.badges).toBe('PUBLIC');
		});

		it('applies fallbacks for empty name/username and floors mutual_count', () => {
			const user = makeMockUser({ ...emptyUserForm(), mutual_count: 3.9 });
			expect(user.username).toBe('earthling');
			expect(user.full_name).toBe('Earth Explorer');
			expect(user.mutual_count).toBe(3);
			expect(user.account.subscribed).toBe(false);
		});

		it('maps activities into the icon field and filters blank names', () => {
			const user = makeMockUser({
				...emptyUserForm(),
				activities: [
					{ name: 'Hiking', icon: 'mdi:hiking' },
					{ name: '   ', icon: 'mdi:x' }
				]
			});
			expect(user.activities).toHaveLength(1);
			expect(user.activities![0]!.name).toBe('Hiking');
			expect(user.activities![0]!.fields['icon']).toBe('mdi:hiking');
		});

		it('every account type produces a renderable user', () => {
			for (const t of MOCK_ACCOUNT_TYPES) {
				const user = makeMockUser({ ...emptyUserForm(), username: 'x', account_type: t });
				expect(user.account.account_type).toBe(t);
			}
		});
	});

	describe('makeMockBadges', () => {
		it('fills id, description, icon, and rarity defaults', () => {
			const [badge] = makeMockBadges([{ name: 'Trailblazer' }]);
			expect(badge!.id).toBe('mock-badge-trailblazer');
			expect(badge!.rarity).toBe('normal');
			expect(badge!.icon).toBe('mdi:medal-outline');
			expect(badge!.description).toContain('Trailblazer');
		});

		it('honors explicit rarity/icon and drops blank names', () => {
			const badges = makeMockBadges([
				{ name: 'Explorer', rarity: 'amazing', icon: 'mdi:compass' },
				{ name: '  ' }
			]);
			expect(badges).toHaveLength(1);
			expect(badges[0]!.rarity).toBe('amazing');
			expect(badges[0]!.icon).toBe('mdi:compass');
		});
	});
});

describe('notification factories', () => {
	it('emptyNotificationForm has unread info defaults', () => {
		const f = emptyNotificationForm();
		expect(f.type).toBe('info');
		expect(f.read).toBe(false);
		expect(f.source).toBe('system');
	});

	describe('makeMockNotification', () => {
		it('builds a full notification with second-precision timestamp', () => {
			const before = Math.floor(Date.now() / 1000);
			const n = makeMockNotification(
				{
					title: 'Quest Complete',
					message: 'Nice',
					type: 'success',
					source: 'quest',
					link: '',
					read: false
				},
				2
			);
			expect(n.id).toBe('mock-notif-2-quest-complete');
			expect(n.title).toBe('Quest Complete');
			expect(n.type).toBe('success');
			expect(n.read).toBe(false);
			expect(n.created_at).toBeGreaterThanOrEqual(before);
			expect('link' in n).toBe(false);
		});

		it('coerces an invalid type to info and defaults empty fields', () => {
			const n = makeMockNotification(
				{ title: '', message: '', type: 'bogus' as any, source: '', link: '  ', read: true },
				0
			);
			expect(n.type).toBe('info');
			expect(n.title).toBe('Notification');
			expect(n.source).toBe('system');
			expect(n.read).toBe(true);
			expect('link' in n).toBe(false);
		});

		it('keeps a non-empty link', () => {
			const n = makeMockNotification(
				{
					title: 'x',
					message: 'y',
					type: 'info',
					source: 'system',
					link: 'https://e.com',
					read: false
				},
				1
			);
			expect(n.link).toBe('https://e.com');
		});
	});

	describe('notificationToastOptions', () => {
		it('maps each type to a color and icon', () => {
			expect(
				notificationToastOptions({ title: 't', message: 'm', type: 'error', source: 'system' })
			).toMatchObject({
				color: 'error',
				icon: 'mdi:alert-circle'
			});
			expect(
				notificationToastOptions({ title: 't', message: 'm', type: 'warning', source: 'system' })
					.icon
			).toBe('mdi:alert');
			expect(
				notificationToastOptions({ title: 't', message: 'm', type: 'success', source: 'system' })
					.icon
			).toBe('mdi:check-circle');
			expect(
				notificationToastOptions({ title: 't', message: 'm', type: 'info', source: 'system' }).icon
			).toBe('mdi:information');
		});

		it('falls back title/description and coerces an invalid type', () => {
			const opts = notificationToastOptions({
				title: '',
				message: '',
				type: 'nope' as any,
				source: 'x'
			});
			expect(opts.title).toBe('Notification');
			expect(opts.description).toBe('');
			expect(opts.color).toBe('info');
		});
	});
});

describe('motd normalization', () => {
	it('emptyMotdForm defaults to info', () => {
		expect(emptyMotdForm()).toEqual({ motd: '', icon: '', type: 'info', link: '' });
	});

	it('trims fields and coerces an invalid type', () => {
		const out = normalizeMotdForm({
			motd: '  Hi  ',
			icon: ' mdi:earth ',
			type: 'x' as any,
			link: '  '
		});
		expect(out).toEqual({ motd: 'Hi', icon: 'mdi:earth', type: 'info', link: '' });
	});

	it('preserves a valid type and non-empty link', () => {
		const out = normalizeMotdForm({
			motd: 'Hey',
			icon: '',
			type: 'warning',
			link: 'https://e.com'
		});
		expect(out.type).toBe('warning');
		expect(out.link).toBe('https://e.com');
	});
});

describe('presets', () => {
	it('exposes six unique on-brand personas', () => {
		expect(PERSONA_PRESETS).toHaveLength(6);
		const handles = PERSONA_PRESETS.map((p) => p.username);
		expect(new Set(handles).size).toBe(6);
		for (const p of PERSONA_PRESETS) {
			expect(p.full_name.length).toBeGreaterThan(0);
			expect(p.activities.length).toBeGreaterThan(0);
			expect(p.badges.length).toBeGreaterThan(0);
			expect(MOCK_ACCOUNT_TYPES).toContain(p.account_type);
		}
	});

	it('notification presets cover every type and include a badge-unlock the ribbon can parse', () => {
		const types = new Set(NOTIFICATION_PRESETS.map((n) => n.type));
		for (const t of NOTIFICATION_TYPES) {
			// info/success/warning/error all appear at least once across the presets
			if (t !== 'error') expect(types.has(t)).toBe(true);
		}
		const badge = NOTIFICATION_PRESETS.find((n) => n.source === 'badge');
		expect(badge).toBeTruthy();
		// mirrors useUser's BADGE_UNLOCK_TITLE_PATTERN + single-name pattern
		expect(/new badges? unlocked/i.test(badge!.title)).toBe(true);
		expect(/unlocked the ["“]([^"”]+)["”] badge/i.test(badge!.message)).toBe(true);
	});

	it('motd presets are non-empty and valid', () => {
		expect(MOTD_PRESETS.length).toBeGreaterThan(0);
		for (const m of MOTD_PRESETS) {
			expect(m.motd.length).toBeGreaterThan(0);
			expect(['info', 'success', 'warning', 'error']).toContain(m.type);
		}
	});
});
