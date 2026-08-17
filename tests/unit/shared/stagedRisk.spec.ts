import { describe, expect, it } from 'vitest';
import type { StagedActivity } from '~/shared/types/activity';
import {
	assessStagedActivity,
	isSuspiciousTier,
	STAGED_RISK_TIERS
} from '~/shared/utils/stagedRisk';

function staged(
	activity: Record<string, any>,
	overrides: Record<string, any> = {}
): StagedActivity {
	return {
		id: 1,
		activity: {
			id: 'x',
			name: '',
			description: '',
			types: [],
			aliases: [],
			fields: {},
			...activity
		},
		note: null,
		state: 'pending',
		submitter_kind: 'organizer',
		submitter: { id: 'org-1', username: 'organizer' },
		source: 'api',
		submitted_at: '2026-01-01T00:00:00.000Z',
		expires_at: '2026-01-02T00:00:00.000Z',
		expires_in_seconds: 86_400,
		fails_open: false,
		decided_at: null,
		reviewer: null,
		review_notes: null,
		published_activity_id: null,
		...overrides
	} as StagedActivity;
}

// a submission that should sail through: short real name, real prose, sensibly typed
const GOOD = {
	id: 'bouldering',
	name: 'Bouldering',
	description:
		'Climbing short, powerful routes on low walls and rock without ropes. Falls are caught by thick crash pads and a spotter, which keeps the focus on movement and problem solving.',
	types: ['HOBBY', 'SPORT'],
	aliases: ['Rock Bouldering', 'Problem Climbing'],
	fields: { icon: 'mdi:terrain' }
};

function tierOf(activity: Record<string, any>, overrides: Record<string, any> = {}) {
	return assessStagedActivity(staged(activity, overrides)).tier;
}

function signalIds(activity: Record<string, any>, overrides: Record<string, any> = {}) {
	return assessStagedActivity(staged(activity, overrides)).signals.map((signal) => signal.id);
}

