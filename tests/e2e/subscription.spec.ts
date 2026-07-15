import { expect, expectToast, skipIfIntegration, test } from './utils/fixtures';

// mirrors mantle2 STATUS SHAPE; snake_case matches the backend + existing crust types
const STATUS_ACTIVE_PRO = {
	tier: 'pro',
	status: 'active',
	provider: 'stripe',
	current_period_end: '2026-08-14T00:00:00+00:00',
	cancel_at_period_end: false,
	is_trial: false,
	trial_end: null,
	refund_eligible: true,
	refund_deadline: '2026-07-28T00:00:00+00:00',
	can_manage_billing: true
};

const STATUS_ACTIVE_WRITER = { ...STATUS_ACTIVE_PRO, tier: 'writer' };

const CHECKOUT_URL = 'http://127.0.0.1:3000/subscription/success';

test.describe('Subscription pricing + checkout clickthrough (web)', () => {
	test('pricing page renders every tier with its price', async ({
		page,
		gotoHydrated,
		asAnonymous
	}) => {
		skipIfIntegration('static pricing UI + mocked checkout');
		await asAnonymous();
		await gotoHydrated('/pricing');

		await expect(page.getByRole('heading', { name: /Choose Your Plan/i })).toBeVisible();
		await expect(page.locator('#plan-Free')).toBeVisible();
		await expect(page.locator('#plan-Pro')).toBeVisible();
		await expect(page.locator('#plan-Writer')).toBeVisible();
		await expect(page.locator('#plan-Organizer')).toBeVisible();
		await expect(page.getByText(/\$5\.99/).first()).toBeVisible();
		await expect(page.getByText(/\$8\.99/).first()).toBeVisible();
		await expect(page.getByText(/\$14\.99/).first()).toBeVisible();
	});

	test('anonymous visitor cannot check out (button says Sign Up and is disabled)', async ({
		page,
		gotoHydrated,
		asAnonymous
	}) => {
		skipIfIntegration('mocked auth state');
		await asAnonymous();
		await gotoHydrated('/pricing');

		const proBtn = page.locator('#plan-Pro').getByRole('button', { name: /Sign Up/i });
		await expect(proBtn).toBeVisible();
		await expect(proBtn).toBeDisabled();
		// forcing a click must not open the confirm modal
		await proBtn.click({ force: true }).catch(() => {});
		await expect(page.getByText('Confirm Your Subscription')).toHaveCount(0);
	});

	test('logged-in user completes upgrade -> confirm -> checkout -> success', async ({
		page,
		gotoHydrated,
		mockApi,
		asUser
	}) => {
		skipIfIntegration('mocked checkout session + status');
		await asUser();
		await mockApi.setMany([
			{
				method: 'POST',
				path: '/v2/users/current/subscription/checkout',
				body: { url: CHECKOUT_URL, session_id: 'cs_test_ok' },
				once: false
			},
			{
				method: 'GET',
				path: '/v2/users/current/subscription',
				body: STATUS_ACTIVE_PRO,
				once: false
			}
		]);

		await gotoHydrated('/pricing');

		const proBtn = page.locator('#plan-Pro').getByRole('button', { name: /Upgrade/i });
		await expect(proBtn).toBeEnabled();
		await proBtn.click();

		// the confirm modal must disclose the plan, price, auto-renewal, and the 14-day window
		await expect(page.getByText('Confirm Your Subscription')).toBeVisible();
		await expect(page.getByText(/auto-renewing subscription/i)).toBeVisible();
		await expect(page.getByText(/within 14 days/i)).toBeVisible();
		await expect(page.getByText(/\$5\.99/).first()).toBeVisible();

		await page.getByRole('button', { name: /Agree & Continue/i }).click();

		// startCheckout returns the hosted-checkout url; the app redirects the browser to it
		await page.waitForURL(/\/subscription\/success/, { timeout: 15_000 });
		await expect(page.getByRole('heading', { name: /You're All Set/i })).toBeVisible();
		await expect(page.getByText(/Pro/).first()).toBeVisible();
	});

	test('checkout conflict (already subscribed) shows an error toast and stays on pricing', async ({
		page,
		gotoHydrated,
		mockApi,
		asUser
	}) => {
		skipIfIntegration('mocked 409 checkout');
		await asUser();
		await mockApi.set({
			method: 'POST',
			path: '/v2/users/current/subscription/checkout',
			status: 409,
			body: { code: 409, message: 'You already have an active subscription.' },
			once: false
		});

		await gotoHydrated('/pricing');
		await page
			.locator('#plan-Pro')
			.getByRole('button', { name: /Upgrade/i })
			.click();
		await page.getByRole('button', { name: /Agree & Continue/i }).click();

		await expectToast(page, /Could Not Start Checkout/i);
		await expect(page).toHaveURL(/\/pricing/);
	});

	test('checkout service error shows an error toast', async ({
		page,
		gotoHydrated,
		mockApi,
		asUser
	}) => {
		skipIfIntegration('mocked 500 checkout');
		await asUser();
		await mockApi.set({
			method: 'POST',
			path: '/v2/users/current/subscription/checkout',
			status: 500,
			body: { code: 500, message: 'Internal Server Error' },
			once: false
		});

		await gotoHydrated('/pricing');
		await page
			.locator('#plan-Pro')
			.getByRole('button', { name: /Upgrade/i })
			.click();
		await page.getByRole('button', { name: /Agree & Continue/i }).click();

		await expectToast(page, /Could Not Start Checkout/i);
		await expect(page).toHaveURL(/\/pricing/);
	});

	test('dismissing the confirm modal does not start checkout', async ({
		page,
		gotoHydrated,
		asUser
	}) => {
		skipIfIntegration('mocked auth state');
		await asUser();
		await gotoHydrated('/pricing');

		await page
			.locator('#plan-Pro')
			.getByRole('button', { name: /Upgrade/i })
			.click();
		await expect(page.getByText('Confirm Your Subscription')).toBeVisible();
		await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

		await expect(page.getByText('Confirm Your Subscription')).toHaveCount(0);
		await expect(page).toHaveURL(/\/pricing/);
	});
});

test.describe('Subscription return pages (web)', () => {
	test('success page reports the active plan and toasts', async ({
		page,
		gotoHydrated,
		mockApi,
		asUser
	}) => {
		skipIfIntegration('mocked status');
		await asUser();
		await mockApi.set({
			method: 'GET',
			path: '/v2/users/current/subscription',
			body: STATUS_ACTIVE_WRITER,
			once: false
		});

		await gotoHydrated('/subscription/success');
		await expect(page.getByRole('heading', { name: /You're All Set/i })).toBeVisible();
		await expect(page.getByText(/Writer/).first()).toBeVisible();
		await expectToast(page, /Subscription Active/i);
	});

	test('cancel page reports no charge was made', async ({ page, gotoHydrated, asAnonymous }) => {
		skipIfIntegration('static page');
		await asAnonymous();
		await gotoHydrated('/subscription/cancel');
		await expect(page.getByRole('heading', { name: /Checkout Canceled/i })).toBeVisible();
		await expect(page.getByText(/No charge was made/i)).toBeVisible();
	});
});
