<template>
	<div class="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
		<UIcon
			name="mdi:account-multiple-plus"
			class="size-12 text-primary"
		/>
		<h1 class="text-2xl font-semibold">You've been invited</h1>
		<p class="text-muted max-w-md">Taking you to sign up — quests, badges, and friends await.</p>
		<UIcon
			name="mdi:loading"
			class="size-6 animate-spin text-muted"
		/>
	</div>
</template>

<script setup lang="ts">
// captures the invite code (cookie + click ping) then forwards to signup.
const CODE_REGEX = /^[0-9A-HJKMNP-TV-Z]{6}$/;

const route = useRoute();
const raw = route.params.code;
const code = (Array.isArray(raw) ? raw[0] : raw)?.toString().trim().toUpperCase() ?? '';

onMounted(async () => {
	if (!code || !CODE_REGEX.test(code)) {
		await navigateTo('/signup');
		return;
	}

	const cookie = useCookie('referral_code', {
		maxAge: 60 * 60 * 24 * 30,
		sameSite: 'lax'
	});
	cookie.value = code;

	// best-effort click ping (the referral.client plugin only fires on ?ref=)
	await $fetch('/api/user/referral/click', {
		method: 'POST',
		body: { code }
	}).catch(() => {});

	await navigateTo(`/signup?ref=${code}`);
});
</script>
