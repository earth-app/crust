import { describe, expect, it } from 'vitest';
import { resolveAccountRank } from '~/server/utils';

describe('resolveAccountRank', () => {
	it('returns undefined instead of throwing when the user has no account', () => {
		expect(() => resolveAccountRank({} as any)).not.toThrow();
		expect(resolveAccountRank({} as any)).toBeUndefined();
		expect(resolveAccountRank(null)).toBeUndefined();
		expect(resolveAccountRank(undefined)).toBeUndefined();
		expect(resolveAccountRank({ account: null })).toBeUndefined();
		expect(resolveAccountRank({ account: {} })).toBeUndefined();
		expect(resolveAccountRank({ account: { account_type: undefined } })).toBeUndefined();
		expect(resolveAccountRank({ account: { account_type: null } })).toBeUndefined();
	});

	it('lowercases a present account_type so the cloud rank bonus is forwarded', () => {
		expect(resolveAccountRank({ account: { account_type: 'FREE' } })).toBe('free');
		expect(resolveAccountRank({ account: { account_type: 'PRO' } })).toBe('pro');
		expect(resolveAccountRank({ account: { account_type: 'ADMINISTRATOR' } })).toBe(
			'administrator'
		);
		// already-lowercase stays stable (idempotent)
		expect(resolveAccountRank({ account: { account_type: 'free' } })).toBe('free');
	});

	it('returns undefined for a non-string account_type rather than throwing', () => {
		expect(resolveAccountRank({ account: { account_type: 123 as any } })).toBeUndefined();
	});
});
