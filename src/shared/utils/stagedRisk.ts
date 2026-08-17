import { englishDataset, englishRecommendedTransformers, RegExpMatcher } from 'obscenity';
import type { StagedActivity } from 'types/activity';

// #region contract

export type StagedRiskTier =
	| 'suspicious'
	| 'looks_suspicious'
	| 'slightly_suspicious'
	| 'neutral'
	| 'slightly_safe'
	| 'looks_safe'
	| 'safe';

export type StagedRiskSignal = {
	id: string;
	label: string;
	// negative reads as risk, positive reads as a mark of a real submission
	weight: number;
	// a decisive signal pins the verdict at 'suspicious' whatever else scores
	decisive?: boolean;
};

export type StagedRiskAssessment = {
	tier: StagedRiskTier;
	score: number;
	signals: StagedRiskSignal[];
	risks: StagedRiskSignal[];
	positives: StagedRiskSignal[];
};

export type StagedRiskTierMeta = {
	label: string;
	color: 'error' | 'warning' | 'success' | 'neutral';
	variant: 'solid' | 'soft' | 'subtle';
	icon: string;
	// neutral is the no-flag middle; nothing renders for it
	flag: boolean;
	suspicious: boolean;
};

export const STAGED_RISK_TIERS: Record<StagedRiskTier, StagedRiskTierMeta> = {
	suspicious: {
		label: 'Suspicious',
		color: 'error',
		variant: 'solid',
		icon: 'mdi:alert-octagon',
		flag: true,
		suspicious: true
	},
	looks_suspicious: {
		label: 'Looks Suspicious',
		color: 'error',
		variant: 'soft',
		icon: 'mdi:alert',
		flag: true,
		suspicious: true
	},
	slightly_suspicious: {
		label: 'Slightly Suspicious',
		color: 'warning',
		variant: 'subtle',
		icon: 'mdi:alert-outline',
		flag: true,
		suspicious: true
	},
	neutral: {
		label: 'Neutral',
		color: 'neutral',
		variant: 'subtle',
		icon: 'mdi:minus-circle-outline',
		flag: false,
		suspicious: false
	},
	slightly_safe: {
		label: 'Slightly Safe',
		color: 'success',
		variant: 'subtle',
		icon: 'mdi:check-outline',
		flag: true,
		suspicious: false
	},
	looks_safe: {
		label: 'Looks Safe',
		color: 'success',
		variant: 'soft',
		icon: 'mdi:check-circle-outline',
		flag: true,
		suspicious: false
	},
	safe: {
		label: 'Safe',
		color: 'success',
		variant: 'solid',
		icon: 'mdi:check-decagram',
		flag: true,
		suspicious: false
	}
};

// asymmetric on purpose: one risk signal is heavier than one mark of quality, so a single
// hard hit outweighs a well-formatted submission
const RISK_THRESHOLDS: [number, StagedRiskTier][] = [
	[-7, 'suspicious'],
	[-4, 'looks_suspicious'],
	[-1.5, 'slightly_suspicious']
];

const SAFE_THRESHOLDS: [number, StagedRiskTier][] = [
	[9, 'safe'],
	[6, 'looks_safe'],
	[3, 'slightly_safe']
];

// #endregion

// #region detectors

const EMAIL = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;
// shaped like a real number rather than any long digit run, so measurements do not trip it
const PHONE = /(?:\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b|\+\d{9,15}\b/;
const HANDLE = /(?:^|[\s(])@[a-z0-9_]{3,}/i;
const LINK =
	/https?:\/\/|www\.[a-z0-9-]+\.|\b[a-z0-9-]{2,}\.(?:com|net|org|io|co|us|uk|ca|de|shop|xyz|info|biz|ru|app|gg|link)\b/i;
const MARKUP = /<\/?[a-z][^>]*>|\[[^\]]{1,60}\]\([^)]{1,200}\)|&[a-z]{2,8};/i;
const STREET =
	/\b\d{1,5}\s+[A-Za-z][A-Za-z.]*\s+(?:st|street|ave|avenue|rd|road|blvd|boulevard|ln|lane|dr|drive|ct|court|way|hwy|highway|pkwy|parkway)\b/i;
const POSTCODE = /\b\d{5}(?:-\d{4})?\b/;
const US_STATE =
	/\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/;
const NAME_PLACE = /\b(?:at|in|near|around|by)\s+(?:the\s+)?[A-Z][a-z]+/;
const PLACE_WORD = /\b(?:county|township|downtown|near me|my (?:town|city|street|neighborhood))\b/i;
const NAME_PLACEHOLDER =
	/\b(?:test|testing|asdf+|qwerty|lorem|ipsum|foo ?bar|placeholder|sample|dummy|todo|tbd|x{3,})\b/i;
