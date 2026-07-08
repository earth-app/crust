import { describe, expect, it } from 'vitest';
import { classifyWebOAuth, parseState } from '~/shared/utils/oauth';

describe('parseState', () => {
	it('parses a standard web login state', () => {
		expect(parseState('google:web:login')).toEqual({
			provider: 'google',
			source: 'web',
			context: 'login',
			mobileSessionToken: null
		});
	});

	it('parses a link context', () => {
		expect(parseState('github:web:link').context).toBe('link');
	});

	it('parses a mobile state and keeps the 4th segment as the session token', () => {
		expect(parseState('apple:mobile:signup:abc.def')).toEqual({
			provider: 'apple',
			source: 'mobile',
			context: 'signup',
			mobileSessionToken: 'abc.def'
		});
	});

	it('rejoins a token that itself contains colons', () => {
		// tokens can contain `:` — everything after the 3rd segment is the token
		expect(parseState('google:mobile:login:a:b:c').mobileSessionToken).toBe('a:b:c');
	});

	it('never surfaces a mobile token for a web source', () => {
		expect(parseState('google:web:login:leaked').mobileSessionToken).toBeNull();
	});

	it('nulls an unknown provider (not in the active OAUTH_PROVIDERS list)', () => {
		// facebook is currently commented out of OAUTH_PROVIDERS
		expect(parseState('facebook:web:login').provider).toBeNull();
		expect(parseState('nope:web:login').provider).toBeNull();
	});

	it('nulls an invalid context but still defaults source to web', () => {
		const parsed = parseState('google:web:banana');
		expect(parsed.context).toBeNull();
		expect(parsed.source).toBe('web');
	});

	it('handles an empty/garbage state without throwing', () => {
		expect(parseState('')).toEqual({
			provider: null,
			source: 'web',
			context: null,
			mobileSessionToken: null
		});
	});
});

describe('classifyWebOAuth', () => {
	// {cookie present, cookie absent} x {context login, link}
	describe('login context', () => {
		it('no cookie -> not linking, oauth_login', () => {
			expect(
				classifyWebOAuth({ stateContext: 'login', hasSessionToken: false, isNewUser: false })
			).toEqual({ wantsLink: false, isLinking: false, successParam: 'oauth_login' });
		});

		it('REGRESSION: a stale cookie during login is NOT treated as a link', () => {
			expect(
				classifyWebOAuth({ stateContext: 'login', hasSessionToken: true, isNewUser: false })
			).toEqual({ wantsLink: false, isLinking: false, successParam: 'oauth_login' });
		});
	});

	describe('link context', () => {
		it('with a live session -> linking, oauth_linked', () => {
			expect(
				classifyWebOAuth({ stateContext: 'link', hasSessionToken: true, isNewUser: false })
			).toEqual({ wantsLink: true, isLinking: true, successParam: 'oauth_linked' });
		});

		it('without a session -> wants link but cannot link', () => {
			expect(
				classifyWebOAuth({ stateContext: 'link', hasSessionToken: false, isNewUser: false })
			).toEqual({ wantsLink: true, isLinking: false, successParam: 'oauth_linked' });
		});
	});

	describe('new-user (201) always wins successParam', () => {
		it('signup context -> oauth_signup', () => {
			expect(
				classifyWebOAuth({ stateContext: 'signup', hasSessionToken: false, isNewUser: true })
					.successParam
			).toBe('oauth_signup');
		});

		it('login context that created an account -> oauth_signup', () => {
			expect(
				classifyWebOAuth({ stateContext: 'login', hasSessionToken: false, isNewUser: true })
					.successParam
			).toBe('oauth_signup');
		});
	});

	it('defaults a missing context to a login (never null, so the client can toast)', () => {
		expect(
			classifyWebOAuth({ stateContext: null, hasSessionToken: false, isNewUser: false })
		).toEqual({ wantsLink: false, isLinking: false, successParam: 'oauth_login' });
	});
});
