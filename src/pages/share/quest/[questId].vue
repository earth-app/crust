<template>
	<div class="flex flex-col items-center justify-center min-h-[80vh] gap-6 px-6 py-12 text-center">
		<h1 class="text-2xl sm:text-3xl font-bold max-w-xl">
			Someone completed a quest on The Earth App
		</h1>
		<p class="text-muted max-w-md">
			Quests turn the activities you love into guided adventures - steps, rewards, and a satisfying
			finish. Join in and start your own.
		</p>

		<div class="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border border-default">
			<img
				:src="ogImage"
				alt="Quest achievement card"
				class="w-full h-auto block"
				width="1200"
				height="630"
				loading="eager"
			/>
		</div>

		<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-2">
			<UButton
				icon="mdi:account-plus"
				color="success"
				size="lg"
				@click="goSignup"
			>
				Join The Earth App
			</UButton>
			<UButton
				icon="mdi:map-marker-path"
				color="primary"
				variant="soft"
				size="lg"
				@click="$router.push('/activities')"
			>
				Explore Quests
			</UButton>
		</div>
	</div>
</template>

<script setup lang="ts">
// public acquisition landing page for a shared quest achievement card. server-rendered
// so a posted link produces a rich preview; the og:image points straight at the
// public, cacheable mantle card route (no auth required).
const CODE_REGEX = /^[0-9A-HJKMNP-TV-Z]{6}$/;

const route = useRoute();
const config = useRuntimeConfig();

const questId = (
	Array.isArray(route.params.questId) ? route.params.questId[0] : route.params.questId
)?.toString();
const userId = (Array.isArray(route.query.u) ? route.query.u[0] : route.query.u)?.toString();
const refCode = (Array.isArray(route.query.ref) ? route.query.ref[0] : route.query.ref)
	?.toString()
	.trim()
	.toUpperCase();

const ogImage = computed(
	() => `${config.public.apiBaseUrl}/v2/users/${userId ?? ''}/share/quest/${questId ?? ''}`
);

const signupTarget = computed(() =>
	refCode && CODE_REGEX.test(refCode) ? `/signup?ref=${refCode}` : '/signup'
);

useSeoMeta({
	title: 'Quest Completed on The Earth App',
	ogTitle: 'I completed a quest on The Earth App',
	ogDescription:
		'See the achievement and start your own quest - discover activities, earn Impact Points, and meet your people.',
	ogImage: () => ogImage.value,
	twitterCard: 'summary_large_image',
	twitterImage: () => ogImage.value
});

// capture attribution client-side (mirrors referral.client.ts) so the inviter gets credit.
onMounted(async () => {
	if (!refCode || !CODE_REGEX.test(refCode)) return;

	const cookie = useCookie('referral_code', {
		maxAge: 60 * 60 * 24 * 30,
		sameSite: 'lax'
	});
	cookie.value = refCode;

	await $fetch('/api/user/referral/click', {
		method: 'POST',
		body: { code: refCode }
	}).catch(() => {
		// best effort - a failed click ping shouldn't surface to the visitor
	});
});

function goSignup() {
	void navigateTo(signupTarget.value);
}
</script>
