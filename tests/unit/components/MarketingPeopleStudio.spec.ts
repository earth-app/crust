import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import PeopleStudio from '~/components/admin/marketing/PeopleStudio.vue';
import type { MarketingScene } from '~/shared/types/marketing';
import type { MockMotdForm, MockNotificationForm, MockUserForm } from '~/shared/utils/marketing';
import {
	MOTD_PRESETS,
	NOTIFICATION_PRESETS,
	PERSONA_PRESETS,
	personaToForm
} from '~/shared/utils/marketing';

const scene = <T>(kind: MarketingScene['kind'], payload: T): MarketingScene<T> => ({
	id: `scene-${kind}`,
	name: `${kind} scene`,
	kind,
	source: 'manual',
	payload,
	created_by: 'admin',
	created_at: '2024-01-01T00:00:00Z',
	updated_at: '2024-01-01T00:00:00Z'
});

describe('AdminMarketingPeopleStudio (display-only)', () => {
	it('renders the mock user card from a user scene', async () => {
		const payload: MockUserForm = personaToForm(PERSONA_PRESETS[0]!);
		const wrapper = await mountSuspended(PeopleStudio, {
			props: { scene: scene('user', payload), displayOnly: true }
		});
		expect(wrapper.text()).toContain(payload.full_name);
		expect(wrapper.text()).toContain(`@${payload.username}`);
	});

	it('renders the real notification cards from a notification scene', async () => {
		const payload: MockNotificationForm[] = NOTIFICATION_PRESETS.map((p) => ({ ...p }));
		const wrapper = await mountSuspended(PeopleStudio, {
			props: { scene: scene('notification', payload), displayOnly: true }
		});
		expect(wrapper.text()).toContain('Quest Complete: Morning Trail');
		expect(wrapper.text()).toContain('New Badge Unlocked!');
	});

	it('renders the MOTD banner from a motd scene', async () => {
		const payload: MockMotdForm = { ...MOTD_PRESETS[0]! };
		const wrapper = await mountSuspended(PeopleStudio, {
			props: { scene: scene('motd', payload), displayOnly: true }
		});
		expect(wrapper.text()).toContain(payload.motd);
	});
});
