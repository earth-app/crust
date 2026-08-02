import { mountSuspended } from '@nuxt/test-utils/runtime';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import EditableValue from '~/components/EditableValue.vue';
import Footer from '~/components/Footer.vue';
import Loading from '~/components/Loading.vue';
import Display from '~/components/user/badge/Display.vue';

/*
 * The shell surfaces: the pieces every page renders, plus the click-only controls that had no
 * keyboard path. These cover the design-system pass rather than feature behaviour -- the colour
 * tokens themselves are asserted in tests/unit/design/.
 */

const RAW_PALETTE =
	/\b[a-z-]+-(?:gray|slate|blue|green|red|amber|yellow|emerald|lime|purple|teal|orange)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/;

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('Loading', () => {
	it('announces itself instead of relying on the spin alone', async () => {
		// the reduced-motion killswitch freezes the spinner, so the state has to be readable
		// without it -- removing motion must not remove information
		const wrapper = await mountSuspended(Loading);

		const status = wrapper.find('[role="status"]');
		expect(status.exists()).toBe(true);
		expect(status.attributes('aria-live')).toBe('polite');
		expect(wrapper.text()).toContain('Loading');
	});

	it('uses a theme-aware spinner colour', async () => {
		// it was text-black, which is invisible against the dark-mode page
		const wrapper = await mountSuspended(Loading);
		expect(wrapper.html()).not.toContain('text-black');
		expect(wrapper.html()).toContain('text-muted');
	});
});

describe('Footer', () => {
	it('renders as a contentinfo landmark', async () => {
		const wrapper = await mountSuspended(Footer);
		expect(wrapper.find('footer[role="contentinfo"]').exists()).toBe(true);
	});

	it('carries no raw palette colour', async () => {
		const wrapper = await mountSuspended(Footer);
		expect(wrapper.html()).not.toMatch(RAW_PALETTE);
	});

	it('drops the text-md class, which tailwind never defined', async () => {
		// it silently did nothing for as long as it shipped
		const wrapper = await mountSuspended(Footer);
		expect(wrapper.html()).not.toMatch(/\btext-md\b/);
	});

	it('gives the social links a 44px touch target', async () => {
		const wrapper = await mountSuspended(Footer);
		const socials = wrapper.findAll('a[target="_blank"]');
		expect(socials.length).toBeGreaterThan(0);
		// size-11 == 44px, applied to the row's children
		expect(wrapper.html()).toContain('*:size-11');
	});
});

describe('EditableValue keyboard parity', () => {
	it('exposes itself as a button rather than a bare div', async () => {
		const wrapper = await mountSuspended(EditableValue, { props: { modelValue: 'hello' } });

		const trigger = wrapper.find('[role="button"]');
		expect(trigger.exists()).toBe(true);
		expect(trigger.attributes('tabindex')).toBe('0');
		expect(trigger.attributes('aria-label')).toBeTruthy();
	});

	it('starts editing on Enter, not only on click', async () => {
		const wrapper = await mountSuspended(EditableValue, { props: { modelValue: 'hello' } });

		await wrapper.find('[role="button"]').trigger('keydown.enter');
		expect(wrapper.find('input').exists()).toBe(true);
	});

	it('starts editing on Space', async () => {
		const wrapper = await mountSuspended(EditableValue, { props: { modelValue: 'hello' } });

		await wrapper.find('[role="button"]').trigger('keydown.space');
		expect(wrapper.find('input').exists()).toBe(true);
	});
});

describe('Badge Display keyboard parity', () => {
	const badge = {
		id: 'b1',
		name: 'Explorer',
		description: 'Walked a trail.',
		icon: 'mdi:pine-tree'
	};

	it('emits on Enter and Space, not only on click', async () => {
		const wrapper = await mountSuspended(Display, {
			props: { badge: badge as never, isGranted: true }
		});

		const trigger = wrapper.find('[role="button"]');
		expect(trigger.exists()).toBe(true);
		expect(trigger.attributes('tabindex')).toBe('0');

		await trigger.trigger('keydown.enter');
		await trigger.trigger('keydown.space');
		expect(wrapper.emitted('clicked')?.length).toBe(2);
	});
});
