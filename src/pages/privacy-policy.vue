<template>
	<div class="flex flex-col items-center w-full h-full py-4 px-16">
		<h1 class="text-3xl font-bold">Privacy Policy</h1>
		<div class="relative size-48 my-24">
			<EarthCircle />
		</div>
		<div class="text-left">
			<p class="text-md mt-2 max-w-3xl">
				At The Earth App ("we", "our", or "us"), we are committed to protecting your privacy. This
				Privacy Policy outlines how we collect, use, and safeguard your personal information when
				you use our services. By accessing or using our services, you agree to the terms of this
				Privacy Policy.
			</p>
			<h1 class="text-2xl font-bold mt-4">1. Information We Collect</h1>
			<p class="text-md mt-2 max-w-3xl">
				We may collect personal information that you provide to us directly, such as your name,
				email address, and any other information you choose to share when you create an account or
				use our services. We may also collect non-personal information automatically, such as your
				IP address, browser type, and usage data through cookies and similar technologies.
			</p>
			<h1 class="text-2xl font-bold mt-4">2. How We Use Your Information</h1>
			<p class="text-md mt-2 max-w-3xl">
				We use the information we collect to provide, maintain, and improve our services, to
				communicate with you, and to personalize your experience. We may also use your information
				for marketing purposes, analytics, and to comply with legal obligations. We do not use your
				personal information for advertising purposes.
			</p>
			<h1 class="text-2xl font-bold mt-4">3. Sharing Your Information</h1>
			<p class="text-md mt-2 max-w-3xl">
				<strong>We do not sell, trade, or rent your personal information to third parties.</strong>
				We may share your information with trusted service providers who assist us in operating our
				services, <strong>as long as they agree to keep your information confidential.</strong> We
				may also disclose your information if required by law or to protect our rights.
			</p>
			<h1 class="text-2xl font-bold mt-4">4. Data Security</h1>
			<p class="text-md mt-2 max-w-3xl">
				We implement appropriate security measures to protect your personal information from
				unauthorized access, alteration, disclosure, or destruction. However, no method of
				transmission over the internet or electronic storage is completely secure, and we cannot
				guarantee absolute security.
			</p>
			<h1 class="text-2xl font-bold mt-4">5. Your Choices</h1>
			<p class="text-md mt-2 max-w-3xl">
				You have the right to access, correct, or delete your personal information. You may also
				opt-out of receiving marketing communications from us at any time by following the
				instructions in those communications. Please note that even if you opt-out, we may still
				send you important service-related messages.
			</p>
			<h1 class="text-2xl font-bold mt-4">6. Changes to This Privacy Policy</h1>
			<p class="text-md mt-2 max-w-3xl">
				We reserve the right to update or modify this Privacy Policy at any time. Any changes will
				be effective immediately upon posting on our website. Your continued use of our services
				after any such changes constitutes your acceptance of the new terms.
			</p>
			<h1 class="text-2xl font-bold mt-4">7. Contact Us</h1>
			<p class="text-md mt-2 max-w-3xl">
				If you have any questions or concerns about this Privacy Policy, please contact us at
				<NuxtLink
					to="mailto:support@earth-app.com"
					class="text-blue-500 font-semibold"
				>
					support@earth-app.com
				</NuxtLink>
				for assistance.
			</p>
		</div>
	</div>
</template>

<script setup lang="ts">
const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Privacy Policy');
</script>
