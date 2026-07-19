import { mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { useGeoPermission } from '~/composables/useGeoPermission';

const harness = defineComponent({
	setup() {
		return useGeoPermission();
	},
	render() {
		return h('div', String((this as unknown as { state: string }).state));
	}
});

function setNav(prop: string, value: unknown) {
	Object.defineProperty(navigator, prop, { value, configurable: true, writable: true });
}

const flush = () => new Promise((r) => setTimeout(r, 0));

let fakeStatus: { state: string; onchange: null | (() => void) };
const query = vi.fn();

beforeEach(() => {
	fakeStatus = { state: 'prompt', onchange: null };
	query.mockReset();
	query.mockResolvedValue(fakeStatus);
	setNav('geolocation', {});
	setNav('permissions', { query });
});

afterEach(() => {
	setNav('permissions', undefined);
});

describe('useGeoPermission', () => {
	it('reads the live permission from the Permissions API on mount', async () => {
		const wrapper = await mountSuspended(harness);
		await flush();
		expect(query).toHaveBeenCalledWith({ name: 'geolocation' });
		expect(wrapper.vm.state).toBe('prompt');
		expect(wrapper.vm.view.ready).toBe(false);
	});

	it('starts denied when the browser has blocked location', async () => {
		fakeStatus.state = 'denied';
		const wrapper = await mountSuspended(harness);
		await flush();
		expect(wrapper.vm.state).toBe('denied');
		expect(wrapper.vm.view.blocked).toBe(true);
	});

	it('updates live when the user grants without a reload (onchange)', async () => {
		const wrapper = await mountSuspended(harness);
		await flush();
		expect(wrapper.vm.state).toBe('prompt');

		// browser flips the permission; the PermissionStatus fires onchange
		fakeStatus.state = 'granted';
		expect(typeof fakeStatus.onchange).toBe('function');
		fakeStatus.onchange?.();
		await nextTick();

		expect(wrapper.vm.state).toBe('granted');
		expect(wrapper.vm.view.ready).toBe(true);
	});

	it('recheck() re-reads the current state on demand', async () => {
		const wrapper = await mountSuspended(harness);
		await flush();

		fakeStatus.state = 'granted';
		const result = await wrapper.vm.recheck();
		expect(result).toBe('granted');
		expect(wrapper.vm.state).toBe('granted');
	});

	it('falls back to unknown when the Permissions API is unavailable', async () => {
		setNav('permissions', undefined);
		const wrapper = await mountSuspended(harness);
		await flush();
		expect(wrapper.vm.state).toBe('unknown');
		// unknown still offers a manual re-check
		expect(wrapper.vm.view.canRetry).toBe(true);
	});

	it('reports unsupported when the browser has no geolocation', async () => {
		setNav('geolocation', undefined);
		const wrapper = await mountSuspended(harness);
		await flush();
		expect(wrapper.vm.state).toBe('unsupported');
	});

	it('settles to unknown if the permissions query rejects', async () => {
		query.mockRejectedValue(new Error('nope'));
		const wrapper = await mountSuspended(harness);
		await flush();
		expect(wrapper.vm.state).toBe('unknown');
	});
});
