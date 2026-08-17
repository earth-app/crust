import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StagedActivities from '~/components/admin/approvals/StagedActivities.vue';

function makeStaged(id: number, name: string, state = 'pending', activity: any = {}) {
	return {
		id,
		activity: {
			id: name.toLowerCase().replace(/\s/g, '_'),
			name,
			description: 'x',
			types: [],
			...activity
		},
		note: null,
		state,
		source: 'api',
		submitter: { id: 'org-1', username: 'organizer' },
		submitted_at: '2026-01-01T00:00:00.000Z',
		expires_at: '2026-01-02T00:00:00.000Z',
		expires_in_seconds: 86_400,
		fails_open: false,
		review_notes: null
	};
}

type ActionResult = { success: boolean; message?: string };

// one entry per page; `total` drives the pager, so it is set independently
let pages: any[][] = [];
let total = 0;
const approveMock = vi.fn(async (_id: number): Promise<ActionResult> => ({ success: true }));
const denyMock = vi.fn(async (_id: number): Promise<ActionResult> => ({ success: true }));
const listMock = vi.fn(async (_state: string, page = 1) => ({
	success: true as const,
	data: { items: pages[page - 1] ?? [], total }
}));
const toastMock = vi.fn();

// captured in registration order: [0] is the top bar sentinel, [1] the bottom bar sentinel
const observers: ((entries: any[]) => void)[] = [];

mockNuxtImport('useStagedActivities', () => {
	return () => ({ list: listMock, approve: approveMock, deny: denyMock });
});

mockNuxtImport('useToast', () => {
	return () => ({ add: toastMock });
});

mockNuxtImport('useIntersectionObserver', () => {
	return (_target: any, callback: (entries: any[]) => void) => {
		observers.push(callback);
		return { stop: () => {}, pause: () => {}, resume: () => {}, isActive: ref(true) };
	};
});

async function mountLoaded() {
	const wrapper = await mountSuspended(StagedActivities);
	await vi.waitFor(() => expect(listMock).toHaveBeenCalled());
	await wrapper.vm.$nextTick();
	await wrapper.vm.$nextTick();
	return wrapper;
}

function buttonsNamed(wrapper: any, label: string) {
	return wrapper.findAll('button').filter((button: any) => button.text().trim() === label);
}

function buttonNamed(wrapper: any, label: string) {
	const [button] = buttonsNamed(wrapper, label);
	if (!button) throw new Error(`no button named "${label}"`);
	return button;
}

// order is select-page, then one per pending row
function checkbox(wrapper: any, index: number) {
	const box = wrapper.findAll('[role="checkbox"]')[index];
	if (!box) throw new Error(`no checkbox at index ${index}`);
	return box;
}

function bars(wrapper: any, position: string) {
	return wrapper.findAll(`[data-testid="bulk-bar"][data-position="${position}"]`);
}

async function nextPage(wrapper: any) {
	const calls = listMock.mock.calls.length;
	await buttonNamed(wrapper, 'Next').trigger('click');
	await vi.waitFor(() => expect(listMock.mock.calls.length).toBe(calls + 1));
	await wrapper.vm.$nextTick();
	await wrapper.vm.$nextTick();
}