const TEXT_PLACEHOLDER = /\b(?:lorem ipsum|asdf+|qwerty|placeholder text|test test|dummy text)\b/i;
const FIRST_PERSON = /\b(?:my|mine|our|ours|me|i|we|us|myself)\b/i;
const EMOJI = /\p{Extended_Pictographic}/u;
const PUNCTUATION_NOISE = /[!?]{2,}|\.{4,}|[*_~^#]{3,}/;
const KEYBOARD_RUNS = ['qwer', 'asdf', 'zxcv', 'hjkl', 'uiop', '1234'];
const NAME_SHAPE = /^[A-Za-z][A-Za-z'\u2019\- ]{1,38}$/;
const ACTIVITY_SUFFIXES = ['ing', 'ball', 'craft', 'ery', 'ics', 'ism', 'ology', 'graphy'];

const STOPWORDS = new Set([
	'the',
	'a',
	'an',
	'and',
	'or',
	'of',
	'to',
	'in',
	'is',
	'it',
	'for',
	'with',
	'on',
	'that',
	'as',
	'are',
	'you',
	'your',
	'by',
	'from',
	'at',
	'this',
	'be',
	'can',
	'their',
	'they'
]);

let matcher: RegExpMatcher | null = null;

// built once on first use; the dataset build is the only non-trivial cost in this module
function hasProfanity(text: string): boolean {
	if (!text) return false;
	if (!matcher) {
		matcher = new RegExpMatcher({
			...englishDataset.build(),
			...englishRecommendedTransformers
		});
	}
	return matcher.hasMatch(text);
}

function words(text: string): string[] {
	return text.match(/[A-Za-z'\u2019]+/g) ?? [];
}

function hasContactDetails(text: string): boolean {
	return EMAIL.test(text) || PHONE.test(text) || HANDLE.test(text);
}

function hasAddress(text: string): boolean {
	return STREET.test(text) || (POSTCODE.test(text) && US_STATE.test(text));
}

// a name nobody would type on purpose: unpronounceable, mashed, or empty
function looksUnreal(name: string): boolean {
	if (!name) return true;

	return name.split(/\s+/).some((token) => {
		const word = token.replace(/[^A-Za-z]/g, '');
		if (word.length < 4) return false;
		if (!/[aeiouy]/i.test(word)) return true;
		if (/(.)\1{2,}/i.test(word)) return true;
		if (/[bcdfghjklmnpqrstvwxz]{6,}/i.test(word)) return true;
		return KEYBOARD_RUNS.some((run) => word.toLowerCase().includes(run));
	});
}

// a submission padded out by repeating one word reads as generated filler
function repetitionRatio(text: string): number {
	const tokens = words(text).map((token) => token.toLowerCase());
	if (tokens.length < 12) return 0;

	const counts = new Map<string, number>();
	for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);

	let top = 0;
	for (const [token, count] of counts) {
		if (!STOPWORDS.has(token) && count > top) top = count;
	}
	return top / tokens.length;
}

function shouts(text: string): boolean {
	const letters = text.replace(/[^A-Za-z]/g, '');
	if (letters.length < 12) return false;
	const upper = letters.replace(/[^A-Z]/g, '').length;
	return upper / letters.length > 0.6;
}

// a pure non-latin name is plausibly a real foreign term; a mixed one is junk
function mixesScripts(text: string): boolean {
	return /[A-Za-z]/.test(text) && /\p{Letter}/u.test(text.replace(/\p{Script=Latin}/gu, ''));
}

function normalize(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

function sentenceCount(text: string): number {
	return (text.match(/[.!?](?:\s|$)/g) ?? []).length;
}

function looksActivityShaped(name: string): boolean {
	const tokens = name.toLowerCase().split(/\s+/).filter(Boolean);
	const last = tokens[tokens.length - 1] ?? '';
	return ACTIVITY_SUFFIXES.some((suffix) => last.endsWith(suffix));
}

function isAliasShaped(alias: string): boolean {
	const trimmed = alias.trim();
	return NAME_SHAPE.test(trimmed) && trimmed.split(/\s+/).length <= 3 && !/\d/.test(trimmed);
}

// #endregion

// #region assessment

export function assessStagedActivity(staged: StagedActivity): StagedRiskAssessment {
	const activity = staged?.activity;
	const name = (activity?.name ?? '').trim();
	const description = (activity?.description ?? '').trim();
	const aliases = (activity?.aliases ?? []).filter(Boolean);
	const types = activity?.types ?? [];
	const note = (staged?.note ?? '').trim();
	const corpus = [name, description, ...aliases, note].filter(Boolean).join('\n');

	const signals: StagedRiskSignal[] = [];
	const add = (id: string, label: string, weight: number, decisive = false) => {
		signals.push(decisive ? { id, label, weight, decisive } : { id, label, weight });
	};

	// #region decisive risks (a real catalog entry never carries these)
	if (hasProfanity(corpus)) add('profanity', 'Profanity in the Submitted Text', -10, true);
	if (hasContactDetails(corpus)) add('contact', 'Email, Phone, or Handle in the Text', -10, true);
	if (LINK.test(corpus)) add('link', 'Link or Domain in the Text', -8, true);
	if (MARKUP.test(corpus)) add('markup', 'Raw Markup in the Text', -8, true);
	if (NAME_PLACEHOLDER.test(name) || TEXT_PLACEHOLDER.test(description)) {
		add('placeholder', 'Placeholder or Test Text', -8, true);
	}
	if (looksUnreal(name)) add('unreal_name', 'Name Does Not Read as Real Words', -8, true);
	if (hasAddress(corpus)) add('address', 'Street Address or Postcode', -7, true);
	// #endregion

	// #region soft risks
	if (NAME_PLACE.test(name) || PLACE_WORD.test(name) || US_STATE.test(name)) {
		add('place_specific', 'Name is Tied to One Place', -3);
	}
	if (FIRST_PERSON.test(name)) add('first_person', 'Name Reads as a Personal Note', -3);
	if (name.split(/\s+/).filter(Boolean).length > 4 || name.length > 40) {
		add('name_too_long', 'Name is Unusually Long or Narrow', -2.5);
	}
	if (/\d/.test(name)) add('digits_in_name', 'Digits in the Name', -2);
	if (description.length < 40 || words(description).length < 6) {
		add('thin_description', 'Description is Too Thin to Judge', -3);
	}
	if (
		description &&
		normalize(description).startsWith(normalize(name)) &&
		description.length < name.length + 12
	) {
		add('echo_description', 'Description Only Repeats the Name', -3);
	}
	if (repetitionRatio(description) > 0.2) {
		add('repetition', 'Description Repeats One Word Heavily', -2.5);
	}
	if (shouts(`${name} ${description}`)) add('shouting', 'Text is Mostly Capitals', -2);
	if (mixesScripts(name)) add('mixed_scripts', 'Name Mixes Scripts', -1.5);
	if (EMOJI.test(corpus)) add('emoji', 'Emoji in the Submitted Text', -1.5);
	if (PUNCTUATION_NOISE.test(corpus)) add('punctuation', 'Runaway Punctuation', -1.5);
	if (types.length === 0) add('untyped', 'No Activity Types Set', -2);
	if (aliases.length > 8) add('alias_flood', 'Unusually Many Aliases', -1.5);
	// #endregion

	// #region marks of a real submission
	if (NAME_SHAPE.test(name) && name.split(/\s+/).length <= 3 && name.length <= 30) {
		add('clean_name', 'Name is Short and Well Formed', 2);
	}
	if (looksActivityShaped(name)) add('activity_shaped', 'Name Reads Like an Activity', 1.5);
	if (description.length >= 60 && description.length <= 1200 && words(description).length >= 12) {
		add('rich_description', 'Description Has Real Substance', 2.5);
	}
	if (sentenceCount(description) >= 2 && /[.!?]$/.test(description)) {
		add('prose', 'Description Reads as Finished Prose', 1);
	}
	if (types.length >= 1 && types.length <= 3) add('typed', 'Sensibly Typed', 1.5);
	if (
		aliases.length >= 1 &&
		aliases.length <= 6 &&
		aliases.every(isAliasShaped) &&
		!aliases.some((alias) => normalize(alias) === normalize(name))
	) {
		add('sane_aliases', 'Aliases Look Like Real Synonyms', 1);
	}
	if (activity?.fields?.icon) add('icon', 'Carries an Icon', 0.5);
	if (staged?.source === 'cloud_discovery') add('automated', 'Cleared the Discovery Filters', 1);
	if (staged?.submitter_kind === 'admin') add('admin_submitter', 'Submitted by an Admin', 1.5);
	if (note.length >= 20) add('submitter_note', 'Submitter Explained the Entry', 0.5);
	// #endregion

	const score = Number(signals.reduce((sum, signal) => sum + signal.weight, 0).toFixed(2));
	const decisive = signals.some((signal) => signal.decisive);

	return {
		tier: decisive ? 'suspicious' : tierFor(score),
		score,
		signals,
		risks: signals.filter((signal) => signal.weight < 0),
		positives: signals.filter((signal) => signal.weight > 0)
	};
}

function tierFor(score: number): StagedRiskTier {
	for (const [threshold, tier] of RISK_THRESHOLDS) {
		if (score <= threshold) return tier;
	}
	for (const [threshold, tier] of SAFE_THRESHOLDS) {
		if (score >= threshold) return tier;
	}
	return 'neutral';
}

export function isSuspiciousTier(tier: StagedRiskTier): boolean {
	return STAGED_RISK_TIERS[tier].suspicious;
}

// #endregion
