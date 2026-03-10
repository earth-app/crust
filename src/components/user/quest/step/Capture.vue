<template>
	<div
		class="relative min-h-96 min-w-1/4 aspect-3/4 overflow-hidden bg-neutral-950 border-8 border-neutral-900/40 rounded-2xl p-8"
	>
		<canvas
			ref="canvasEl"
			class="hidden"
		/>

		<div
			v-if="stage === 'permission'"
			class="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8 text-center"
		>
			<div
				class="w-20 h-20 rounded-full border-2 border-lime-400 flex items-center justify-center animate-ring-pulse"
			>
				<UIcon
					name="i-lucide-camera"
					class="text-3xl text-lime-400"
				/>
			</div>
			<p class="text-[0.8rem] font-semibold tracking-[0.12em] uppercase text-neutral-100">
				Camera Access Required
			</p>
			<p class="text-[0.72rem] text-neutral-500 leading-[1.65]">
				This component uses your camera directly.<br />No file uploads are permitted.
			</p>
			<button
				class="mt-2 px-6 py-2.5 rounded-xl bg-neutral-800 text-white text-sm font-medium tracking-wide"
				@click="startCamera"
			>
				Enable Camera
			</button>
		</div>

		<div
			v-else-if="stage === 'error'"
			class="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8 text-center"
		>
			<div class="w-20 h-20 rounded-full border-2 border-red-500 flex items-center justify-center">
				<UIcon
					name="i-lucide-camera-off"
					class="text-3xl text-red-400"
				/>
			</div>
			<p class="text-[0.8rem] font-medium tracking-[0.12em] uppercase text-red-400">
				Camera Unavailable
			</p>
			<p class="text-[0.72rem] text-neutral-500 leading-[1.65]">{{ errorMsg }}</p>
			<button
				class="mt-2 px-6 py-2 rounded-xl border border-neutral-700 text-white text-sm"
				@click="startCamera"
			>
				Try Again
			</button>
		</div>

		<div
			v-else-if="stage === 'live'"
			class="absolute inset-0 flex flex-col"
		>
			<video
				ref="videoEl"
				class="w-full h-full object-cover block"
				:class="{ '-scale-x-100': facingMode === 'user' }"
				autoplay
				playsinline
				muted
			/>

			<div
				class="absolute inset-0 bg-white pointer-events-none transition-opacity duration-100"
				:class="isFlashing ? 'opacity-100' : 'opacity-0'"
			/>

			<span class="absolute top-4 left-4 w-7 h-7 border-t-2 border-l-2 border-lime-400" />
			<span class="absolute top-4 right-4 w-7 h-7 border-t-2 border-r-2 border-lime-400" />
			<span class="absolute bottom-4 left-4 w-7 h-7 border-b-2 border-l-2 border-lime-400" />
			<span class="absolute bottom-4 right-4 w-7 h-7 border-b-2 border-r-2 border-lime-400" />

			<div
				class="absolute top-0 left-0 right-0 flex items-center px-4 pt-4 pb-8"
				style="background: linear-gradient(to bottom, rgba(0, 0, 0, 0.55), transparent)"
			>
				<span
					class="flex items-center ml-2 mt-2 gap-1.5 text-[0.65rem] tracking-[0.14em] uppercase text-lime-400"
				>
					<span class="w-1.5 h-1.5 rounded-full bg-lime-400 animate-blink" />
					LIVE
				</span>
			</div>

			<div
				class="absolute bottom-0 left-0 right-0 flex items-center justify-between px-8 py-5 pb-7"
				style="background: linear-gradient(to top, rgba(0, 0, 0, 0.65), transparent)"
			>
				<div class="w-12 h-12" />

				<button
					class="shutter relative size-19 rounded-full border-4 border-white bg-transparent transition-transform duration-100"
					:class="
						props.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-90'
					"
					:disabled="props.disabled"
					aria-label="Take photo"
					@click="takePhoto"
				>
					<span class="absolute inset-1.5 rounded-full bg-white block" />
				</button>

				<button
					class="w-12 h-12 rounded-full border border-white/20 bg-black/30 backdrop-blur-sm flex items-center justify-center text-white transition-all duration-300"
					:class="
						props.disabled
							? 'opacity-40 cursor-not-allowed'
							: 'cursor-pointer hover:border-white/45'
					"
					:style="{ transform: isFlipping ? 'rotate(180deg)' : 'rotate(0deg)' }"
					:disabled="props.disabled"
					aria-label="Flip camera"
					@click="flipCamera"
				>
					<UIcon
						name="i-lucide-refresh-cw"
						class="text-xl"
					/>
				</button>
			</div>
		</div>

		<div
			v-else-if="stage === 'preview'"
			class="absolute inset-0 flex flex-col"
		>
			<img
				:src="previewSrc"
				class="w-full h-full object-cover block"
				:class="{ '-scale-x-100': facingMode === 'user' }"
				alt="Captured photo"
			/>

			<span class="absolute top-4 left-4 w-7 h-7 border-t-2 border-l-2 border-white/40" />
			<span class="absolute top-4 right-4 w-7 h-7 border-t-2 border-r-2 border-white/40" />
			<span class="absolute bottom-4 left-4 w-7 h-7 border-b-2 border-l-2 border-white/40" />
			<span class="absolute bottom-4 right-4 w-7 h-7 border-b-2 border-r-2 border-white/40" />

			<div
				class="absolute top-0 left-0 right-0 flex items-center px-4 pt-4 pb-8"
				style="background: linear-gradient(to bottom, rgba(0, 0, 0, 0.55), transparent)"
			>
				<span
					class="ml-2 mt-2 text-[0.65rem] tracking-[0.14em] uppercase text-white/50 px-2 py-0.5 border border-white/15 rounded bg-white/[0.07]"
				>
					PREVIEW
				</span>
			</div>

			<div
				class="absolute bottom-0 left-0 right-0 flex items-center justify-between px-8 py-5 pb-7"
				style="background: linear-gradient(to top, rgba(0, 0, 0, 0.65), transparent)"
			>
				<button
					class="w-12 h-12 rounded-full border border-red-500/50 bg-black/30 backdrop-blur-sm flex items-center justify-center text-red-400 cursor-pointer hover:border-red-400 transition-colors duration-200"
					aria-label="Retake"
					@click="rejectPhoto"
				>
					<UIcon
						name="i-lucide-x"
						class="text-xl"
					/>
				</button>

				<button
					class="size-19 rounded-full flex items-center justify-center transition-all duration-100 border-none"
					:class="
						props.disabled
							? 'bg-lime-400/40 cursor-not-allowed'
							: 'bg-lime-400 cursor-pointer hover:bg-lime-300 active:scale-90 [box-shadow:0_0_28px_rgb(163_230_53/0.45)]'
					"
					:disabled="props.disabled"
					aria-label="Accept photo"
					@click="acceptPhoto"
				>
					<UIcon
						name="i-lucide-check"
						class="text-3xl text-neutral-900"
					/>
				</button>

				<div class="w-12 h-12" />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import piexif from 'piexifjs';