describe('admin staged activities', () => {
	beforeEach(() => {
		pages = [[makeStaged(1, 'Bouldering'), makeStaged(2, 'Sea Kayaking')]];
		total = 2;
		observers.length = 0;
		// happy-dom ships no window.confirm, so the component's guard has to be stubbed in
		vi.stubGlobal(
			'confirm',
			vi.fn(() => true)
		);
		approveMock.mockClear();
		denyMock.mockClear();
		listMock.mockClear();
		toastMock.mockClear();
		document.body.querySelectorAll('[data-testid="bulk-bar"]').forEach((node) => node.remove());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	// the bulk toolbar renders above the rows, so a shared name makes "the first Approve"
	// resolve to a button that is disabled until something is selected
	it('never gives the bulk toolbar a bare row-action name', async () => {
		const wrapper = await mountLoaded();

		expect(buttonsNamed(wrapper, 'Approve')).toHaveLength(2);
		expect(buttonsNamed(wrapper, 'Deny')).toHaveLength(2);
		expect(buttonsNamed(wrapper, 'Approve Selected')).toHaveLength(1);
		expect(buttonsNamed(wrapper, 'Deny Selected')).toHaveLength(1);
	});

	it('disables the bulk actions until a row is selected', async () => {
		const wrapper = await mountLoaded();

		expect(buttonNamed(wrapper, 'Approve Selected').attributes('disabled')).toBeDefined();

		await checkbox(wrapper, 0).trigger('click');
		await wrapper.vm.$nextTick();

		expect(buttonsNamed(wrapper, 'Approve Selected (2)')).toHaveLength(1);
		expect(buttonNamed(wrapper, 'Approve Selected (2)').attributes('disabled')).toBeUndefined();
	});

	it('approves every selected row and clears the selection', async () => {
		const wrapper = await mountLoaded();

		await checkbox(wrapper, 0).trigger('click');
		await wrapper.vm.$nextTick();
		await buttonNamed(wrapper, 'Approve Selected (2)').trigger('click');
		await vi.waitFor(() => expect(approveMock).toHaveBeenCalledTimes(2));
		await wrapper.vm.$nextTick();

		expect(approveMock.mock.calls.map((call) => call[0])).toEqual([1, 2]);
		expect(toastMock).toHaveBeenCalledWith(
			expect.objectContaining({ title: '2 Activities Published' })
		);
		expect(buttonsNamed(wrapper, 'Approve Selected')).toHaveLength(1);
	});

	it('denies only the rows that were checked', async () => {
		const wrapper = await mountLoaded();

		await checkbox(wrapper, 2).trigger('click');
		await wrapper.vm.$nextTick();
		await buttonNamed(wrapper, 'Deny Selected (1)').trigger('click');
		await vi.waitFor(() => expect(denyMock).toHaveBeenCalledTimes(1));

		expect(denyMock).toHaveBeenCalledWith(2);
		expect(approveMock).not.toHaveBeenCalled();
		expect(toastMock).toHaveBeenCalledWith(
			expect.objectContaining({ title: '1 Submission Denied' })
		);
	});

	it('reports a partial failure instead of a success summary', async () => {
		approveMock.mockImplementationOnce(async () => ({ success: true }));
		approveMock.mockImplementationOnce(async () => ({
			success: false,
			message: 'already published'
		}));
		const wrapper = await mountLoaded();

		await checkbox(wrapper, 0).trigger('click');
		await wrapper.vm.$nextTick();
		await buttonNamed(wrapper, 'Approve Selected (2)').trigger('click');
		await vi.waitFor(() => expect(approveMock).toHaveBeenCalledTimes(2));

		expect(toastMock).toHaveBeenCalledWith(
			expect.objectContaining({
				title: 'Some Actions Failed',
				description: expect.stringContaining('already published')
			})
		);
	});

	// a failed row is still work to do, so it stays checked while the succeeded ones drop out
	it('keeps the rows that failed selected', async () => {
		approveMock.mockImplementationOnce(async () => ({ success: true }));
		approveMock.mockImplementationOnce(async () => ({ success: false, message: 'nope' }));
		const wrapper = await mountLoaded();

		await checkbox(wrapper, 0).trigger('click');
		await wrapper.vm.$nextTick();
		await buttonNamed(wrapper, 'Approve Selected (2)').trigger('click');
		await vi.waitFor(() => expect(approveMock).toHaveBeenCalledTimes(2));
		await wrapper.vm.$nextTick();

		expect(buttonsNamed(wrapper, 'Approve Selected (1)')).toHaveLength(1);
	});

	it('skips the bulk call when the confirm is dismissed', async () => {
		vi.stubGlobal(
			'confirm',
			vi.fn(() => false)
		);
		const wrapper = await mountLoaded();

		await checkbox(wrapper, 0).trigger('click');
		await wrapper.vm.$nextTick();
		await buttonNamed(wrapper, 'Approve Selected (2)').trigger('click');
		await wrapper.vm.$nextTick();

		expect(approveMock).not.toHaveBeenCalled();
	});

	// only the ids the server just reported can be pruned; the rest sit on another page
	it('drops selected ids that are no longer pending after a reload', async () => {
		const wrapper = await mountLoaded();

		await checkbox(wrapper, 0).trigger('click');
		await wrapper.vm.$nextTick();
		expect(buttonsNamed(wrapper, 'Approve Selected (2)')).toHaveLength(1);

		pages = [[makeStaged(1, 'Bouldering'), makeStaged(2, 'Sea Kayaking', 'approved')]];
		await (wrapper.vm as any).load();
		await wrapper.vm.$nextTick();

		expect(buttonsNamed(wrapper, 'Approve Selected (1)')).toHaveLength(1);
	});

	describe('selection across pages', () => {
		beforeEach(() => {
			pages = [
				[makeStaged(1, 'Bouldering'), makeStaged(2, 'Sea Kayaking')],
				[makeStaged(3, 'Trail Running'), makeStaged(4, 'Sport Climbing')]
			];
			// past one page of rows, so Next is live
			total = 120;
		});

		it('carries a selection made on page one over to page two', async () => {
			const wrapper = await mountLoaded();

			await checkbox(wrapper, 1).trigger('click');
			await wrapper.vm.$nextTick();
			expect(buttonsNamed(wrapper, 'Approve Selected (1)')).toHaveLength(1);

			await nextPage(wrapper);

			expect(wrapper.text()).toContain('Trail Running');
			expect(buttonsNamed(wrapper, 'Approve Selected (1)')).toHaveLength(1);
			expect(wrapper.text()).toContain('0 of 2 Selected');
			expect(wrapper.text()).toContain('1 on Other Pages');
		});

		it('acts on every page of the selection in one run', async () => {
			const wrapper = await mountLoaded();

			await checkbox(wrapper, 1).trigger('click');
			await wrapper.vm.$nextTick();
			await nextPage(wrapper);
			await checkbox(wrapper, 1).trigger('click');
			await wrapper.vm.$nextTick();

			expect(buttonsNamed(wrapper, 'Approve Selected (2)')).toHaveLength(1);

			await buttonNamed(wrapper, 'Approve Selected (2)').trigger('click');
			await vi.waitFor(() => expect(approveMock).toHaveBeenCalledTimes(2));

			expect(approveMock.mock.calls.map((call) => call[0])).toEqual([1, 3]);
		});

		it('selects only the current page when Select Page is toggled', async () => {
			const wrapper = await mountLoaded();

			await checkbox(wrapper, 0).trigger('click');
			await wrapper.vm.$nextTick();
			await nextPage(wrapper);

			expect(buttonsNamed(wrapper, 'Approve Selected (2)')).toHaveLength(1);

			await checkbox(wrapper, 0).trigger('click');
			await wrapper.vm.$nextTick();

			expect(buttonsNamed(wrapper, 'Approve Selected (4)')).toHaveLength(1);
			expect(wrapper.text()).toContain('2 of 2 Selected');
			expect(wrapper.text()).toContain('2 on Other Pages');
		});

		it('clears every page of the selection at once', async () => {
			const wrapper = await mountLoaded();

			await checkbox(wrapper, 0).trigger('click');
			await wrapper.vm.$nextTick();
			await nextPage(wrapper);
			await checkbox(wrapper, 0).trigger('click');
			await wrapper.vm.$nextTick();
			expect(buttonsNamed(wrapper, 'Approve Selected (4)')).toHaveLength(1);

			await buttonNamed(wrapper, 'Clear').trigger('click');
			await wrapper.vm.$nextTick();

			expect(buttonsNamed(wrapper, 'Approve Selected')).toHaveLength(1);
		});
	});

	describe('reachable bulk actions', () => {
		it('adds a second toolbar under a list long enough to scroll', async () => {
			pages = [
				Array.from({ length: 6 }, (_, index) => makeStaged(index + 1, `Activity ${index + 1}`))
			];
			total = 6;
			const wrapper = await mountLoaded();

			expect(bars(wrapper, 'top')).toHaveLength(1);
			expect(bars(wrapper, 'bottom')).toHaveLength(1);
		});

		it('leaves a short list with a single toolbar', async () => {
			const wrapper = await mountLoaded();

			expect(bars(wrapper, 'top')).toHaveLength(1);
			expect(bars(wrapper, 'bottom')).toHaveLength(0);
		});

		// the island is for the scrolled-past case only; an unlaid-out sentinel reports
		// "not intersecting" too, and floating on that would cover a page nobody scrolled
		it('floats an island once the top toolbar has scrolled above the viewport', async () => {
			await mountLoaded();
			const floating = () => document.body.querySelectorAll('[data-position="floating"]').length;

			expect(floating()).toBe(0);

			observers[0]?.([{ isIntersecting: false, boundingClientRect: { bottom: 0 } }]);
			await nextTick();
			expect(floating()).toBe(0);

			observers[0]?.([{ isIntersecting: false, boundingClientRect: { bottom: -120 } }]);
			await nextTick();
			expect(floating()).toBe(1);

			observers[0]?.([{ isIntersecting: true, boundingClientRect: { bottom: 200 } }]);
			await nextTick();
			expect(floating()).toBe(0);
		});

		it('drops the island while the bottom toolbar is on screen', async () => {
			pages = [
				Array.from({ length: 6 }, (_, index) => makeStaged(index + 1, `Activity ${index + 1}`))
			];
			total = 6;
			await mountLoaded();
			const floating = () => document.body.querySelectorAll('[data-position="floating"]').length;

			observers[0]?.([{ isIntersecting: false, boundingClientRect: { bottom: -120 } }]);
			await nextTick();
			expect(floating()).toBe(1);

			observers[1]?.([{ isIntersecting: true, boundingClientRect: { bottom: 400 } }]);
			await nextTick();
			expect(floating()).toBe(0);
		});
	});

	describe('risk flagger', () => {
		function flags(wrapper: any) {
			return wrapper
				.findAll('[data-testid="risk-flag"]')
				.map((node: any) => node.attributes('data-tier'));
		}

		it('marks a submission carrying a link as suspicious', async () => {
			pages = [
				[
					makeStaged(1, 'Bouldering', 'pending', {
						description: 'Book your session now at https://spam.example for a discount.',
						types: ['HOBBY']
					})
				]
			];
			total = 1;
			const wrapper = await mountLoaded();

			expect(flags(wrapper)).toEqual(['suspicious']);
		});

		it('marks a well formed submission as safe', async () => {
			pages = [
				[
					makeStaged(1, 'Bouldering', 'pending', {
						description:
							'Climbing short, powerful routes on low walls without ropes. Falls are caught by crash pads and a spotter, so the focus stays on movement.',
						types: ['HOBBY', 'SPORT'],
						aliases: ['Problem Climbing'],
						fields: { icon: 'mdi:terrain' }
					})
				]
			];
			total = 1;
			const wrapper = await mountLoaded();

			expect(flags(wrapper)).toEqual(['safe']);
		});

		it('leaves a resolved row unflagged', async () => {
			pages = [[makeStaged(1, 'Bouldering', 'approved', { description: 'go to spam.example' })]];
			total = 1;
			const wrapper = await mountLoaded();

			expect(flags(wrapper)).toEqual([]);
		});

		it('counts the flagged rows inside the selection', async () => {
			pages = [
				[
					makeStaged(1, 'Bouldering', 'pending', {
						description: 'Book now at https://spam.example',
						types: ['HOBBY']
					}),
					makeStaged(2, 'Sea Kayaking', 'pending', {
						description:
							'Paddling a sit-in kayak across open salt water. Trips follow the coast and turn back before the afternoon wind builds.',
						types: ['HOBBY']
					})
				]
			];
			total = 2;
			const wrapper = await mountLoaded();

			await checkbox(wrapper, 0).trigger('click');
			await wrapper.vm.$nextTick();

			expect(wrapper.find('[data-testid="bulk-flagged"]').text()).toBe('1 Flagged');
		});

		it('warns in the approve confirm when the selection is flagged', async () => {
			const confirmMock = vi.fn(() => true);
			vi.stubGlobal('confirm', confirmMock);
			pages = [
				[
					makeStaged(1, 'Bouldering', 'pending', {
						description: 'Book now at https://spam.example',
						types: ['HOBBY']
					})
				]
			];
			total = 1;
			const wrapper = await mountLoaded();

			await checkbox(wrapper, 0).trigger('click');
			await wrapper.vm.$nextTick();
			await buttonNamed(wrapper, 'Approve Selected (1)').trigger('click');
			await vi.waitFor(() => expect(approveMock).toHaveBeenCalled());

			expect(confirmMock).toHaveBeenCalledWith(
				expect.stringContaining('1 of them is flagged as suspicious')
			);
		});
	});
});
