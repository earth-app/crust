import { describe, expect, it } from 'vitest';
import { curiosityGap, useCuriosityGap } from '~/composables/useCuriosityGap';

// pure curiosity-gap descriptor: "how close you are to an answer". no storage, no
// network; edges (clamping, pluralization, one-away pull) are only covered here.

describe('curiosityGap', () => {
	it('returns an empty teaser when there is nothing to uncover', () => {
		const g = curiosityGap(0, 0);
		expect(g.teaser).toBe('');
		expect(g.complete).toBe(false);
		expect(g.pct).toBe(0);
	});

	it('marks a fully uncovered set complete', () => {
		const g = curiosityGap(3, 3);
		expect(g.complete).toBe(true);
		expect(g.remaining).toBe(0);
		expect(g.teaser).toBe('All Uncovered');
		expect(g.pct).toBe(1);
	});

	it('gives the last payoff its own pull copy', () => {
		const g = curiosityGap(2, 3);
		expect(g.oneAway).toBe(true);
		expect(g.remaining).toBe(1);
		expect(g.teaser).toBe('One Discovery Away');
	});

	it('teases an untouched set with "to Uncover"', () => {
		expect(curiosityGap(0, 3).teaser).toBe('3 Discoveries to Uncover');
	});

	it('teases a partially uncovered set with "to Go"', () => {
		const g = curiosityGap(1, 4);
		expect(g.remaining).toBe(3);
		expect(g.teaser).toBe('3 Discoveries to Go');
	});

	it('pluralizes assorted nouns correctly', () => {
		expect(curiosityGap(0, 2, { noun: 'Secret' }).teaser).toBe('2 Secrets to Uncover');
		expect(curiosityGap(0, 2, { noun: 'Fact' }).teaser).toBe('2 Facts to Uncover');
		expect(curiosityGap(0, 2, { noun: 'Discovery' }).teaser).toBe('2 Discoveries to Uncover');
		expect(curiosityGap(1, 2, { noun: 'Secret' }).teaser).toBe('One Secret Away');
	});

	it('clamps out-of-range and junk inputs', () => {
		const over = curiosityGap(9, 3); // revealed capped to total
		expect(over.revealed).toBe(3);
		expect(over.complete).toBe(true);
		const neg = curiosityGap(-2, 4); // negative revealed -> 0
		expect(neg.revealed).toBe(0);
		expect(neg.remaining).toBe(4);
		const junkTotal = curiosityGap(1, -5); // negative total -> 0
		expect(junkTotal.total).toBe(0);
		expect(junkTotal.teaser).toBe('');
	});

	it('exposes the pure function through the composable wrapper', () => {
		const { curiosityGap: fn } = useCuriosityGap();
		expect(fn(2, 3).teaser).toBe('One Discovery Away');
	});
});
