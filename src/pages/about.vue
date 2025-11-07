<template>
	<div class="flex flex-col items-center w-full h-full py-4 px-16">
		<h1 class="text-3xl font-bold">About The Earth App</h1>
		<div class="relative size-48 my-24">
			<EarthCircle />
		</div>
		<p class="text-md mt-2 text-center max-w-3xl">
			In today's world, we are often confined within our own lives, isolated from the vastness of
			knowledge and experience that surrounds us. The Earth App is a new take on the app landscape,
			encouraging users to learn about new things and find novelty in their lives. The app appeals
			to intellectual curiosity, providing fresh new questions, insights, and topics every day. Our
			goal is to help users break free from this isolation by providing a platform that encourages
			exploration and discovery. By using The Earth App, users can expand their horizons and connect
			with the world around them in a meaningful way. You can support this app by following us on
			social media and sharing it with your friends. Together, we can create a community of curious
			minds and explore the wonders of the world around us.
		</p>
		<h1 class="text-2xl font-bold mt-4">Creator</h1>
		<div class="flex justify-center w-2/3">
			<div class="flex max-w-200 w-full">
				<div class="flex flex-col items-center w-1/2">
					<h1 class="font-bold text-xl">Gregory R. Mitchell</h1>
					<NuxtLink
						to="/profile/gmitch215"
						class="text-blue-500 font-semibold"
						>@gmitch215</NuxtLink
					>
					<img
						src="/gregory.jpg"
						class="h-1/2 max-h-240 w-auto mt-4 mr-4 object-contain border-2 border-gray-300 rounded-md hover:scale-105 transition-transform duration-200 shadow-lg shadow-gray-700"
					/>
				</div>
				<div class="flex flex-col items-center max-w-3xl ml-8 mt-12 w-1/2">
					<p class="text-md mt-2">
						Gregory Mitchell is a 17-year-old software developer and student based in the United
						States. Born in Illinois, he has a passion for building applications that make a
						difference in people's lives, and he believes that technology can be a powerful tool for
						learning, exploration, and improving mental health. Gregory is dedicated to creating an
						app that encourages users to step outside their comfort zones and discover new things
						about the world around them. You can look at his other projects on his website:
					</p>
					<NuxtLink
						to="https://gmitch215.dev"
						target="_blank"
						class="mt-4 text-blue-400 hover:underline font-semibold"
					>
						gmitch215.dev
					</NuxtLink>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('About');
</script>
