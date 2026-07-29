import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StagedActivities from '~/components/admin/approvals/StagedActivities.vue';

function makeStaged(id: number, name: string, state = 'pending') {
	return {
		id,
		activity: { id: name.toLowerCase().replace(/\s/g, '_'), name, description: 'x', types: [] },
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

let rows: any[] = [];
const approveMock = vi.fn(async (_id: number): Promise<ActionResult> => ({ success: true }));
const denyMock = vi.fn(async (_id: number): Promise<ActionResult> => ({ success: true }));
const listMock = vi.fn(async () => ({
	success: true as const,
	data: { items: rows, total: rows.length }
}));
const toastMock = vi.fn();

mockNuxtImport('useStagedActivities', () => {
	return () => ({ list: listMock, approve: approveMock, deny: denyMock });
});

mockNuxtImport('useToast', () => {
	return () => ({ add: toastMock });
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

// order is select-all, then one per pending row
function checkbox(wrapper: any, index: number) {
	const box = wrapper.findAll('[role="checkbox"]')[index];
	if (!box) throw new Error(`no checkbox at index ${index}`);
	return box;
}

describe('admin staged activities', () => {
	beforeEach(() => {
		rows = [makeStaged(1, 'Bouldering'), makeStaged(2, 'Sea Kayaking')];
		// happy-dom ships no window.confirm, so the component's guard has to be stubbed in
		vi.stubGlobal(
			'confirm',
			vi.fn(() => true)
		);
		approveMock.mockClear();
		denyMock.mockClear();
		listMock.mockClear();
		toastMock.mockClear();
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

	// ids are page-scoped, so a reload must not carry a stale selection forward
	it('drops selected ids that are no longer pending after a reload', async () => {
		const wrapper = await mountLoaded();

		await checkbox(wrapper, 0).trigger('click');
		await wrapper.vm.$nextTick();
		expect(buttonsNamed(wrapper, 'Approve Selected (2)')).toHaveLength(1);

		rows = [makeStaged(1, 'Bouldering'), makeStaged(2, 'Sea Kayaking', 'approved')];
		await (wrapper.vm as any).load();
		await wrapper.vm.$nextTick();

		expect(buttonsNamed(wrapper, 'Approve Selected (1)')).toHaveLength(1);
	});
});