const props = defineProps<{
	disabled?: boolean;
}>();

const emit = defineEmits<{
	capture: [file: File];
	'photo-taken': [];
	'photo-rejected': [];
}>();

type Stage = 'permission' | 'live' | 'preview' | 'error';

const stage = ref<Stage>('permission');
const errorMsg = ref('');
const facingMode = ref<'environment' | 'user'>('environment');
const isFlipping = ref(false);
const isFlashing = ref(false);

const videoEl = ref<HTMLVideoElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);
const previewSrc = ref<string>('');
let stream: MediaStream | null = null;

async function startCamera() {
	stopStream();
	try {
		stream = await navigator.mediaDevices.getUserMedia({
			video: { facingMode: facingMode.value, width: { ideal: 1920 }, height: { ideal: 1080 } },
			audio: false
		});
		stage.value = 'live';
		await nextTick();
		if (videoEl.value) {
			videoEl.value.srcObject = stream;
			await videoEl.value.play();
		}
	} catch (e: any) {
		stage.value = 'error';
		errorMsg.value =
			e?.name === 'NotAllowedError'
				? 'Camera access was denied. Please allow camera permissions in your browser settings.'
				: 'Unable to access your camera. Make sure no other app is using it.';
	}
}

function stopStream() {
	stream?.getTracks().forEach((t) => t.stop());
	stream = null;
}

// EXIF Injection

