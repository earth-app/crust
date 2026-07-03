<template>
	<nav
		id="navbar"
		aria-label="Main navigation"
		class="bg-secondary-800 border-b-primary-500 border-b-8 text-white p-4 flex items-center"
	>
		<div
			class="flex items-center max-w-40 sm:max-w-60 lg:max-w-none lg:flex-1 lg:min-w-0 gap-1 sm:gap-2"
		>
			<NuxtLink to="/">
				<NuxtImg
					src="/favicon.png"
					alt="Earth App Logo"
					format="webp"
					width="48"
					height="48"
					class="min-w-8 w-8 h-auto xl:w-12 inline-block shadow-lg shadow-black/50 rounded-full hover:scale-105 transition-transform duration-300"
					loading="eager"
					decoding="async"
				/>
			</NuxtLink>
			<div class="flex shrink-0 sm:ml-2">
				<Discover />
			</div>
			<div class="hidden lg:flex items-center justify-start gap-3 xl:gap-6 min-w-0 ml-2 xl:ml-6">
				<NuxtLink
					to="/activities"
					class="text-lg xl:text-xl font-semibold hover:text-gray-300 whitespace-nowrap"
					>Activities</NuxtLink
				>
				<NuxtLink
					to="/prompts"
					class="text-lg xl:text-xl font-semibold hover:text-gray-300 whitespace-nowrap"
					>Prompts</NuxtLink
				>
				<NuxtLink
					to="/articles"
					class="text-lg xl:text-xl font-semibold hover:text-gray-300 whitespace-nowrap"
					>Articles</NuxtLink
				>
				<NuxtLink
					to="/events"
					class="text-lg xl:text-xl font-semibold hover:text-gray-300 whitespace-nowrap"
					>Events</NuxtLink
				>
			</div>
		</div>
		<div class="ml-auto min-w-0 shrink-0">
			<ClientOnly
				fallback-tag="div"
				class="flex items-center"
			>
				<div
					v-if="user"
					class="flex items-center gap-1 sm:gap-2 lg:gap-3"
				>
					<div
						class="flex items-center gap-1 md:gap-2 cursor-pointer hover:opacity-80 transition-opacity duration-250 min-w-0"
						@click="$router.push(`/profile/@${user.username}`)"
					>
						<UAvatar
							:src="avatar128"
							class="size-6 sm:size-8 lg:size-10 xl:size-12 rounded-full shadow-lg shadow-black/50 shrink-0"
						/>

						<span
							class="hidden xl:inline text-md sm:text-lg xl:text-xl text-shadow-2xs text-shadow-black truncate max-w-32 2xl:max-w-none"
							>{{ user.username }}</span
						>
					</div>
					<div class="flex gap-1 sm:gap-2 items-center justify-center">
						<UButton
							v-if="currentQuest"
							id="daily-quest-chip"
							size="sm"
							color="warning"
							variant="soft"
							icon="mdi:compass-rose"
							:title="`Continue Quest: ${currentQuest.quest.title}`"
							:aria-label="`Continue Quest: ${currentQuest.quest.title}`"
							class="rounded-full"
							@click="openCurrentQuest"
						>
							<span class="hidden xl:inline">Continue Quest</span>
						</UButton>
						<UButton
							v-else-if="dailyQuest"
							id="daily-quest-chip"
							size="sm"
							color="primary"
							variant="soft"
							icon="mdi:compass-rose"
							:title="`Today's Quest: ${dailyQuest.title}`"
							:aria-label="`Today's Quest: ${dailyQuest.title}`"
							class="rounded-full"
							@click="openDailyQuest"
						>
							<span class="hidden xl:inline">Today's Quest</span>
						</UButton>
						<NuxtLink
							to="/profile/notifications"
							class="size-6 lg:size-7 relative"
							id="notifications"
						>
							<UChip
								:color="chipColor"
								:show="unreadCount > 0"
								:ui="{ base: 'size-2 lg:size-3' }"
								class="m-0"
							>
								<UIcon
									name="mdi:bell"
									class="size-6 lg:size-7 hover:cursor-pointer"
								/>
							</UChip>
						</NuxtLink>
						<NuxtLink
							class="size-6 lg:size-7"
							to="/profile"
							id="settings"
						>
							<UIcon
								name="material-symbols:settings-rounded"
								class="size-6 lg:size-7 text-white cursor-pointer hover:scale-105 transition-transform duration-300"
							/>
						</NuxtLink>
						<NuxtLink
							class="size-6 lg:size-7"
							:to="`/profile/@${user.username}/badges`"
							title="Your Badges"
							id="badges"
						>
							<UIcon
								name="mdi:shield-star-outline"
								class="size-6 lg:size-7 text-primary cursor-pointer hover:scale-105 transition-transform duration-300"
							/>
						</NuxtLink>
						<NuxtLink
							class="size-6 lg:size-7"
							to="/profile/quests/"
							title="Your Quests"
							id="quests"
						>
							<UIcon
								name="mdi:sword"
								class="size-6 lg:size-7 text-warning cursor-pointer hover:scale-105 transition-transform duration-300"
							/>
						</NuxtLink>
						<ThemeToggle />
						<NuxtLink
							class="md:ml-3 size-6 lg:size-7"
							to="/"
						>
							<UIcon
								name="material-symbols:logout-rounded"
								class="size-6 lg:size-7 text-red-500 cursor-pointer hover:scale-105 transition-transform duration-300"
								@click="logoutUser"
							/>
						</NuxtLink>
					</div>
				</div>
				<div
					v-else-if="user === null"
					class="flex items-center"
				>
					<LazyUserSignupPopup hydrate-on-interaction />
					<LazyUserLoginPopup hydrate-on-interaction />
				</div>
			</ClientOnly>
		</div>
	</nav>
	<ClientOnly>
		<LazyUBanner
			v-if="user?.account.email && user?.account.email_verified === false"
			class="mb-4"
			icon="mdi:email-alert"
			title="Your email is unverified. Please verify your email to access all features."
			color="warning"
			:ui="{ root: 'flex items-center', title: 'font-semibold' }"
			:actions="actions"
			close
		>
		</LazyUBanner>
		<UserEmailVerificationModal
			v-model:open="emailVerificationOpen"
			@verified="
				() => {
					if (user) {
						user.account.email_verified = true;
					}

					emailVerificationOpen = false;
				}
			"
		/>
	</ClientOnly>
	<LazyUBanner
		v-if="motd.motd"
		id="motd"
		class="mb-4"
		:icon="motd.icon || 'mdi:earth'"
		:title="motd.motd"
		:color="motd.type || 'info'"
		:actions="
			motd.link
				? [
						{
							label: 'Learn More',
							color: 'neutral',
							variant: 'outline',
							trailingIcon: 'mdi:arrow-right',
							onClick: openMotdLink,
							size: 'sm',
							ui: { base: 'hover:cursor-pointer' }
						}
					]
				: []
		"
		:ui="{ root: 'flex items-center', title: 'font-semibold' }"
		close
	/>
	<nav
		aria-label="Mobile section navigation"
		class="flex gap-2 flex-wrap mt-2 ml-2 lg:hidden"
	>
		<NuxtLink to="/activities">
			<UBadge
				variant="subtle"
				color="info"
				size="xl"
				icon="mdi:run"
				>Activities</UBadge
			>
		</NuxtLink>
		<NuxtLink to="/prompts">
			<UBadge
				variant="subtle"
				color="warning"
				size="xl"
				icon="mdi:lightbulb-on-outline"
				>Prompts</UBadge
			>
		</NuxtLink>
		<NuxtLink to="/articles">
			<UBadge
				variant="subtle"
				color="secondary"
				size="xl"
				icon="mdi:newspaper"
				>Articles</UBadge
			>
		</NuxtLink>
		<NuxtLink to="/events">
			<UBadge
				variant="subtle"
				color="success"
				size="xl"
				icon="mdi:calendar-star"
				>Events</UBadge
			>
		</NuxtLink>
	</nav>
