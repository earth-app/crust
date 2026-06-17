import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from 'stores/auth';
import { beforeEach, describe, expect, it } from 'vitest';
import { useEmailGate } from '~/composables/useEmailGate';

// the email gate's branching (admin bypass, override after a server 403,
// optimistic requireVerified) is pure state logic that no e2e flow asserts.

type Account = {
	email?: string;
	email_verified?: boolean;
	account_type?: string;
};

function setUser(account: Account | null) {
	useAuthStore().currentUser = (account ? { account } : null) as any;
}

describe('useEmailGate', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		// module-level singletons — reset via close()
		useEmailGate().close();
		setUser({ email: 'a@b.com', email_verified: false, account_type: 'USER' });
	});

	describe('computed flags', () => {
		it('hasEmail reflects a non-empty account email', () => {
			setUser({ email: '   ', email_verified: false });
			expect(useEmailGate().hasEmail.value).toBe(false);
			setUser({ email: 'a@b.com', email_verified: false });
			expect(useEmailGate().hasEmail.value).toBe(true);
		});

		it('isVerified reads the account (admin handled via isGated bypass below)', () => {
			setUser({ email: 'a@b.com', email_verified: true, account_type: 'ADMINISTRATOR' });
			expect(useEmailGate().isVerified.value).toBe(true);
		});

		it('isGated is true only for a signed-in, unverified non-admin', () => {
			// unverified user → gated
			expect(useEmailGate().isGated.value).toBe(true);

			// verified → not gated
			setUser({ email: 'a@b.com', email_verified: true });
			expect(useEmailGate().isGated.value).toBe(false);

			// admin (even unverified) → bypass
			setUser({ email: 'a@b.com', email_verified: false, account_type: 'ADMINISTRATOR' });
			expect(useEmailGate().isGated.value).toBe(false);

			// signed out → not gated (handled by login redirect elsewhere)
			setUser(null);
			expect(useEmailGate().isGated.value).toBe(false);
		});
	});

	describe('requireVerified', () => {
		it('opens the modal and returns false for a gated user', () => {
			const gate = useEmailGate();
			expect(gate.requireVerified('post_prompt')).toBe(false);
			expect(gate.open.value).toBe(true);
			expect(gate.action.value).toBe('post_prompt');
		});

		it('returns true without opening for a verified user', () => {
			setUser({ email: 'a@b.com', email_verified: true });
			const gate = useEmailGate();
			expect(gate.requireVerified()).toBe(true);
			expect(gate.open.value).toBe(false);
		});

		it('returns true for a signed-out user (unauth handled elsewhere)', () => {
			setUser(null);
			const gate = useEmailGate();
			expect(gate.requireVerified()).toBe(true);
			expect(gate.open.value).toBe(false);
		});
	});

	describe('open/close', () => {
		it('close resets open, action and the email override', () => {
			const gate = useEmailGate();
			gate.openModal('do_thing');
			expect(gate.open.value).toBe(true);
			gate.close();
			expect(gate.open.value).toBe(false);
			expect(gate.action.value).toBeNull();
		});
	});

	describe('handleServerError', () => {
		it('reopens the gate on an EMAIL_VERIFICATION_REQUIRED body and applies has_email override', () => {
			const gate = useEmailGate();
			const handled = gate.handleServerError({
				data: { reason: 'EMAIL_VERIFICATION_REQUIRED', has_email: false, message: 'verify first' }
			});

			expect(handled).toBe(true);
			expect(gate.open.value).toBe(true);
			// override forces hasEmail false regardless of the stale local account
			expect(gate.hasEmail.value).toBe(false);
		});

		it('reads the body from a $fetch-style response._data envelope', () => {
			const gate = useEmailGate();
			const handled = gate.handleServerError(
				{ response: { _data: { reason: 'EMAIL_VERIFICATION_REQUIRED', has_email: true } } },
				'post_article'
			);

			expect(handled).toBe(true);
			expect(gate.action.value).toBe('post_article');
			expect(gate.hasEmail.value).toBe(true);
		});

		it('ignores unrelated errors', () => {
			const gate = useEmailGate();
			expect(gate.handleServerError({ data: { reason: 'RATE_LIMITED' } })).toBe(false);
			expect(gate.handleServerError(null)).toBe(false);
			expect(gate.open.value).toBe(false);
		});
	});
});