async function flipCamera() {
	if (props.disabled) return;
	isFlipping.value = true;
	facingMode.value = facingMode.value === 'environment' ? 'user' : 'environment';
	await startCamera();
	setTimeout(() => (isFlipping.value = false), 400);
}

function detectDevice(): { make: string; model: string } {
	const ua = navigator.userAgent;

	// iOS / iPadOS
	const iosMatch = ua.match(/\((\w+);\s*CPU(?:\s+iPhone)?\s+OS\s+([\d_]+)/);
	if (iosMatch) return { make: 'Apple', model: iosMatch[1] ?? 'iPhone' };

	// Android
	const androidMatch = ua.match(/Android\s+([\d.]+);\s*([^)]+)\)/);
	if (androidMatch) {
		const modelRaw = (androidMatch[2] ?? '').trim() || 'Android';
		let make = 'Android';
		if (/samsung/i.test(modelRaw) || /^(SM|SGH|GT|SCH)-/i.test(modelRaw)) make = 'Samsung';
		else if (/pixel/i.test(modelRaw) || /google/i.test(modelRaw)) make = 'Google';
		else if (/oneplus|le\s*x/i.test(modelRaw)) make = 'OnePlus';
		else if (/huawei|honor/i.test(modelRaw)) make = 'Huawei';
		else if (/xiaomi|redmi|poco|mi\s/i.test(modelRaw)) make = 'Xiaomi';
		else if (/lg[-\s]/i.test(modelRaw)) make = 'LG';
		else if (/motorola|moto\s/i.test(modelRaw)) make = 'Motorola';
		else if (/sony|xperia/i.test(modelRaw)) make = 'Sony';
		else if (/nokia/i.test(modelRaw)) make = 'Nokia';
		return { make, model: modelRaw };
	}

	// macOS
	if (/Macintosh.*Mac OS X/i.test(ua)) return { make: 'Apple', model: 'Mac' };

	// Windows
	if (/Windows NT/i.test(ua)) return { make: 'Microsoft', model: 'PC' };

	// Linux desktop
	if (/Linux/i.test(ua) && !/Android/i.test(ua)) return { make: 'Linux', model: 'Desktop' };

	return { make: 'Unknown', model: 'Unknown' };
}

