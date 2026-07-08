/**
 * Component test for `src/pages/login/index.vue`.
 *
 * Regression (item 13, symptom 3 — double toast): a fresh login must redirect
 * SILENTLY. The page's own "Already Logged In" info toast may only fire for a
 * visit that was ALREADY authenticated at mount, so it never stacks on top of
 * Form.vue's sole "Login Successful" success toast.
 */

import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import LoginPage from '~/pages/login/index.vue';

const user = ref<any>(null);
const toastAdd = vi.fn();
const replaceSpy = vi.fn();

mockNuxtImport('useAuth', () => {
	return () => ({ user, fetchUser: vi.fn(), sendResetPasswordEmail: vi.fn() });
});
mockNuxtImport('useToast', () => {
	return () => ({ add: toastAdd });
});
mockNuxtImport('useRouter', () => {
	// nuxt's own boot calls useRouter().beforeEach/afterEach/beforeResolve, so the mock
	// must implement them (each returns an unregister fn) or app init throws before mount
	return () =>
		({
			replace: replaceSpy,
			push: vi.fn(),
			beforeEach: vi.fn(() => () => {}),
			afterEach: vi.fn(() => () => {}),
			beforeResolve: vi.fn(() => () => {}),
			onError: vi.fn(() => () => {}),
			isReady: vi.fn(() => Promise.resolve()),
			resolve: vi.fn((to: any) => ({ href: typeof to === 'string' ? to : (to?.path ?? '/') })),
			getRoutes: vi.fn(() => []),
			currentRoute: ref({
				query: {},
				params: {},
				path: '/login',
				fullPath: '/login',
				hash: '',
				name: 'login',
				matched: [],
				meta: {}
			}),
			options: { routes: [] }
		}) as any;
});
mockNuxtImport('useRoute', () => {
	return () => ({
		query: {},
		params: {},
		path: '/login',
		fullPath: '/login',
		hash: '',
		name: 'login',
		matched: [],
		meta: {}
	});
});
mockNuxtImport('useSiteTour', () => {
	return () => ({ startTour: vi.fn() });
});
mockNuxtImport('useTitleSuffix', () => {
	return () => ({ setTitleSuffix: vi.fn() });
});

const mkUser = () => ({ id: 'u1', username: 'alice' });

const mountOpts = {
	global: {
		stubs: {
			UserOAuthButton: true,
			UserLoginForm: true,
			SiteTour: true,
			ClientOnly: { template: '<div><slot /></div>' }
		}
	}
};

describe('login page toast behavior', () => {
	beforeEach(() => {
		user.value = null;
		toastAdd.mockClear();
		replaceSpy.mockClear();
	});

	it('does NOT toast when the user resolves AFTER mount (a fresh login)', async () => {
		const wrapper = await mountSuspended(LoginPage, mountOpts);
		toastAdd.mockClear(); // ignore any setup-time noise (empty query -> none expected)

		// simulate useLogin populating currentUser after the page mounted
		user.value = mkUser();
		await nextTick();
		await nextTick();

		// the page stays silent; Form.vue owns the sole "Login Successful" toast
		expect(toastAdd).not.toHaveBeenCalled();
		// but it still performs the redirect
		expect(replaceSpy).toHaveBeenCalled();
		wrapper.unmount();
	});

	it('greets a genuinely already-authenticated visit with exactly one info toast', async () => {
		user.value = mkUser(); // authenticated at mount
		const wrapper = await mountSuspended(LoginPage, mountOpts);
		await nextTick();

		const alreadyLoggedIn = toastAdd.mock.calls.filter((c) => c[0]?.title === 'Already Logged In');
		expect(alreadyLoggedIn).toHaveLength(1);
		expect(replaceSpy).toHaveBeenCalled();
		wrapper.unmount();
	});
});
