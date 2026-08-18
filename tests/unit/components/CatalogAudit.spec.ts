import { mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CatalogAudit from '~/components/admin/CatalogAudit.vue';

const auditResponse = {
	checked: 470,
	counts: { activity: 351, unknown: 80, place: 4, ambiguous: 13 },
	findings: [
		{
			id: 'marina',
			nature: 'place',
			title: 'Marina',
			short_description: 'Dock with moorings for yachts',
			recommendation: 'delete',
			reason: 'names a place or facility, not something to do'
		},
		{
			id: 'watchmaker',
			nature: 'person',
			title: 'Watchmaker',
			short_description: 'Artisan who makes and repairs watches',
			recommendation: 'delete',
			reason: 'names a person or profession, not something to do'
		},
		{
			id: 'pitch',
			nature: 'ambiguous',
			title: 'Pitch',
			short_description: 'Topics referred to by the same term',
			recommendation: 'review',
			reason: 'the title is ambiguous; confirm which meaning was intended'
		}
	],
	generated_at: '2026-08-17T12:00:00.000Z'
};

const fetchMock = vi.fn();

beforeEach(() => {
	fetchMock.mockReset();
	fetchMock.mockResolvedValue(auditResponse);
	vi.stubGlobal('$fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('CatalogAudit', () => {
	it('does not call the audit endpoint until asked', async () => {
		await mountSuspended(CatalogAudit);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('runs the audit and renders every finding', async () => {
		const wrapper = await mountSuspended(CatalogAudit);
		await wrapper.find('button').trigger('click');
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		await wrapper.vm.$nextTick();

		expect(fetchMock).toHaveBeenCalledWith('/api/admin/activity/audit', {
			method: 'POST',
			body: {}
		});

		const text = wrapper.text();
		expect(text).toContain('marina');
		expect(text).toContain('watchmaker');
		expect(text).toContain('pitch');
		expect(text).toContain('470 Checked');
	});

	it('shows the short description as the evidence for each finding', async () => {
		const wrapper = await mountSuspended(CatalogAudit);
		await wrapper.find('button').trigger('click');
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
		await wrapper.vm.$nextTick();

		expect(wrapper.text()).toContain('Dock with moorings for yachts');
	});

	it('surfaces a failure instead of rendering a stale audit', async () => {
		fetchMock.mockRejectedValue(new Error('cloud is down'));
		const wrapper = await mountSuspended(CatalogAudit);
		await wrapper.find('button').trigger('click');
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
		await wrapper.vm.$nextTick();

		expect(wrapper.text()).not.toContain('470 Checked');
	});

	it('reports a clean catalogue rather than an empty list', async () => {
		fetchMock.mockResolvedValue({ ...auditResponse, findings: [], counts: { activity: 470 } });
		const wrapper = await mountSuspended(CatalogAudit);
		await wrapper.find('button').trigger('click');
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
		await wrapper.vm.$nextTick();

		expect(wrapper.text()).toContain('Nothing flagged');
	});

	// deleting an activity affects every user holding it, so the UI must never imply it acted
	it('states that the audit changes nothing', async () => {
		const wrapper = await mountSuspended(CatalogAudit);
		expect(wrapper.text()).toContain('Report only, nothing is changed');
	});
});
