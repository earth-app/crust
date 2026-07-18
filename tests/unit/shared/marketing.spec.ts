import { describe, expect, it } from 'vitest';
import {
	activityFormFromPayload,
	articleFormFromPayload,
	emptyActivityForm,
	emptyArticleForm,
	emptyPromptForm,
	eventFormFromPayload,
	hexColorToInt,
	intColorToHex,
	mockActivity,
	mockArticle,
	mockEvent,
	mockPrompt,
	mockPromptResponses,
	mockUser,
	normalizeActivityType,
	parseInfoCardBadges,
	parseYoutubeId,
	promptFormFromPayload,
	splitCsv
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
