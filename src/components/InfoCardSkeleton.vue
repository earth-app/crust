<template>
	<div class="min-w-100 w-11/12 p-4 shadow-lg rounded-lg">
		<div class="flex items-center space-x-4">
			<div class="flex flex-col w-full">
				<div class="flex items-center mb-2">
					<USkeleton
						class="h-8 w-8 mr-2"
						:ui="{ rounded: 'rounded-full' }"
					/>
					<USkeleton class="h-6 w-48" />
				</div>
				<USkeleton class="h-4 w-32 mb-4" />
				<USkeleton class="h-px w-11/12 mb-4" />
				<USkeleton class="h-48 w-full rounded-lg mb-2" />
				<USkeleton class="h-4 w-full mb-1" />
				<USkeleton class="h-4 w-3/4 mb-1" />
				<USkeleton class="h-4 w-1/2" />
			</div>
		</div>
	</div>
</template>
