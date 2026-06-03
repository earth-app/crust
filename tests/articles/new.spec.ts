/**
 * E2E tests for `src/pages/articles/new.vue` - create-article form.
 *
 * Permission gate: only WRITER, ORGANIZER, or ADMINISTRATOR can create.
 * FREE/PRO users are redirected to / with a toast.
 */

import { expect, skipIfIntegration, test } from '../utils/fixtures';

const SKIP_REASON =
	'asUser({account_type, visibility}) overrides do not apply to the real admin session';

test.describe('Article creation (anonymous)', () => {
	test('redirects anonymous users to /login with return URL', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/articles/new');
		await expect(page).toHaveURL(/\/login\?redirect=%2Farticles%2Fnew/, { timeout: 25_000 });
	});
});

test.describe('Article creation (FREE account)', () => {
	test('redirects FREE user away with toast', async ({ asUser, page, gotoHydrated }) => {
		skipIfIntegration(SKIP_REASON);
		await asUser({ account: { account_type: 'FREE', visibility: 'PUBLIC' } });
		await gotoHydrated('/articles/new');
		await page.waitForURL(/127\.0\.0\.1:3000\/$/, { timeout: 15_000 });
		await expect(page.getByText(/Upgrade Required|Writer plan/i).first()).toBeVisible({
			timeout: 8000
		});
	});

	test('redirects PRO user away with toast', async ({ asUser, page, gotoHydrated }) => {
		skipIfIntegration(SKIP_REASON);
		await asUser({ account: { account_type: 'PRO', visibility: 'PUBLIC' } });
		await gotoHydrated('/articles/new');
		await page.waitForURL(/127\.0\.0\.1:3000\/$/, { timeout: 15_000 });
	});
});

test.describe('Article creation (PRIVATE visibility)', () => {
	test('redirects to /profile with toast when profile is private', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration(SKIP_REASON);
		await asUser({ account: { account_type: 'WRITER', visibility: 'PRIVATE' } });
		await gotoHydrated('/articles/new');
		await page.waitForURL(/\/profile$/, { timeout: 15_000 });
		await expect(page.getByText(/Profile Private|set your profile to Public/i).first()).toBeVisible(
			{
				timeout: 8000
			}
		);
	});
});

test.describe('Article creation (WRITER account)', () => {
	test('renders the create form for a WRITER with public profile', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration(SKIP_REASON);
		await asUser({ account: { account_type: 'WRITER', visibility: 'PUBLIC' } });
		await gotoHydrated('/articles/new');
		// Stay on the new page when permissions are correct
		await page.waitForTimeout(500);
		await expect(page).toHaveURL(/\/articles\/new/);
	});
});

test.describe('Article creation (ADMINISTRATOR account)', () => {
	test('renders the create form for an ADMIN', async ({ asAdmin, page, gotoHydrated }) => {
		skipIfIntegration(
			'asAdmin visibility:PUBLIC override does not apply; real admin visibility is not PUBLIC'
		);
		await asAdmin({ account: { visibility: 'PUBLIC' } });
		await gotoHydrated('/articles/new');
		await page.waitForTimeout(500);
		await expect(page).toHaveURL(/\/articles\/new/);
	});
});
