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

	it('rates a well formed human submission as safe', () => {
		expect(tierOf(GOOD)).toBe('safe');
	});

	// form is free for a generator, so an automated row cannot reach a tier that skips the
	// approve confirmation on form alone, however clean it looks
	it('holds an equally well formed automated submission below the safe tiers', () => {
		expect(tierOf(GOOD, { source: 'cloud_discovery' })).toBe('slightly_safe');
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

		// coming from the pipeline used to be worth +1, which fired on 629 of 629 live rows and so
		// carried no information; where a row came from is not evidence it is any good
		it('does not credit a submission for having come from discovery', () => {
			expect(signalIds(GOOD, { source: 'cloud_discovery' })).not.toContain('automated');
		});

		// each of these fired on 632 of 632 live automated rows, stacking a flat +5.5 onto every
		// one of them; a signal that is always true is a constant
		it('withholds the form positives from machine-written text', () => {
			const ids = signalIds(GOOD, { source: 'cloud_discovery' });
			expect(ids).not.toContain('clean_name');
			expect(ids).not.toContain('rich_description');
			expect(ids).not.toContain('prose');

			// what remains is about the entry's substance, not how well it was typed
			expect(ids).toContain('typed');
			expect(ids).toContain('activity_shaped');
		});

		it('still credits a human for the same form', () => {
			const ids = signalIds(GOOD);
			expect(ids).toContain('clean_name');
			expect(ids).toContain('rich_description');
			expect(ids).toContain('prose');
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

	// a live queue of 629 automated rows scored 0 suspicious and 99.7% safe, because every
	// detector was hunting a careless human and the queue contained none. these are the rows.
	describe('the generated-queue blind spot', () => {
		const generated = (name: string, extra: Record<string, any> = {}) => ({
			...GOOD,
			id: name.toLowerCase().replace(/\s+/g, '_'),
			name,
			...extra
		});

		it.each([
			'Play Calling System',
			'Single Wing Formation',
			'Penalty Shot',
			'Match Penalty',
			'Zone Defense'
		])('flags %s as naming a rule rather than a practice', (name) => {
			expect(signalIds(generated(name))).toContain('not_a_practice');
		});

		it.each(['Paralympic Football', 'Olympic Nordic Skiing', 'Collegiate Wrestling'])(
			'flags %s as a competition class',
			(name) => {
				expect(signalIds(generated(name))).toContain('not_a_practice');
			}
		);

		it('does not flag a real activity whose name merely contains one of those words', () => {
			for (const name of ['Bouldering', 'Shot Put', 'Playing Cards', 'Free Diving']) {
				expect(signalIds(generated(name))).not.toContain('not_a_practice');
			}
		});

		it('pins adult, gambling and blood-sport entries at suspicious', () => {
			for (const name of ['Peep Show', 'Erotic Dance', 'Sports Betting', 'Cockfighting']) {
				const assessment = assessStagedActivity(staged(generated(name)));
				expect(assessment.tier).toBe('suspicious');
				expect(assessment.signals.map((s) => s.id)).toContain('unsuitable');
			}
		});

		// the old window was 60-1200 chars; live descriptions run 1188-1614, so the strongest
		// positive in the scan fired 6 times out of 629
		it('credits substance in a description longer than the old 1200-char cap', () => {
			const long = 'A real sentence about the practice and how it is done. '.repeat(25);
			expect(long.length).toBeGreaterThan(1200);
			expect(signalIds({ ...GOOD, description: long })).toContain('rich_description');
		});

		it('flags a description that runs past any plausible catalog entry', () => {
			const bloated = 'A real sentence about the practice and how it is done. '.repeat(50);
			expect(signalIds({ ...GOOD, description: bloated })).toContain('bloated_description');
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
