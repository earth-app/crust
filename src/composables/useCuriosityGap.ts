export interface CuriosityGap {
	revealed: number;
	total: number;
	remaining: number;
	// every payoff already uncovered
	complete: boolean;
	// exactly one payoff left (the strongest pull, so it gets its own copy)
	oneAway: boolean;
	// 0..1 progress toward fully uncovered
	pct: number;
	// Title Case teaser line; empty string when there is nothing to tease
	teaser: string;
}

function pluralize(noun: string, n: number): string {
	if (n === 1) return noun;
	// simple english pluralization for the short nouns we use (Discovery, Secret, Fact)
	if (/y$/i.test(noun)) return noun.replace(/y$/i, 'ies');
	if (/(s|x|z|ch|sh)$/i.test(noun)) return `${noun}es`;
	return `${noun}s`;
}

export function curiosityGap(
	revealed: number,
	total: number,
	opts: { noun?: string } = {}
): CuriosityGap {
	const noun = opts.noun?.trim() || 'Discovery';
	const tot = Math.max(0, Math.floor(total || 0));
	const rev = Math.min(tot, Math.max(0, Math.floor(revealed || 0)));
	const remaining = Math.max(0, tot - rev);
	const complete = tot > 0 && rev >= tot;
	const oneAway = remaining === 1;
	const pct = tot > 0 ? rev / tot : 0;

	let teaser = '';
	if (tot === 0) teaser = '';
	else if (complete) teaser = 'All Uncovered';
	else if (oneAway) teaser = `One ${noun} Away`;
	else if (rev === 0) teaser = `${remaining} ${pluralize(noun, remaining)} to Uncover`;
	else teaser = `${remaining} ${pluralize(noun, remaining)} to Go`;

	return { revealed: rev, total: tot, remaining, complete, oneAway, pct, teaser };
}

/** Thin composable wrapper so callers can `const { curiosityGap } = useCuriosityGap()`. */
export function useCuriosityGap() {
	return { curiosityGap };
}