</template>

<script setup lang="ts">
const { user, avatar128, sendVerificationEmail } = useAuth();
const userId = computed(() => user.value?.id);

const toast = useToast();
const router = useRouter();
const logout = useLogout();
const { motd, fetchMotd } = useMotd();

const { quest: dailyQuest, markTapped: markDailyQuestTapped } = useDailyQuest();
const { quest: currentQuest, fetchUserQuest } = useUser(userId);

function openDailyQuest() {
	markDailyQuestTapped();
	if (!dailyQuest.value) return;
	router.push({ path: '/profile/quests/', query: { open: dailyQuest.value.id } });
}

function openCurrentQuest() {
	if (!currentQuest.value) return;
	router.push({ path: '/profile/quests/', query: { open: currentQuest.value.questId } });
}

async function openMotdLink() {
	if (!motd.value.link) return;
	await navigateTo(motd.value.link, {
		external: motd.value.link.startsWith('http')
	});
}

onMounted(() => {
	// motd is a non-critical banner; defer its fetch off the hydration path so
	// it doesn't compete with above-the-fold content.
	const run = () => {
		void fetchMotd();
	};

	if (typeof window !== 'undefined') {
		const ric = (window as any).requestIdleCallback as
			((cb: IdleRequestCallback, opts?: IdleRequestOptions) => number) | undefined;
		if (ric) ric(() => run(), { timeout: 2_000 });
		else setTimeout(run, 0);
	}
});

