<template>
	<div
		class="relative flex flex-col items-center w-full min-h-80 rounded-2xl overflow-hidden bg-neutral-950 border-4 border-neutral-900/50"
	>
		<div
			v-if="stage === 'permission'"
			class="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8 text-center"
		>
			<div
				class="w-20 h-20 rounded-full border-2 border-primary flex items-center justify-center animate-mic-pulse"
			>
				<UIcon
					name="i-lucide-mic"
					class="text-3xl text-primary"
				/>
			</div>
			<p class="text-[0.8rem] font-semibold tracking-[0.12em] uppercase text-neutral-100">
				Microphone Access Required
			</p>
			<p class="text-[0.72rem] text-neutral-500 leading-[1.65]">
				Direct microphone only.<br />No file uploads permitted.
			</p>
			<button
				class="mt-2 px-6 py-2.5 rounded-xl bg-neutral-800 text-white text-sm font-medium tracking-wide"
				@click="requestPermission"
			>
				Enable Microphone
			</button>
		</div>

		<div
			v-else-if="stage === 'error'"
			class="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8 text-center"
		>
			<UIcon
				name="i-lucide-mic-off"
				class="size-14 text-red-400"
			/>
			<p class="text-sm font-medium text-red-400">Microphone Unavailable</p>
			<p class="text-xs text-neutral-500 leading-relaxed">{{ errorMsg }}</p>
			<button
				class="mt-2 px-6 py-2 rounded-xl border border-neutral-700 text-white text-sm"
				@click="requestPermission"
			>
				Try Again
			</button>
		</div>

		<div
			v-else-if="stage === 'ready' || stage === 'recording'"
			class="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6"
		>
			<div class="flex items-end gap-1 h-14">
				<span
					v-for="i in 20"
					:key="i"
					class="w-1 rounded-full bg-primary transition-all duration-75"
					:style="{
						height: stage === 'recording' ? `${bars[i - 1] || 4}px` : '5px',
						opacity: stage === 'recording' ? 1 : 0.25
					}"
				/>
			</div>

			<span
				v-if="stage === 'recording'"
				class="text-3xl font-mono text-white tabular-nums"
				>{{ formatTime(elapsed) }}</span
			>
			<span
				v-else
				class="text-sm text-neutral-500"
				>Tap to start recording</span
			>

			<button
				v-if="stage === 'recording'"
				class="size-16 rounded-full border-4 border-red-500 flex items-center justify-center active:scale-90 transition-transform"
				@click="stopRecording"
			>
				<span class="w-5 h-5 bg-red-500 rounded-sm" />
			</button>
			<button
				v-else
				class="size-16 rounded-full border-4 flex items-center justify-center transition-all"
				:class="
					props.disabled
						? 'border-primary/30 opacity-40 cursor-not-allowed'
						: 'border-primary active:scale-90 cursor-pointer'
				"
				:disabled="props.disabled"
				@click="startRecording"
			>
				<span class="w-5 h-5 bg-primary rounded-full" />
			</button>
		</div>

		<div
			v-else-if="stage === 'preview'"
			class="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8"
		>
			<UIcon
				name="i-lucide-audio-waveform"
				class="size-12 text-primary"
			/>
			<span class="text-sm text-neutral-300">{{ formatTime(elapsed) }} recorded</span>
			<audio
				:src="previewUrl"
				controls
				class="w-full rounded-lg"
			/>
			<div class="flex gap-4 mt-1">
				<button
					class="px-5 py-2 rounded-xl border border-red-500/50 text-red-400 text-sm active:scale-95 transition-transform"
					@click="retake"
				>
					Retake
				</button>
				<button
					class="px-5 py-2 rounded-xl font-semibold text-sm transition-all"
					:class="
						props.disabled
							? 'bg-success/30 text-neutral-600 cursor-not-allowed'
							: 'bg-success text-neutral-900 active:scale-95 cursor-pointer'
					"
					:disabled="props.disabled"
					@click="confirm"
				>
					Confirm
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
type Stage = 'permission' | 'ready' | 'recording' | 'preview' | 'error';

const props = defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ capture: [file: File] }>();

const stage = ref<Stage>('permission');
const errorMsg = ref('');
const elapsed = ref(0);
const bars = ref<number[]>(Array(20).fill(4));
const previewUrl = ref('');

let mediaRecorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let timerInterval: ReturnType<typeof setInterval> | null = null;
let animFrame: number | null = null;
let analyser: AnalyserNode | null = null;
let stream: MediaStream | null = null;

const MIMES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
const mimeType = MIMES.find((m) => MediaRecorder.isTypeSupported(m)) || 'audio/webm';

async function requestPermission() {
	try {
		stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
		stage.value = 'ready';
	} catch (e: any) {
		stage.value = 'error';
		errorMsg.value =
			e?.name === 'NotAllowedError'
				? 'Microphone access was denied. Please allow it in your browser settings.'
				: 'Unable to access your microphone. Make sure no other app is using it.';
	}
}

function startRecording() {
	if (props.disabled || !stream) return;
	chunks = [];
	elapsed.value = 0;

	const audioCtx = new AudioContext();
	analyser = audioCtx.createAnalyser();
	analyser.fftSize = 64;
	audioCtx.createMediaStreamSource(stream).connect(analyser);

	mediaRecorder = new MediaRecorder(stream, { mimeType });
	mediaRecorder.ondataavailable = (e) => {
		if (e.data.size > 0) chunks.push(e.data);
	};
	mediaRecorder.start(100);
	stage.value = 'recording';

	timerInterval = setInterval(() => {
		elapsed.value++;
		if (elapsed.value >= 300) stopRecording();
	}, 1000);

	const tick = () => {
		if (!analyser) return;
		const buf = new Uint8Array(analyser.frequencyBinCount);
		analyser.getByteFrequencyData(buf);
		bars.value = Array.from({ length: 20 }, (_, i) =>
			Math.max(4, ((buf[Math.floor((i * buf.length) / 20)] ?? 0) / 255) * 52)
		);
		animFrame = requestAnimationFrame(tick);
	};
	animFrame = requestAnimationFrame(tick);
}

function stopRecording() {
	if (!mediaRecorder) return;
	mediaRecorder.onstop = () => {
		const blob = new Blob(chunks, { type: mimeType });
		previewUrl.value = URL.createObjectURL(blob);
		stage.value = 'preview';
	};
	mediaRecorder.stop();
	if (timerInterval) clearInterval(timerInterval);
	if (animFrame) cancelAnimationFrame(animFrame);
	analyser = null;
}

function retake() {
	if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
	previewUrl.value = '';
	elapsed.value = 0;
	stage.value = 'ready';
}

function confirm() {
	if (props.disabled) return;
	const blob = new Blob(chunks, { type: mimeType });
	const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
	emit('capture', new File([blob], `audio-${Date.now()}.${ext}`, { type: mimeType }));
}

function formatTime(s: number) {
	return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

onBeforeUnmount(() => {
	stream?.getTracks().forEach((t) => t.stop());
	if (timerInterval) clearInterval(timerInterval);
	if (animFrame) cancelAnimationFrame(animFrame);
	if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
});
</script>

<style scoped>
@keyframes mic-pulse {
	0%,
	100% {
		box-shadow: 0 0 0 0 rgb(var(--color-primary) / 0.3);
	}
	50% {
		box-shadow: 0 0 0 14px rgb(var(--color-primary) / 0);
	}
}
.animate-mic-pulse {
	animation: mic-pulse 2s ease-in-out infinite;
}
</style>
