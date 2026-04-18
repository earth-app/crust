<template>
	<UPricingPlans>
		<UPricingPlan
			v-for="(plan, index) in plans"
			:key="index"
			v-bind="plan"
		/>
	</UPricingPlans>
</template>

<script setup lang="ts">
import type { PricingPlanProps } from '@nuxt/ui';

const { user } = useAuth();
const currentPlan = computed(() => {
	if (!user.value) return 'FREE';
	return user.value.account.account_type;
});

function getButtonLabel(planType: string) {
	if (!user.value) return 'Sign Up';
	const order = ['FREE', 'PRO', 'WRITER', 'ORGANIZER'];
	const currentIndex = order.indexOf(currentPlan.value);
	const planIndex = order.indexOf(planType);
	if (currentIndex === planIndex) return 'Current Plan';

	return planIndex < currentIndex ? 'Downgrade' : 'Upgrade';
}

// pricing plan lists
const free: PricingPlanProps = {
	title: 'Free',
	description: 'Perfect for those just starting their journey',
	price: '$0',
	features: [
		{
			title: 'Access to basic features',
			icon: 'mdi:check'
		},
		{
			title: 'Save up to 10 activities',
			icon: 'mdi:content-save'
		},
		{
			title: 'Uninterrupted, ad-free experience',
			icon: 'mdi:web'
		},
		{
			title: 'Access to free quests, activities, and articles',
			icon: 'mdi:sword-cross'
		},
		{
			title: 'Create one prompt at any time',
			icon: 'mdi:message-text'
		},
		{
			title: 'Create up to 10 private events',
			icon: 'mdi:calendar'
		},
		{
			title: 'Host an event with up to 25 attendees',
			icon: 'mdi:account-group'
		},
		{
			title: 'Foster your circle with up to 25 friends',
			icon: 'mdi:account-multiple-plus'
		}
	],
	button: {
		label: getButtonLabel('FREE')
	}
};

const pro: PricingPlanProps = {
	title: 'Pro',
	description: 'For the dedicated adventurer looking to level up their experience',
	price: '$5.99/mo',
	features: [
		{
			title: 'Everything in Free',
			icon: 'mdi:check'
		},
		{
			title: 'Create up to 50 public and private events',
			icon: 'mdi:calendar-star'
		},
		{
			title: 'Host an event with up to 5,000 attendees',
			icon: 'mdi:account-group'
		},
		{
			title: 'Earn and spend more points on cosmetics',
			icon: 'mdi:shopping'
		},
		{
			title: 'Access to premium quests',
			icon: 'mdi:shield-sword'
		},
		{
			title: 'Boosted point earning',
			icon: 'mdi:arrow-up-bold'
		},
		{
			title: 'Foster your circle with up to 500 friends',
			icon: 'mdi:account-multiple-plus'
		},
		{
			title: 'Priority customer support',
			icon: 'mdi:headset'
		}
	],
	button: {
		label: getButtonLabel('PRO')
	}
};

const writer: PricingPlanProps = {
	title: 'Writer',
	description: 'For the power user looking to create and share their own vision of adventure',
	price: '$8.99/mo',
	badge: 'Most Popular',
	features: [
		{
			title: 'Everything in Pro',
			icon: 'mdi:check'
		},
		{
			title: 'Create and manage multiple prompts at any time',
			icon: 'mdi:message-text-fast'
		},
		{
			title: 'Create and publish articles',
			icon: 'mdi:file-document-edit'
		},
		{
			title: 'Priority event discoverability',
			icon: 'mdi:star'
		},
		{
			title: 'Creator analytics and insights',
			icon: 'mdi:chart-line'
		}
	],
	button: {
		label: getButtonLabel('WRITER')
	}
};

const organizer: PricingPlanProps = {
	title: 'Organizer',
	description:
		'For the visionary looking for control and customization to help others explore and connect',
	price: '$14.99/mo',
	features: [
		{
			title: 'Everything in Writer',
			icon: 'mdi:check'
		},
		{
			title: 'Create up to 200 public and private events',
			icon: 'mdi:calendar-star'
		},
		{
			title: 'Host an event with unlimited attendees',
			icon: 'mdi:account-group'
		},
		{
			title: 'Create your own quests',
			icon: 'mdi:hammer'
		},
		{
			title: 'Verified creator status for publishing official activities',
			icon: 'mdi:shield-check'
		}
	],
	button: {
		label: getButtonLabel('ORGANIZER')
	}
};
const plans = [free, pro, writer, organizer];
</script>