watch(
	userId,
	(id) => {
		if (id) void fetchUserQuest();
	},
	{ immediate: true }
);

if (import.meta.client) {
	watch(
		() => !!currentQuest.value || !!dailyQuest.value,
		(hasChip) => {
			if (!hasChip) return;
			try {
				void prefetchComponents(['UserQuestModal', 'UserQuestTimeline']);
			} catch {
				// best-effort prefetch; ignore failures
			}
		},
		{ immediate: true }
	);
}

async function logoutUser() {
	const result = await logout();
	if (!result.success) {
		toast.add({
			title: 'Logout Failed',
			description: result.message || 'Unable to log out right now. Please try again.',
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 4000
		});
		return;
	}

	refreshNuxtData('user-current'); // Invalidate user data

	toast.add({
		title: 'Logged out',
		description: 'You have successfully logged out.',
		icon: 'mdi:logout',
		color: 'success',
		duration: 3000
	});
}

const { hasWarnings, hasErrors, unreadCount } = useNotifications();
const chipColor = computed(() => {
	if (hasErrors.value) return 'error';
	if (hasWarnings.value) return 'warning';
	if (unreadCount.value > 0) return 'info';

	return 'neutral';
});

const emailVerificationOpen = ref(false);
const actions = ref<
	{
		label: string;
		color: 'info' | 'neutral';
		variant: 'outline' | 'solid';
		trailingIcon: string;
		ui?: any;
		onClick: () => void;
	}[]
>([
	{
		label: 'Verify',
		color: 'info',
		variant: 'solid',
		trailingIcon: 'mdi:email-outline',
		ui: { base: 'hover:cursor-pointer' },
		onClick: () => {
			router.push('/verify-email');
		}
	},
	{
		label: 'Resend',
		color: 'neutral',
		variant: 'outline',
		trailingIcon: 'mdi:email-arrow-right',
		ui: { base: 'hover:cursor-pointer' },
		onClick: async () => {
			const result = await resendEmailVerification();
			if (result) {
				emailVerificationOpen.value = true;
			}
		}
	}
]);

async function resendEmailVerification(): Promise<boolean> {
	if (!user.value) return false;

	if (user.value.account.email_verified) {
		toast.add({
			title: 'Email Already Verified',
			description: 'Your email is already verified.',
			icon: 'mdi:check-circle',
			color: 'info',
			duration: 3000
		});
		return false;
	}

	if (user.value.email_change_pending) {
		toast.add({
			title: 'Email Change Pending',
			description: 'You have a pending email change. Please verify your new email address.',
			icon: 'mdi:email-arrow-right',
			color: 'info',
			duration: 3000
		});
		return false;
	}

	sendVerificationEmail().then((res) => {
		if (valid(res)) {
			toast.add({
				title: 'Verification Email Sent',
				description: 'A verification email has been sent to your email address.',
				icon: 'mdi:check-circle',
				color: 'success',
				duration: 3000
			});
		} else {
			toast.add({
				title: 'Error Sending Email',
				description: res.message || 'An error occurred while sending the verification email.',
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 5000
			});
		}
	});

	return true;
}
</script>
