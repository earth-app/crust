<template>
	<UFileUpload
		accept="image/*"
		multiple
		icon="mdi:image-outline"
		color="secondary"
		highlight
		label="Upload Your Submission"
		description="PNG, JPG, WEBP, HEIC (max. 10MB each)"
		layout="grid"
		class="max-w-96 max-h-32"
		:preview="false"
		@update:model-value="handleUpload"
		:disabled="
			!event?.is_attending ||
			(user ? currentSubmissionsCount >= 3 : true) ||
			event?.fields?.cancelled ||
			!event.timing.is_ongoing
		"
	/>

	<UModal
		v-if="value"
		title="Confirm Submission"
		v-model:open="modalOpen"
		:dismissible="false"
		:close="false"
		class="md:min-w-200 lg:min-w-250 max-w-screen"
	>
		<template #body>
			<div class="flex flex-col items-center">
				<NuxtImg
					v-for="(blob, index) in valueBlobs"
					:key="index"
					:src="blob"
					alt="Submission Preview"
					format="webp"
					class="h-auto max-h-screen max-w-screen rounded-xl shadow-md object-contain mb-4 border-2 border-info/50 hover:border-info transition-all duration-300"
				/>
				<p class="text-center">Are you sure you want to submit these image(s)?</p>
				<div class="flex">
					<UButton
						variant="subtle"
						color="error"
						class="mt-4 mr-2"
						icon="mdi:close"
						@click="value = []"
						:disabled="submitting"
					>
						Cancel
					</UButton>
					<UButton
						color="primary"
						class="mt-4"
						@click="submitUpload"
						icon="mdi:image-check-outline"
						:loading="submitting"
					>
						Confirm
					</UButton>
				</div>
			</div>
		</template>
	</UModal>
</template>

<script setup lang="ts">
const props = defineProps<{
	eventId: string;
}>();

const emit = defineEmits<{
	(e: 'submission', file: File): void;
}>();

const toast = useToast();
const { user } = useAuth();
const { event, fetch, fetchSubmissionsForUser, submitImage } = useEvent(props.eventId);
const currentSubmissionsCount = ref(0);

onMounted(() => {
	fetch();

	if (user.value)
		fetchSubmissionsForUser(user.value.id).then((subs) => {
			currentSubmissionsCount.value = subs.length;
		});
});
watch(
	() => user.value,
	(newUser) => {
		if (newUser) {
			fetchSubmissionsForUser(newUser.id).then((subs) => {
				currentSubmissionsCount.value = subs.length;
			});
		} else {
			currentSubmissionsCount.value = 0;
		}
	}
);

const value = ref<File[] | null>(null);
const modalOpen = ref(false);
watch(value, (newValue) => {
	if (newValue && newValue.length > 0) {
		modalOpen.value = true;
	} else {
		modalOpen.value = false;
	}
});

const valueBlobs = computed(() => {
	if (!value.value) return null;
	return value.value.map((file) => URL.createObjectURL(file));
});

async function handleUpload(upload?: File[] | null) {
	if (!upload || upload.length === 0) {
		value.value = null;
		return;
	}

	if (upload.length + currentSubmissionsCount.value > 3) {
		toast.add({
			title: 'Too Many Files',
			description:
				'You can only upload up to 3 images per submission.' +
				(currentSubmissionsCount.value > 0
					? ` You have already submitted ${currentSubmissionsCount.value} image(s).`
					: ''),
			icon: 'mdi:alert-circle-outline',
			color: 'error'
		});
		return;
	}

	if (upload.some((file) => file.size > 10 * 1024 * 1024)) {
		toast.add({
			title: 'File Too Large',
			description: 'Each image must be less than 10MB.',
			icon: 'mdi:image-off',
			color: 'error'
		});
		return;
	}

	if (!upload.some((file) => file.type.startsWith('image/'))) {
		toast.add({
			title: 'Invalid File Type',
			description: 'Only image files are allowed.',
			icon: 'mdi:file-alert-outline',
			color: 'error'
		});
		return;
	}

	// disallow animated images (e.g. animated webp, gif, png, etc.)
	{
		const results = await Promise.all(upload.map((file) => isAnimatedImage(file)));
		if (results.some(Boolean)) {
			toast.add({
				title: 'Animated Images Not Allowed',
				description: 'Animated images (e.g. animated WebP, GIF) are not allowed.',
				icon: 'mdi:image-off-outline',
				color: 'error'
			});
			return;
		}
	}

	value.value = upload;
}

const submitting = ref(false);
async function submitUpload() {
	if (!value.value) return;

	submitting.value = true;
	for (const file of value.value) {
		const res = await submitImage(file);
		if (res.success && res.data) {
			if ('code' in res.data) {
				console.error('Submission error:', res.data.message, 'Code:', res.data.code);
				toast.add({
					title: 'Submission Error',
					description: res.data.message,
					icon: 'mdi:alert-circle-outline',
					color: 'error'
				});
				return;
			}

			// successful upload
			currentSubmissionsCount.value += 1;
			emit('submission', file);
		} else {
			if (res.message === 'Image submitted successfully') continue;

			console.error('Submission error:', res.message);
			toast.add({
				title: 'Submission Failed',
				description: res.message || 'An unknown error occurred while submitting your image.',
				icon: 'mdi:image-off',
				color: 'error'
			});
		}
	}

	value.value = null;
	toast.add({
		title: 'Submission Successful',
		description: 'Your image(s) have been successfully submitted.',
		icon: 'mdi:image-check',
		color: 'success'
	});

	submitting.value = false;
}

// animation functions

async function readFileBytes(file: File, length = 64 * 1024): Promise<Uint8Array> {
	const slice = file.slice(0, length);
	return await new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (e) => {
			const result = e.target?.result;
			if (result instanceof ArrayBuffer) resolve(new Uint8Array(result));
			else resolve(new Uint8Array());
		};
		reader.onerror = () => reject(reader.error);
		reader.readAsArrayBuffer(slice);
	});
}

function bytesToString(bytes: Uint8Array): string {
	try {
		return new TextDecoder().decode(bytes);
	} catch (e) {
		return '';
	}
}

async function isAnimatedImage(file: File): Promise<boolean> {
	if (!file.type.startsWith('image/')) return false;
	const bytes = await readFileBytes(file);
	const text = bytesToString(bytes);

	if (file.type === 'image/webp') return isAnimatedWebPBytes(text);
	if (file.type === 'image/gif') return isAnimatedGIFBytes(text);
	if (file.type === 'image/png') return isAnimatedPNGBytes(text);
	if (file.type === 'image/heic' || file.type === 'image/heif') return isAnimatedHEICBytes(text);
	return false;
}

function isAnimatedWebPBytes(text: string): boolean {
	// ANIM chunk marks animated WebP
	return text.includes('ANIM');
}

function isAnimatedGIFBytes(text: string): boolean {
	// GIF headers for animated GIFs
	return text.startsWith('GIF89a') || text.startsWith('GIF87a');
}

function isAnimatedPNGBytes(text: string): boolean {
	// APNG contains the "acTL" chunk somewhere after the header
	return text.includes('acTL');
}

function isAnimatedHEICBytes(text: string): boolean {
	// Check for common HEIC/AV1 indicators in the ftyp/brand area
	return text.includes('heic') || text.includes('av01');
}
</script>
