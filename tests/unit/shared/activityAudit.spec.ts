import { describe, expect, it } from 'vitest';
import {
	ACTIVITY_NATURES,
	AUDIT_RECOMMENDATIONS,
	natureMeta,
	partitionFindings,
	recommendationMeta,
	summarizeCounts,
	type ActivityAuditFinding
} from '~/shared/utils/activityAudit';

function finding(over: Partial<ActivityAuditFinding> = {}): ActivityAuditFinding {
	return {
		id: 'marina',
		nature: 'place',
		title: 'Marina',
		short_description: 'Dock with moorings for yachts',
		recommendation: 'delete',
		reason: 'names a place or facility, not something to do',
		...over
	};
}

describe('natureMeta', () => {
	it('resolves every nature cloud can return', () => {
		for (const nature of Object.keys(ACTIVITY_NATURES)) {
			expect(natureMeta(nature).label.length).toBeGreaterThan(0);
		}
	});

	// cloud owns the taxonomy, so a nature added there must not render a blank badge here
	it('falls back to Unscreened for an unrecognised nature', () => {
		expect(natureMeta('something-new')).toEqual(ACTIVITY_NATURES.unknown);
	});

	it('colours activity as the only success tier', () => {
		expect(natureMeta('activity').color).toBe('success');
		expect(natureMeta('place').color).toBe('error');
		expect(natureMeta('ambiguous').color).toBe('warning');
	});
});

describe('recommendationMeta', () => {
	it('maps both recommendations', () => {
		expect(recommendationMeta('delete')).toEqual(AUDIT_RECOMMENDATIONS.delete);
		expect(recommendationMeta('review')).toEqual(AUDIT_RECOMMENDATIONS.review);
	});

	// defaulting to 'delete' on an unknown value would recommend destroying data on a typo
	it('defaults to the softer recommendation', () => {
		expect(recommendationMeta('nonsense')).toEqual(AUDIT_RECOMMENDATIONS.review);
	});
});

describe('partitionFindings', () => {
	it('splits confident deletions from review items', () => {
		const { deletions, reviews } = partitionFindings([
			finding({ id: 'marina', recommendation: 'delete' }),
			finding({ id: 'pitch', nature: 'ambiguous', recommendation: 'review' })
		]);

		expect(deletions.map((f) => f.id)).toEqual(['marina']);
		expect(reviews.map((f) => f.id)).toEqual(['pitch']);
	});

	it('treats anything that is not a deletion as a review', () => {
		const { reviews } = partitionFindings([
			finding({ recommendation: 'unexpected' as ActivityAuditFinding['recommendation'] })
		]);
		expect(reviews).toHaveLength(1);
	});

	it('handles an empty finding list', () => {
		expect(partitionFindings([])).toEqual({ deletions: [], reviews: [] });
	});
});

describe('summarizeCounts', () => {
	it('reports only the natures actually present, in taxonomy order', () => {
		const summary = summarizeCounts({ place: 4, activity: 351, koi: 2 });
		expect(summary.map((entry) => entry.nature)).toEqual(['activity', 'place']);
		expect(summary[0]?.count).toBe(351);
	});

	it('drops zero counts rather than rendering empty badges', () => {
		expect(summarizeCounts({ place: 0, activity: 5 }).map((e) => e.nature)).toEqual(['activity']);
	});

	it('returns nothing for an empty count map', () => {
		expect(summarizeCounts({})).toEqual([]);
	});
});
