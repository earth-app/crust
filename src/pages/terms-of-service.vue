<template>
	<div class="flex flex-col items-center w-full h-full py-4 px-16">
		<h1 class="text-3xl font-bold">Terms of Service</h1>
		<div class="relative size-48 my-24">
			<EarthCircle />
		</div>
		<div class="text-left">
			<p class="text-md mt-2 max-w-3xl">
				The Earth App ("we", "our", or "us") provides a platform for users to explore and learn
				about the world around them. By accessing or using our services, you agree to comply with
				and be bound by the following terms and conditions ("Terms of Service"). Please read these
				terms carefully before using our services.
			</p>
			<h1 class="text-2xl font-bold mt-4">1. Acceptance of Terms</h1>
			<p class="text-md mt-2 max-w-3xl">
				By using our services, you agree to be bound by these Terms of Service, as well as our
				Privacy Policy. If you do not agree to these terms, please do not use our services.
			</p>
			<h1 class="text-2xl font-bold mt-4">2. User Conduct</h1>
			<p class="text-md mt-2 max-w-3xl">
				You agree to use our services in a manner that is lawful, ethical, and respectful of others.
				You shall not engage in any activity that may harm, disrupt, or interfere with the proper
				functioning of our services or the experience of other users.
			</p>
			<h1 class="text-2xl font-bold mt-4">3. Intellectual Property</h1>
			<p class="text-md mt-2 max-w-3xl">
				All content and materials provided through our services, including but not limited to text,
				graphics, logos, images, and software, are the property of The Earth App or its licensors
				and are protected by intellectual property laws. You may not use, reproduce, or distribute
				any content from our services without our prior written consent.
			</p>
			<h1 class="text-2xl font-bold mt-4">4. Limitation of Liability</h1>
			<p class="text-md mt-2 max-w-3xl">
				To the fullest extent permitted by law, The Earth App shall not be liable for any direct,
				indirect, incidental, special, consequential, or punitive damages arising out of or related
				to your use of our services.
			</p>
			<h1 class="text-2xl font-bold mt-4">5. Changes to Terms</h1>
			<p class="text-md mt-2 max-w-3xl">
				We reserve the right to modify or update these Terms of Service at any time. Any changes
				will be effective immediately upon posting on our website. Your continued use of our
				services after any such changes constitutes your acceptance of the new terms.
			</p>
			<h1 class="text-2xl font-bold mt-4">6. Contact Us</h1>
			<p class="text-md mt-2 max-w-3xl">
				If you have any questions or concerns about these Terms of Service, please contact us at
				<NuxtLink
					to="mailto:support@earth-app.com"
					class="text-blue-500 font-semibold"
					>support@earth-app.com</NuxtLink
				>
				for assistance.
			</p>
		</div>
	</div>
</template>

<script setup lang="ts">
const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Terms of Service');
</script>
