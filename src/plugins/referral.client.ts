const CODE_REGEX = /^[0-9A-HJKMNP-TV-Z]{6}$/;

export default defineNuxtPlugin(() => {
	const route = useRoute();
	const raw = route.query.ref;
	const code = (Array.isArray(raw) ? raw[0] : raw)?.toString().trim().toUpperCase();

	if (!code || !CODE_REGEX.test(code)) return;

	const cookie = useCookie('referral_code', {
		maxAge: 60 * 60 * 24 * 30,
		sameSite: 'lax'
	});
	cookie.value = code;

	$fetch('/api/user/referral/click', {
		method: 'POST',
		body: { code }
	}).catch(() => {
		// best effort — a failed click ping shouldn't surface to the visitor
	});
});
