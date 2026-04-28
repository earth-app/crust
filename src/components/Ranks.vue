<template>
	<div class="grid grid-cols-2 gap-6">
		<UPricingPlan
			v-for="(plan, index) in plans"
			class="min-w-50 max-w-125"
			id="plan-{{ plan.title }}"
			:key="index"
			:class="{
				'border-2 border-primary': highlighted === plan.title?.toUpperCase(),
				'border-gray-300 light:border-gray-600': highlighted !== plan.title?.toUpperCase()
			}"
			v-bind="plan"
		/>
	</div>
</template>

<script setup lang="ts">
import type { PricingPlanProps } from '@nuxt/ui';

const props = defineProps<{
	highlighted?: 'FREE' | 'PRO' | 'WRITER' | 'ORGANIZER';
}>();

const { user } = useAuth();
const currentPlan = computed(() => {
	if (!user.value) return 'FREE';
	return user.value.account.account_type;
});

onMounted(() => {
	// scroll to highlighted plan if it exists
	if (props.highlighted) {
		const el = document.getElementById(`plan-${props.highlighted}`);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}
});

function getButtonLabel(planType: string) {
	if (!user.value) return 'Sign Up';
	const order = ['FREE', 'PRO', 'WRITER', 'ORGANIZER', 'ADMINISTRATOR'];
	const currentIndex = order.indexOf(currentPlan.value);
	const planIndex = order.indexOf(planType);
	if (currentIndex === planIndex) return 'Current Plan';

	return planIndex < currentIndex ? 'Downgrade' : 'Upgrade';
}

function getButtonColor(planType: string) {
	if (!user.value) return 'primary';
	const order = ['FREE', 'PRO', 'WRITER', 'ORGANIZER', 'ADMINISTRATOR'];
	const currentIndex = order.indexOf(currentPlan.value);
	const planIndex = order.indexOf(planType);
	if (currentIndex === planIndex) return 'secondary';

	return planIndex < currentIndex ? 'error' : 'primary';
}

function isDisabled(planType: string) {
	if (!user.value) return false;
	if (currentPlan.value === 'ADMINISTRATOR') return true; // admins cannot downgrade
	if (currentPlan.value === planType) return true; // current plan cannot be selected

	// FIXME purcahsing plans is not yet implemented and currently handled over patreon

	return true;
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
		label: getButtonLabel('FREE'),
		disabled: isDisabled('FREE'),
		color: getButtonColor('FREE')
	}
};

const pro: PricingPlanProps = {
	title: 'Pro',
	description: 'For the dedicated adventurer looking to level up their experience',
	price: '$5.99/mo',
	badge: {
		label: 'Great Start',
		color: 'secondary'
	},
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
		label: getButtonLabel('PRO'),
		disabled: isDisabled('PRO'),
		color: getButtonColor('PRO')
	}
};

const writer: PricingPlanProps = {
	title: 'Writer',
	description: 'For the power user looking to create and share their own vision of adventure',
	price: '$8.99/mo',
	badge: {
		label: 'Most Popular',
		icon: 'mdi:arrow-up-bold',
		color: 'primary'
	},
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
		label: getButtonLabel('WRITER'),
		disabled: isDisabled('WRITER'),
		color: getButtonColor('WRITER')
	}
};

const organizer: PricingPlanProps = {
	title: 'Organizer',
	description:
		'For the visionary looking for control and customization to help others explore and connect',
	price: '$14.99/mo',
	badge: {
		label: 'Best Value',
		icon: 'mdi:star',
		color: 'warning'
	},
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
		label: getButtonLabel('ORGANIZER'),
		disabled: isDisabled('ORGANIZER'),
		color: getButtonColor('ORGANIZER')
	}
};
const plans = [free, pro, writer, organizer];
</script>