describe('staged activity risk scan', () => {
	describe('decisive signals pin the verdict at suspicious', () => {
		// each of these is a thing a real catalog entry never carries, so no amount of
		// polish elsewhere may talk the tier back down
		const decisive: [string, Record<string, any>][] = [
			['profanity', { ...GOOD, description: `${GOOD.description} this shit is great` }],
			['contact', { ...GOOD, description: `${GOOD.description} email me at spam@evil.com` }],
			['contact', { ...GOOD, description: `${GOOD.description} call 555-867-5309 now` }],
			['link', { ...GOOD, description: `${GOOD.description} book at https://spam.example` }],
			['markup', { ...GOOD, description: `${GOOD.description} <b>cheap</b>` }],
			['placeholder', { ...GOOD, name: 'Test Activity' }],
			['unreal_name', { ...GOOD, name: 'Asdfgh Qwerty' }],
			['address', { ...GOOD, description: `${GOOD.description} meet at 200 Green Street` }]
		];

		it.each(decisive)('flags %s as suspicious', (id, activity) => {
			const assessment = assessStagedActivity(staged(activity));

			expect(assessment.signals.map((signal) => signal.id)).toContain(id);
			expect(assessment.tier).toBe('suspicious');
		});
	});

	it('rates a well formed submission as safe', () => {
		expect(tierOf(GOOD, { source: 'cloud_discovery' })).toBe('safe');
	});

	it('keeps a plain but real submission on the safe side without overclaiming', () => {
		const tier = tierOf({
			...GOOD,
			aliases: [],
			fields: {}
		});

		expect(['looks_safe', 'slightly_safe']).toContain(tier);
	});

	it('gives a thin, untyped submission no positive flag', () => {
		const tier = tierOf({ id: 'x', name: 'Chess', description: 'Fun.', types: [] });

		expect(isSuspiciousTier(tier)).toBe(true);
		expect(signalIds({ id: 'x', name: 'Chess', description: 'Fun.', types: [] })).toEqual(
			expect.arrayContaining(['thin_description', 'untyped'])
		);
	});

	it('leaves a middling submission unflagged', () => {
		// a real-looking name with nothing to judge it by lands in the no-flag middle
		const assessment = assessStagedActivity(
			staged({
				id: 'x',
				name: 'Kite Flying',
				description: 'Flying a kite.',
				types: ['HOBBY']
			})
		);

		expect(assessment.tier).toBe('neutral');
		expect(STAGED_RISK_TIERS[assessment.tier].flag).toBe(false);
	});

	describe('soft signals', () => {
		it('reads a place-specific name as narrow', () => {
			expect(signalIds({ ...GOOD, name: 'Bouldering at Devils Lake' })).toContain('place_specific');
		});

		it('reads a first-person name as a personal note', () => {
			expect(signalIds({ ...GOOD, name: 'My Morning Walk' })).toContain('first_person');
		});

		it('flags digits in the name', () => {
			expect(signalIds({ ...GOOD, name: 'Bouldering 2' })).toContain('digits_in_name');
		});

		it('flags a description that only repeats the name', () => {
			expect(signalIds({ ...GOOD, name: 'Bouldering', description: 'Bouldering.' })).toContain(
				'echo_description'
			);
		});

		it('flags heavy single-word repetition', () => {
			expect(
				signalIds({
					...GOOD,
					description:
						'Climbing climbing climbing climbing climbing climbing climbing on rock and on walls and more.'
				})
			).toContain('repetition');
		});

		it('flags shouting and runaway punctuation', () => {
			const ids = signalIds({
				...GOOD,
				description: 'THE BEST CLIMBING ANYWHERE!!! COME ALONG NOW!!!'
			});

			expect(ids).toContain('shouting');
			expect(ids).toContain('punctuation');
		});

		it('flags emoji in the submitted text', () => {
			expect(signalIds({ ...GOOD, name: 'Bouldering 🧗' })).toContain('emoji');
		});

		it('flags a name that mixes scripts', () => {
			expect(signalIds({ ...GOOD, name: 'Bouldering 攀岩' })).toContain('mixed_scripts');
		});

		it('flags an alias flood', () => {
			expect(
				signalIds({
					...GOOD,
					aliases: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']
				})
			).toContain('alias_flood');
		});
	});

	describe('positive signals', () => {
		it('credits an admin submitter and a submitter note', () => {
			const ids = signalIds(GOOD, {
				submitter_kind: 'admin',
				note: 'Requested by three separate organizers this month.'
			});

			expect(ids).toContain('admin_submitter');
			expect(ids).toContain('submitter_note');
		});

		it('credits a submission that cleared the discovery filters', () => {
			expect(signalIds(GOOD, { source: 'cloud_discovery' })).toContain('automated');
		});

		it('credits a clean, activity-shaped name', () => {
			const ids = signalIds(GOOD);

			expect(ids).toContain('clean_name');
			expect(ids).toContain('activity_shaped');
		});
	});

	describe('false positives that already bit', () => {
		// "strength" packs five consonants; the unreal-name rule must not eat real words
		it.each(['Strength Training', 'Rhythm Gymnastics', 'Tai Chi', 'Jiu-Jitsu', 'Kickboxing'])(
			'does not call %s unreal',
			(name) => {
				expect(signalIds({ ...GOOD, name })).not.toContain('unreal_name');
			}
		);

		it('does not read a measurement as a phone number', () => {
			expect(
				signalIds({
					...GOOD,
					description: 'Routes run 1500 2000 3000 moves long across the whole wall face here.'
				})
			).not.toContain('contact');
		});
	});

	it('splits the signals into risks and positives', () => {
		const assessment = assessStagedActivity(staged({ ...GOOD, name: 'My Bouldering' }));

		expect(assessment.risks.every((signal) => signal.weight < 0)).toBe(true);
		expect(assessment.positives.every((signal) => signal.weight > 0)).toBe(true);
		expect(assessment.signals).toHaveLength(assessment.risks.length + assessment.positives.length);
	});

	it('survives a submission with missing fields', () => {
		const assessment = assessStagedActivity({ id: 3 } as unknown as StagedActivity);

		expect(assessment.tier).toBe('suspicious');
		expect(assessment.signals.map((signal) => signal.id)).toContain('unreal_name');
	});

	it('marks every suspicious tier and no safe tier as suspicious', () => {
		expect(
			(['suspicious', 'looks_suspicious', 'slightly_suspicious'] as const).every(isSuspiciousTier)
		).toBe(true);
		expect(
			(['neutral', 'slightly_safe', 'looks_safe', 'safe'] as const).some(isSuspiciousTier)
		).toBe(false);
	});
});
