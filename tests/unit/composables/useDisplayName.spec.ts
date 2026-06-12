import { createPinia, setActivePinia } from 'pinia';
import { DEFAULT_FULL_NAME } from 'types/user';
import { beforeEach, describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { useDisplayName } from '~/composables/useUser';

// useDisplayName wraps getUserDisplayName / realFullName, the real branching is:
// full_name wins unless it's the DEFAULT_FULL_NAME placeholder, else username, else anonymous;
// handle prefixes @ only on the username fallback (never on a real full name).

describe('useDisplayName', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it('prefers a real full name for both name and handle', () => {
		const { name, handle, fullName, hasFullName } = useDisplayName({
			full_name: 'Ada Lovelace',
			username: 'ada'
		});

		expect(name.value).toBe('Ada Lovelace');
		// handle does not @-prefix a real full name
		expect(handle.value).toBe('Ada Lovelace');
		expect(fullName.value).toBe('Ada Lovelace');
		expect(hasFullName.value).toBe(true);
	});

	it('treats the DEFAULT_FULL_NAME placeholder as no full name', () => {
		const { name, handle, fullName, hasFullName } = useDisplayName({
			full_name: DEFAULT_FULL_NAME,
			username: 'ada'
		});

		// placeholder ignored -> fall back to username
		expect(name.value).toBe('ada');
		expect(handle.value).toBe('@ada');
		expect(fullName.value).toBeUndefined();
		expect(hasFullName.value).toBe(false);
	});

	it('falls back to username and @-prefixes the handle when no full name', () => {
		const { name, handle } = useDisplayName({ username: 'ada' });

		expect(name.value).toBe('ada');
		expect(handle.value).toBe('@ada');
	});

	it('uses the default anonymous label for a null user', () => {
		const { name, handle, hasFullName } = useDisplayName(null);

		expect(name.value).toBe('anonymous');
		expect(handle.value).toBe('anonymous');
		expect(hasFullName.value).toBe(false);
	});

	it('honors a custom anonymous label for a missing user', () => {
		const { name, handle } = useDisplayName(undefined, { anonymous: 'Guest' });

		expect(name.value).toBe('Guest');
		// anonymous fallback is not @-prefixed
		expect(handle.value).toBe('Guest');
	});

	it('reacts to a changing ref source', () => {
		const user = ref<{ full_name?: string; username?: string } | null>({ username: 'ada' });
		const { name, handle } = useDisplayName(user);

		expect(name.value).toBe('ada');
		expect(handle.value).toBe('@ada');

		user.value = { full_name: 'Ada Lovelace', username: 'ada' };
		expect(name.value).toBe('Ada Lovelace');
		expect(handle.value).toBe('Ada Lovelace');

		user.value = null;
		expect(name.value).toBe('anonymous');
	});

	it('accepts a getter source', () => {
		const { name } = useDisplayName(() => ({ username: 'grace' }));
		expect(name.value).toBe('grace');
	});
});
