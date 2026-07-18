import { beforeEach, describe, expect, it } from 'vitest';
import {
	informationalReward,
	personalBestFraming,
	usePersonalBest
} from '~/composables/usePersonalBest';

// self-referential personal-best framing + informational reward reframe; the
// watermark is localStorage-backed for metrics the backend stores no "best" for.

function resetBest(key: string) {
	useState<number>(`personal-best-${key}`, () => 0).value = 0;
	useState<boolean>(`personal-best-hydrated-${key}`, () => false).value = false;
}

beforeEach(() => {
	window.localStorage.clear();
	resetBest('demo');
});

describe('personalBestFraming', () => {
	it('flags a fresh start at zero', () => {
		const f = personalBestFraming(0, 10);
		expect(f.label).toBe('Just Getting Started');
		expect(f.isNewBest).toBe(false);
		expect(f.chasing).toBe(false);
	});

	it('celebrates matching or beating the best', () => {
		expect(personalBestFraming(10, 10).isNewBest).toBe(true);
		const beat = personalBestFraming(12, 10);
		expect(beat.isNewBest).toBe(true);
		expect(beat.label).toBe('Your Longest Yet');
	});

	it('treats a first non-zero value with no prior best as a new baseline', () => {
		const f = personalBestFraming(5, 0);
		expect(f.isNewBest).toBe(true);
		expect(f.label).toBe('Your Longest Yet');
	});

	it('frames chasing with a delta and a "to beat" nudge', () => {
		const f = personalBestFraming(6, 10, { unit: 'min' });
		expect(f.chasing).toBe(true);
		expect(f.isNewBest).toBe(false);
		expect(f.delta).toBe(4);
		expect(f.label).toBe('Personal Best: 10 min');
		expect(f.toBeatLabel).toBe('4 min to Beat Your Best');
	});

	it('clamps and rounds junk input', () => {
		const f = personalBestFraming(-3, 8.6);
		expect(f.label).toBe('Just Getting Started'); // negative -> 0
		const g = personalBestFraming(4.4, 9.9);
		expect(g.delta).toBe(6); // round(9.9)=10 - round(4.4)=4
	});
});

describe('usePersonalBest', () => {
	it('records a new high, persists it, and reports it', () => {
		const pb = usePersonalBest('demo');
		expect(pb.record(5)).toBe(true);
		expect(pb.best.value).toBe(5);
		expect(window.localStorage.getItem('personal_best:demo')).toBe('5');
		expect(pb.record(3)).toBe(false); // not a new high
		expect(pb.best.value).toBe(5);
		expect(pb.record(9)).toBe(true);
		expect(pb.best.value).toBe(9);
	});

	it('framing reflects the stored watermark', () => {
		const pb = usePersonalBest('demo');
		pb.record(8);
		expect(pb.framing(8).isNewBest).toBe(true);
		expect(pb.framing(5).chasing).toBe(true);
		expect(pb.framing(5).toBeatLabel).toBe('3 to Beat Your Best');
	});

	it('hydrates the watermark from storage', () => {
		window.localStorage.setItem('personal_best:demo', '14');
		resetBest('demo');
		expect(usePersonalBest('demo').best.value).toBe(14);
	});

	it('treats corrupt storage as no best', () => {
		window.localStorage.setItem('personal_best:demo', 'garbage');
		resetBest('demo');
		expect(usePersonalBest('demo').best.value).toBe(0);
	});

	it('reset clears the watermark', () => {
		const pb = usePersonalBest('demo');
		pb.record(7);
		pb.reset();
		expect(pb.best.value).toBe(0);
		expect(window.localStorage.getItem('personal_best:demo')).toBe('0');
	});
});

describe('informationalReward', () => {
	it('describes a capability when something is unlocked', () => {
		expect(informationalReward({ unlocks: 'Wear the Aurora Cosmetic' })).toBe(
			'You Can Now Wear the Aurora Cosmetic'
		);
	});

	it('reframes points-only rewards away from "earn N"', () => {
		expect(informationalReward({ points: 50 })).toBe('Your Impact Grows');
	});

	it('falls back to a neutral milestone', () => {
		expect(informationalReward({})).toBe('A New Milestone');
		expect(informationalReward({ points: 0 })).toBe('A New Milestone');
	});
});
