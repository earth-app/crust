// sibling to stagedRisk.ts, and deliberately separate: that file SCORES a pending submission
// client-side, this one presents a verdict cloud already computed for a LIVE catalog entry

// #region contract

export type ActivityNature =
	| 'activity'
	| 'person'
	| 'place'
	| 'organism'
	| 'substance'
	| 'object'
	| 'organization'
	| 'work'
	| 'ambiguous'
	| 'unknown';

export type AuditRecommendation = 'delete' | 'review';

export type ActivityAuditFinding = {
	id: string;
	nature: ActivityNature;
	title: string;
	short_description: string | null;
	recommendation: AuditRecommendation;
	reason: string;
};

export type ActivityAudit = {
	checked: number;
	counts: Record<string, number>;
	findings: ActivityAuditFinding[];
	generated_at: string;
};

export type ActivityNatureMeta = {
	label: string;
	color: 'error' | 'warning' | 'success' | 'neutral';
	variant: 'solid' | 'soft' | 'subtle';
	icon: string;
};

// #endregion

// #region presentation

export const ACTIVITY_NATURES: Record<ActivityNature, ActivityNatureMeta> = {
	activity: {
		label: 'Activity',
		color: 'success',
		variant: 'subtle',
		icon: 'mdi:run'
	},
	person: {
		label: 'Person',
		color: 'error',
		variant: 'soft',
		icon: 'mdi:account-hard-hat'
	},
	place: {
		label: 'Place',
		color: 'error',
		variant: 'soft',
		icon: 'mdi:map-marker'
	},
	organism: {
		label: 'Organism',
		color: 'error',
		variant: 'soft',
		icon: 'mdi:fish'
	},
	substance: {
		label: 'Substance',
		color: 'error',
		variant: 'soft',
		icon: 'mdi:flask'
	},
	object: {
		label: 'Object',
		color: 'error',
		variant: 'soft',
		icon: 'mdi:hammer-wrench'
	},
	organization: {
		label: 'Organization',
		color: 'error',
		variant: 'soft',
		icon: 'mdi:domain'
	},
	work: {
		label: 'Creative Work',
		color: 'error',
		variant: 'soft',
		icon: 'mdi:book-open-variant'
	},
	ambiguous: {
		label: 'Ambiguous',
		color: 'warning',
		variant: 'soft',
		icon: 'mdi:help-rhombus'
	},
	unknown: {
		label: 'Unscreened',
		color: 'neutral',
		variant: 'subtle',
		icon: 'mdi:help-circle-outline'
	}
};

export const AUDIT_RECOMMENDATIONS: Record<AuditRecommendation, ActivityNatureMeta> = {
	delete: {
		label: 'Recommend Deleting',
		color: 'error',
		variant: 'solid',
		icon: 'mdi:delete-alert'
	},
	review: {
		label: 'Needs Review',
		color: 'warning',
		variant: 'soft',
		icon: 'mdi:eye-check'
	}
};

/**
 * Presentation metadata for a nature, falling back to `unknown` for anything cloud adds later.
 *
 * @param nature nature string from the audit response
 */
export function natureMeta(nature: string): ActivityNatureMeta {
	return ACTIVITY_NATURES[nature as ActivityNature] ?? ACTIVITY_NATURES.unknown;
}

/**
 * Presentation metadata for a recommendation, defaulting to the softer of the two.
 *
 * @param recommendation recommendation string from the audit response
 */
export function recommendationMeta(recommendation: string): ActivityNatureMeta {
	return (
		AUDIT_RECOMMENDATIONS[recommendation as AuditRecommendation] ?? AUDIT_RECOMMENDATIONS.review
	);
}

/**
 * Split findings into the confident deletions and the ones a human has to judge.
 *
 * @param findings findings from the audit response
 */
export function partitionFindings(findings: ActivityAuditFinding[]): {
	deletions: ActivityAuditFinding[];
	reviews: ActivityAuditFinding[];
} {
	return {
		deletions: findings.filter((finding) => finding.recommendation === 'delete'),
		reviews: findings.filter((finding) => finding.recommendation !== 'delete')
	};
}

/**
 * Counts worth showing above the list, in a stable order.
 *
 * `activity` and `unknown` are the two non-finding buckets, so they are reported separately from
 * the flagged natures rather than mixed into the same row.
 *
 * @param counts nature -> count map from the audit response
 */
export function summarizeCounts(counts: Record<string, number>): {
	nature: ActivityNature;
	meta: ActivityNatureMeta;
	count: number;
}[] {
	return (Object.keys(ACTIVITY_NATURES) as ActivityNature[])
		.map((nature) => ({ nature, meta: ACTIVITY_NATURES[nature], count: counts[nature] ?? 0 }))
		.filter((entry) => entry.count > 0);
}

// #endregion
