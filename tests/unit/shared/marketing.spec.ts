import { describe, expect, it } from 'vitest';
import {
	activityFormFromPayload,
	articleFormFromPayload,
	emptyActivityForm,
	emptyArticleForm,
	emptyJourneyStreakForm,
	emptyPromptForm,
	emptyTrailmarkForm,
	eventFormFromPayload,
	hexColorToInt,
	intColorToHex,
	JOURNEY_STUDIO_PRESETS,
	journeyPreviewRows,
	journeySequenceFrames,
	mockActivity,
	mockArticle,
	mockEvent,
	mockPrompt,
	mockPromptResponses,
	mockUser,
	nearbyFieldForms,
	normalizeActivityType,
	parseInfoCardBadges,
	parseYoutubeId,
	promptFormFromPayload,
	splitCsv,
	trailmarkFormToTrailmark,
	trailmarkSequenceFrames,
	trailmarkThanksNotification
} from '~/shared/utils/marketing';

// deterministic clock so every factory produces byte-stable output
const NOW = Date.UTC(2026, 6, 17, 12, 0, 0);

describe('marketing helpers — primitives', () => {
	it('splitCsv trims, drops empties, and handles nullish', () => {
		expect(splitCsv('a, b ,,c')).toEqual(['a', 'b', 'c']);
		expect(splitCsv('')).toEqual([]);
		expect(splitCsv(undefined)).toEqual([]);
	});

	it('normalizeActivityType coerces free text to SCREAMING_SNAKE', () => {
		expect(normalizeActivityType('rock climbing')).toBe('ROCK_CLIMBING');
		expect(normalizeActivityType('  Trail Run ')).toBe('TRAIL_RUN');
	});

	it('hexColorToInt accepts numbers, #hex, bare hex, and shorthand', () => {
		expect(hexColorToInt('#4ade80')).toBe(0x4ade80);
		expect(hexColorToInt('4ade80')).toBe(0x4ade80);
		expect(hexColorToInt('#abc')).toBe(0xaabbcc);
		expect(hexColorToInt(0x123456)).toBe(0x123456);
	});

	it('hexColorToInt falls back to the default green on garbage', () => {
		expect(hexColorToInt('not-a-color')).toBe(0x4ade80);
		expect(hexColorToInt(undefined)).toBe(0x4ade80);
	});

	it('intColorToHex is the inverse of hexColorToInt for numbers and strings', () => {
		expect(intColorToHex(0x4ade80)).toBe('#4ade80');
		expect(intColorToHex('4ADE80')).toBe('#4ade80');
		expect(intColorToHex('#123456')).toBe('#123456');
		expect(hexColorToInt(intColorToHex(0x0a0b0c))).toBe(0x0a0b0c);
	});

	it('parseInfoCardBadges splits text and optional :color', () => {
		expect(parseInfoCardBadges('Recycling, Water:info, Solar')).toEqual([
			{ text: 'Recycling' },
			{ text: 'Water', color: 'info' },
			{ text: 'Solar' }
		]);
		expect(parseInfoCardBadges('')).toEqual([]);
	});

	it('parseYoutubeId extracts the id from urls or accepts a bare id', () => {
		expect(parseYoutubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		expect(parseYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		expect(parseYoutubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		expect(parseYoutubeId('')).toBeUndefined();
	});
});

describe('mockUser', () => {
	it('produces a full User with all field_privacy keys', () => {
		const user = mockUser({ username: 'ada', now: NOW });
		expect(user.username).toBe('ada');
		expect(user.id).toBe('mock-ada');
		expect(user.account.account_type).toBe('FREE');
		expect(user.is_admin).toBe(false);
		expect(Object.keys(user.account.field_privacy)).toHaveLength(13);
		expect(user.account.field_privacy.email).toBe('PUBLIC');
		expect(user.created_at).toBe(new Date(NOW).toISOString());
	});

	it('marks administrators as admin', () => {
		const user = mockUser({ username: 'root', accountType: 'ADMINISTRATOR', now: NOW });
		expect(user.is_admin).toBe(true);
		expect(user.account.account_type).toBe('ADMINISTRATOR');
	});
});

describe('activity factory + normalizer', () => {
	it('mockActivity maps form fields and defaults types to OTHER', () => {
		const activity = mockActivity({
			name: 'Rock Climbing',
			description: 'Scale walls',
			types: 'SPORT, OUTDOOR',
			icon: 'mdi:carabiner'
		});
		expect(activity.id).toBe('rock_climbing');
		expect(activity.name).toBe('Rock Climbing');
		expect(activity.types).toEqual(['SPORT', 'OUTDOOR']);
		expect(activity.fields.icon).toBe('mdi:carabiner');

		const bare = mockActivity(emptyActivityForm());
		expect(bare.types).toEqual(['OTHER']);
		expect(bare.fields.icon).toBeUndefined();
	});

	it('activityFormFromPayload reads a mantle2-shaped activity', () => {
		const form = activityFormFromPayload({
			name: 'Kayaking',
			description: 'Paddle',
			types: ['WATER', 'OUTDOOR'],
			fields: { icon: 'mdi:kayaking' }
		});
		expect(form).toEqual({
			name: 'Kayaking',
			description: 'Paddle',
			types: 'WATER, OUTDOOR',
			icon: 'mdi:kayaking'
		});
	});
});

describe('event factory + normalizer', () => {
	it('mockEvent builds an upcoming, non-passed event with a host', () => {
		const event = mockEvent(
			{
				name: 'Riverside Cleanup',
				description: 'Bring gloves',
				type: 'IN_PERSON',
				activities: 'Hiking, Gardening',
				attendeeCount: 12,
				hostUsername: 'ranger',
				hostAccountType: 'ORGANIZER'
			},
			{ now: NOW }
		);
		expect(event.type).toBe('IN_PERSON');
		expect(event.attendee_count).toBe(12);
		expect(event.host.username).toBe('ranger');
		expect(event.hostId).toBe(event.host.id);
		expect(event.activities).toEqual([
			{ type: 'activity_type', value: 'HIKING' },
			{ type: 'activity_type', value: 'GARDENING' }
		]);
		expect(event.timing.has_passed).toBe(false);
		expect(event.timing.is_upcoming).toBe(true);
		expect(event.timing.starts_in).toBe(3 * 24 * 60 * 60);
	});

	it('eventFormFromPayload reads both live Event and cloud EventData shapes', () => {
		const fromEventData = eventFormFromPayload({
			name: 'Calendar Event',
			description: 'From cloud',
			type: 'ONLINE',
			activities: ['HIKING', 'GARDENING'],
			host: { username: 'bot', account_type: 'ORGANIZER' }
		});
		expect(fromEventData.activities).toBe('HIKING, GARDENING');
		expect(fromEventData.hostAccountType).toBe('ORGANIZER');

		const fromLive = eventFormFromPayload({
			name: 'Live Event',
			type: 'HYBRID',
			attendee_count: 5,
			activities: [
				{ type: 'activity_type', value: 'HIKING' },
				{ type: 'activity', name: 'Trail Run', id: 't' }
			],
			host: { username: 'admin', account: { account_type: 'ADMINISTRATOR' } }
		});
		expect(fromLive.type).toBe('HYBRID');
		expect(fromLive.attendeeCount).toBe(5);
		expect(fromLive.activities).toBe('HIKING, Trail Run');
		expect(fromLive.hostAccountType).toBe('ADMINISTRATOR');
	});

	it('eventFormFromPayload falls back to ONLINE for an unknown type', () => {
		expect(eventFormFromPayload({ type: 'NONSENSE' }).type).toBe('ONLINE');
		expect(eventFormFromPayload({}).hostUsername).toBe('earthling');
	});
});

describe('prompt factory + normalizer', () => {
	it('mockPrompt keeps responses_count at least the number of authored responses', () => {
		const prompt = mockPrompt(
			{ ...emptyPromptForm(), prompt: 'Why recycle?', responsesCount: 1, responses: ['a', 'b'] },
			{ now: NOW }
		);
		expect(prompt.prompt).toBe('Why recycle?');
		expect(prompt.responses_count).toBe(2);
		expect(prompt.owner.username).toBe('earthling');
		expect(prompt.owner_id).toBe(prompt.owner.id);
	});

	it('mockPromptResponses drops blanks and assigns distinct owners', () => {
		const responses = mockPromptResponses(
			{ ...emptyPromptForm(), responses: ['first', '   ', 'second'] },
			{ now: NOW }
		);
		expect(responses).toHaveLength(2);
		expect(responses[0]!.response).toBe('first');
		expect(responses[1]!.response).toBe('second');
		expect(responses[0]!.owner.id).not.toBe(responses[1]!.owner.id);
		expect(responses[0]!.prompt_id).toBe(responses[1]!.prompt_id);
	});

	it('promptFormFromPayload reads a bare {prompt} and a full Prompt', () => {
		expect(promptFormFromPayload({ prompt: 'Generated?' }).prompt).toBe('Generated?');
		const fromLive = promptFormFromPayload({
			prompt: 'Live?',
			responses_count: 9,
			owner: { username: 'writer', account: { account_type: 'WRITER' } }
		});
		expect(fromLive.ownerUsername).toBe('writer');
		expect(fromLive.ownerAccountType).toBe('WRITER');
		expect(fromLive.responsesCount).toBe(9);
	});
});

describe('article factory + normalizer', () => {
	it('mockArticle converts hex to a numeric color and omits ocean without a favicon', () => {
		const article = mockArticle(
			{
				...emptyArticleForm(),
				title: 'Kelp Forests',
				tags: 'Oceans, Climate',
				colorHex: '#4ade80'
			},
			{ now: NOW }
		);
		expect(article.id).toBe('mock-article-kelp-forests');
		expect(article.color).toBe(0x4ade80);
		expect(article.color_hex).toBe('#4ade80');
		expect(article.tags).toEqual(['Oceans', 'Climate']);
		expect(article.ocean).toBeUndefined();

		const withFavicon = mockArticle(
			{ ...emptyArticleForm(), title: 'X', favicon: 'https://e.com/f.ico' },
			{ now: NOW }
		);
		expect(withFavicon.ocean?.favicon).toBe('https://e.com/f.ico');
	});

	it('articleFormFromPayload reads numeric and hex colors and prefers color_hex', () => {
		const fromGenerated = articleFormFromPayload({
			title: 'Gen',
			description: 'd',
			content: 'c',
			tags: ['a', 'b'],
			color: '#00ff00'
		});
		expect(fromGenerated.colorHex).toBe('#00ff00');
		expect(fromGenerated.tags).toBe('a, b');

		const fromLive = articleFormFromPayload({
			title: 'Live',
			color: 0x123456,
			color_hex: '#123456',
			author: { username: 'ada', account: { account_type: 'WRITER' } },
			ocean: { favicon: 'f.ico' }
		});
		expect(fromLive.colorHex).toBe('#123456');
		expect(fromLive.authorUsername).toBe('ada');
		expect(fromLive.favicon).toBe('f.ico');
	});
});

describe('journey studio staging', () => {
	it('maps a form onto the hero preview rows', () => {
		const rows = journeyPreviewRows({
			article: 8,
			prompt: 3,
			event: 0,
			articleRank: 1,
			promptRank: 4,
			eventRank: 0,
			hoursLeft: 30,
			markBest: true
		});

		expect(rows.map((r) => r.type)).toEqual(['article', 'prompt', 'event']);
		expect(rows[0]).toMatchObject({ count: 8, rank: 1, hoursLeft: 30, isBest: true });
		// only the highest row is a best, and a zero row is never one
		expect(rows[1]!.isBest).toBe(false);
		expect(rows[2]!.isBest).toBe(false);
	});

	it('never marks a best when the toggle is off or everything is zero', () => {
		const off = journeyPreviewRows({ ...emptyJourneyStreakForm(), markBest: false });
		expect(off.every((r) => !r.isBest)).toBe(true);

		const cold = journeyPreviewRows({
			...emptyJourneyStreakForm(),
			article: 0,
			prompt: 0,
			event: 0
		});
		expect(cold.every((r) => !r.isBest)).toBe(true);
	});

	it('clamps negative counts and hours', () => {
		const rows = journeyPreviewRows({
			...emptyJourneyStreakForm(),
			article: -4,
			articleRank: -1,
			hoursLeft: -10
		});
		expect(rows[0]).toMatchObject({ count: 0, rank: 0, hoursLeft: 0 });
	});

	it('offers presets that cover the states worth filming', () => {
		const names = JOURNEY_STUDIO_PRESETS.map((p) => p.name);
		expect(names).toContain('Expiring Soon');
		expect(names).toContain('Cold Start');

		const expiring = JOURNEY_STUDIO_PRESETS.find((p) => p.name === 'Expiring Soon')!.build();
		expect(expiring.hoursLeft).toBeLessThan(12);
	});

	it('builds a growth story that only goes up', () => {
		const frames = journeySequenceFrames('build');
		const counts = frames.map((f) => f.form.article);

		expect(frames.length).toBeGreaterThan(2);
		expect([...counts].sort((a, b) => a - b)).toEqual(counts);
		expect(frames[0]!.label).toBe('Day 1');
	});

	it('builds a rescue story that ends higher and safe', () => {
		const frames = journeySequenceFrames('save');
		const last = frames.at(-1)!;
		const first = frames[0]!;

		expect(first.form.hoursLeft).toBeLessThan(12);
		expect(last.form.hoursLeft).toBeGreaterThan(24);
		expect(last.form.article).toBeGreaterThan(first.form.article);
	});
});

describe('trailmark studio sequences', () => {
	it('fills the nearby field one step at a time, capped by the note pool', () => {
		const frames = trailmarkSequenceFrames('nearby');
		expect(frames.map((f) => f.fieldCount)).toEqual([1, 3, 6]);

		expect(nearbyFieldForms(0)).toEqual([]);
		expect(nearbyFieldForms(3)).toHaveLength(3);
		// never invents notes beyond the authored pool
		expect(nearbyFieldForms(99).length).toBeLessThanOrEqual(6);
		// distances grow so the field reads as a spread, not a pile
		const distances = nearbyFieldForms(6).map((f) => f.distanceMeters);
		expect([...distances].sort((a, b) => a - b)).toEqual(distances);
	});

	it('closes the distance in the discovery story without ever reaching zero', () => {
		const frames = trailmarkSequenceFrames('discovery');
		const distances = frames.map((f) => f.form.distanceMeters);

		expect([...distances].sort((a, b) => b - a)).toEqual(distances);
		expect(distances.at(-1)!).toBeGreaterThan(0);
		expect(frames.every((f) => f.form.isMine === false)).toBe(true);
		expect(frames.every((f) => f.fieldCount === 0)).toBe(true);
	});

	it('ends the thanks story on the author side with a notification frame', () => {
		const frames = trailmarkSequenceFrames('thanks');

		expect(frames[0]!.form.thankedByMe).toBe(false);
		expect(frames[1]!.form.thankedByMe).toBe(true);
		expect(frames[1]!.form.thanksForAuthor).toBeGreaterThan(frames[0]!.form.thanksForAuthor);

		const last = frames.at(-1)!;
		expect(last.notification).toBe(true);
		expect(last.form.isMine).toBe(true);
		expect(frames.filter((f) => f.notification)).toHaveLength(1);
	});

	it('writes a thank notification that names the place', () => {
		const notification = trailmarkThanksNotification({
			...emptyTrailmarkForm(),
			placeLabel: 'North Pond'
		});

		expect(notification.title).toContain('Thanked');
		expect(notification.message).toContain('North Pond');
		expect(notification.source).toBe('trailmark');
		expect(notification.type).toBe('success');
	});

	it('keeps staged field notes on distinct store ids', () => {
		const forms = nearbyFieldForms(3);
		const ids = forms.map(
			(form, i) => trailmarkFormToTrailmark(form, { selfUid: 'me', idSuffix: `field-${i}` }).id
		);

		expect(new Set(ids).size).toBe(3);
		// the default id is untouched for every existing caller
		expect(trailmarkFormToTrailmark(forms[0]!, { selfUid: 'me' }).id).not.toContain('field-');
	});
});
