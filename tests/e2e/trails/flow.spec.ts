import { actAs, makeActor, registerActors } from '../utils/feature-helpers';
import { expect, skipIfIntegration, test } from '../utils/fixtures';

test.describe('Curiosity Trails - browse, pledge, practice, reflect, reveal', () => {
	test('browse -> theme filter -> if-then pledge gate', async ({
		page,
		context,
		mockApi,
		testId,
		gotoHydrated
	}) => {
		skipIfIntegration('drives the seeded trail catalog');

		const walker = makeActor(testId, 'walker');
		await registerActors(mockApi, walker);
		await actAs(context, mockApi, walker);

		await gotoHydrated('/trails');
		await expect(page.getByRole('heading', { name: 'Neighborhood Wonders' })).toBeVisible({
			timeout: 15000
		});
		// the Nature Minutes ring is framed as personal, never compared
		await expect(page.getByText('Personal, Never Compared')).toBeVisible();

		// theme filter narrows the catalog client-side
		await page.getByRole('button', { name: 'Curiosity', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Hidden Histories' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Neighborhood Wonders' })).toHaveCount(0);
		await page.getByRole('button', { name: 'All', exact: true }).click();

		// open a trail: it opens on the curiosity invitation, then the pledge
		await page
			.locator('[data-trail-id="trail-1"]')
			.getByRole('button', { name: 'Begin Trail' })
			.click();
		await expect(page.getByRole('button', { name: 'Make My Pledge' })).toBeVisible({
			timeout: 12000
		});
		await page.getByRole('button', { name: 'Make My Pledge' }).click();

		// the pledge cannot be accepted until a trigger ("when") is set
		await expect(page.getByRole('heading', { name: 'Make Your Pledge' })).toBeVisible();
		const accept = page.getByRole('button', { name: 'Accept & Begin' });
		await expect(accept).toBeDisabled();
		await page.getByPlaceholder('I finish my morning coffee').fill('I finish lunch');
		await expect(accept).toBeEnabled();
	});

	test('an empty catalog shows the calm empty state, never a broken grid', async ({
		page,
		context,
		mockApi,
		testId,
		gotoHydrated
	}) => {
		skipIfIntegration('overrides the trail catalog to empty');

		const walker = makeActor(testId, 'walker');
		await registerActors(mockApi, walker);
		await actAs(context, mockApi, walker);

		// the catalog comes back empty; the browser must land on the empty state, not a
		// skeleton stuck forever or a "no trails" flash before the fetch resolves
		await mockApi.set({
			method: 'GET',
			path: /^\/v2\/users\/trails$/,
			body: { items: [] },
			once: false
		});

		await gotoHydrated('/trails');
		await expect(page.getByRole('heading', { name: 'Curiosity Trails' })).toBeVisible({
			timeout: 15000
		});
		await expect(page.getByText('No Trails Here Yet. Check Back Soon.')).toBeVisible({
			timeout: 12000
		});
		// no trail cards rendered
		await expect(page.locator('[data-trail-id]')).toHaveCount(0);
	});

	test('full practice: pledge -> presence -> reflect -> reveal -> ring + journal', async ({
		page,
		context,
		mockApi,
		testId,
		gotoHydrated
	}) => {
		skipIfIntegration('drives the standalone trail run + nature-minutes credit');

		const walker = makeActor(testId, 'walker');
		await registerActors(mockApi, walker);
		await actAs(context, mockApi, walker);

		await gotoHydrated('/trails');
		await expect(page.getByRole('heading', { name: 'Neighborhood Wonders' })).toBeVisible({
			timeout: 15000
		});

		// scope to trail-1 (the catalog is rarity-then-title sorted, so it isn't first)
		await page
			.locator('[data-trail-id="trail-1"]')
			.getByRole('button', { name: 'Begin Trail' })
			.click();

		// intro -> pledge
		await page.getByRole('button', { name: 'Make My Pledge' }).click();
		await page.getByPlaceholder('I finish my morning coffee').fill('I step outside');
		await page.getByRole('button', { name: 'Accept & Begin' }).click();

		// presence: log the suggested minutes without needing the timer to run
		const logBtn = page.getByRole('button', { name: /Log \d+ Nature Minutes/ });
		await expect(logBtn).toBeVisible({ timeout: 12000 });
		await logBtn.click();

		// reflect: a private note + a mood, then save
		await expect(page.getByRole('heading', { name: 'A Moment to Reflect' })).toBeVisible();
		await page
			.getByPlaceholder('A few words on what you noticed...')
			.fill('The light kept shifting.');
		await page.getByRole('button', { name: 'Calm', exact: true }).click();
		await page.getByRole('button', { name: 'Save Reflection' }).click();

		// reveal: the awe payoff + the Nature Minutes credit
		await expect(page.getByRole('heading', { name: 'A Small Wonder' })).toBeVisible({
			timeout: 15000
		});
		await expect(page.getByText(/\+\d+ Nature Minutes, just for being out there/)).toBeVisible();
		await page.getByRole('button', { name: 'Finish' }).click();

		// the page ring reflects the credit as a fresh personal best
		await expect(page.locator('#main-content').getByText('Your Longest Yet')).toBeVisible({
			timeout: 12000
		});

		// the reflection is now in the private journal
		await page.getByRole('button', { name: 'Journal' }).click();
		await expect(page.getByText('The light kept shifting.')).toBeVisible({ timeout: 12000 });
	});
});