function formatExifDate(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	// Without offset tags we store UTC so readers don't misinterpret local time
	return `${date.getUTCFullYear()}:${pad(date.getUTCMonth() + 1)}:${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

function decimalToDms(decimal: number): [[number, number], [number, number], [number, number]] {
	const deg = Math.floor(decimal);
	const minFloat = (decimal - deg) * 60;
	const min = Math.floor(minFloat);
	const sec = Math.round((minFloat - min) * 6000);
	return [
		[deg, 1],
		[min, 1],
		[sec, 100]
	];
}

function screenOrientationToExif(): number {
	if (typeof screen === 'undefined' || !screen.orientation) return 1;
	switch (screen.orientation.angle) {
		case 90:
			return 6; // 90° CW
		case 180:
			return 3; // 180°
		case 270:
			return 8; // 270° CW (90° CCW)
		default:
			return 1; // Normal
	}
}

/**
 * Inject EXIF metadata (timestamp, dimensions, GPS, orientation) into a
 * JPEG data URL produced by canvas.toDataURL(). Canvas export strips all
 * metadata, so this restores it from available browser APIs.
 */
async function injectExif(dataUrl: string, width: number, height: number): Promise<string> {
	const now = new Date();
	const dateStr = formatExifDate(now);
	const { make, model } = detectDevice();
	const exifObj: Record<string, Record<number, unknown>> = {
		'0th': {
			[piexif.ImageIFD.Make]: make,
			[piexif.ImageIFD.Model]: model,
			[piexif.ImageIFD.Software]: 'Earth App',
			[piexif.ImageIFD.DateTime]: dateStr,
			[piexif.ImageIFD.Orientation]: screenOrientationToExif(),
			[piexif.ImageIFD.XResolution]: [72, 1],
			[piexif.ImageIFD.YResolution]: [72, 1],
			[piexif.ImageIFD.ResolutionUnit]: 2 // inch
		},
		Exif: {
			[piexif.ExifIFD.DateTimeOriginal]: dateStr,
			[piexif.ExifIFD.DateTimeDigitized]: dateStr,
			// Note: OffsetTimeOriginal (0x9010) and OffsetTimeDigitized (0x9011) are
			// EXIF 2.31 additions not supported by piexifjs — omit to avoid dump() throwing.
			[piexif.ExifIFD.FNumber]: [28, 10], // F2.8 — typical web camera aperture
			[piexif.ExifIFD.ExposureTime]: [1, 30], // 1/30 second — typical web camera exposure
			[piexif.ExifIFD.FocalLength]: [50, 10], // 5.0mm — typical web camera focal length
			[piexif.ExifIFD.LensModel]: 'Virtual Lens',
			[piexif.ExifIFD.PixelXDimension]: width,
			[piexif.ExifIFD.PixelYDimension]: height,
			[piexif.ExifIFD.ColorSpace]: 1 // sRGB
		},
		GPS: {},
		'1st': {}
	};

	// Attempt to attach GPS coordinates — silently skip if unavailable or denied
	try {
		const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
			navigator.geolocation.getCurrentPosition(resolve, reject, {
				timeout: 3000,
				maximumAge: 60_000
			})
		);
		const { latitude, longitude, altitude } = pos.coords;
		exifObj.GPS = {
			[piexif.GPSIFD.GPSLatitudeRef]: latitude >= 0 ? 'N' : 'S',
			[piexif.GPSIFD.GPSLatitude]: decimalToDms(Math.abs(latitude)),
			[piexif.GPSIFD.GPSLongitudeRef]: longitude >= 0 ? 'E' : 'W',
			[piexif.GPSIFD.GPSLongitude]: decimalToDms(Math.abs(longitude))
		};
		if (altitude !== null) {
			exifObj.GPS[piexif.GPSIFD.GPSAltitudeRef] = altitude >= 0 ? 0 : 1;
			exifObj.GPS[piexif.GPSIFD.GPSAltitude] = [Math.round(Math.abs(altitude) * 100), 100];
		}
	} catch {
		// Geolocation unavailable or permission denied — proceed without GPS
	}

	const exifBytes = piexif.dump(exifObj);
	return piexif.insert(exifBytes, dataUrl);
}

async function takePhoto() {
	if (props.disabled || !videoEl.value || !canvasEl.value) return;

	isFlashing.value = true;
	setTimeout(() => (isFlashing.value = false), 120);

	const video = videoEl.value;
	const canvas = canvasEl.value;
	canvas.width = video.videoWidth;
	canvas.height = video.videoHeight;
	canvas.getContext('2d')!.drawImage(video, 0, 0);

	const rawDataUrl = canvas.toDataURL('image/jpeg', 0.92);
	// Inject EXIF into the data URL before storing — canvas strips all metadata.
	// Fall back to the raw data URL if piexif throws (e.g. unsupported tag).
	try {
		previewSrc.value = await injectExif(rawDataUrl, canvas.width, canvas.height);
	} catch {
		previewSrc.value = rawDataUrl;
	}
	stopStream();
	stage.value = 'preview';
	emit('photo-taken');
}

function rejectPhoto() {
	previewSrc.value = '';
	emit('photo-rejected');
	startCamera();
}

function acceptPhoto() {
	if (props.disabled || !previewSrc.value) return;

	const commaIdx = previewSrc.value.indexOf(',');
	const header = previewSrc.value.slice(0, commaIdx);
	const b64 = previewSrc.value.slice(commaIdx + 1);
	const mime = header.match(/:(.*?);/)![1];
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	const blob = new Blob([bytes], { type: mime });
	const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
	emit('capture', file);
}

onBeforeUnmount(stopStream);
</script>

<style scoped>
/* Keyframe animations — cannot be expressed as inline Tailwind utility classes */
@keyframes ring-pulse {
	0%,
	100% {
		box-shadow: 0 0 0 0 rgb(163 230 53 / 0.3);
	}
	50% {
		box-shadow: 0 0 0 14px rgb(163 230 53 / 0);
	}
}
@keyframes blink {
	0%,
	100% {
		opacity: 1;
	}
	50% {
		opacity: 0;
	}
}

.animate-ring-pulse {
	animation: ring-pulse 2s ease-in-out infinite;
}
.animate-blink {
	animation: blink 1.2s step-start infinite;
}
</style>
