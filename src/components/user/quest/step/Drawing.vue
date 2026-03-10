<template>
	<div class="flex flex-col w-full select-none touch-none">
		<div
			class="relative w-full bg-white rounded-xl overflow-hidden"
			style="aspect-ratio: 1/1"
		>
			<canvas
				ref="canvasEl"
				class="absolute inset-0 w-full h-full touch-none"
				@pointerdown.prevent="onDown"
				@pointermove.prevent="onMove"
				@pointerup="onUp"
				@pointerleave="onUp"
				@pointercancel="onUp"
			/>
			<template v-if="props.disabled">
				<div class="absolute inset-0 bg-red-500/8 pointer-events-none" />
				<svg
					class="absolute inset-0 w-full h-full pointer-events-none"
					viewBox="0 0 100 100"
					preserveAspectRatio="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<line
						x1="4"
						y1="4"
						x2="96"
						y2="96"
						stroke="rgb(239 68 68 / 0.55)"
						stroke-width="4"
						stroke-linecap="round"
					/>
					<line
						x1="96"
						y1="4"
						x2="4"
						y2="96"
						stroke="rgb(239 68 68 / 0.55)"
						stroke-width="4"
						stroke-linecap="round"
					/>
				</svg>
			</template>
		</div>

		<div class="mt-3 px-1 flex flex-col gap-2">
			<div class="flex gap-1.5 flex-wrap items-center">
				<button
					v-for="c in RAINBOW"
					:key="c"
					class="w-7 h-7 rounded-full border-[3px] shrink-0 transition-transform duration-100"
					:style="{
						background: c,
						borderColor:
							currentColor === c && tool !== 'eraser'
								? c === '#ffffff' || c === '#a3a3a3'
									? '#525252'
									: '#d4d4d4'
								: 'transparent'
					}"
					@click="selectColor(c)"
				/>
				<label
					class="relative w-7 h-7 rounded-full overflow-hidden cursor-pointer shrink-0 border-[3px]"
					:style="{ borderColor: isCustom && tool !== 'eraser' ? '#d4d4d4' : '#404040' }"
				>
					<span
						class="absolute inset-0 rounded-full"
						:style="{ background: customColor }"
					/>
					<input
						type="color"
						v-model="customColor"
						class="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
						@change="selectColor(customColor)"
					/>
				</label>
			</div>

			<!-- Sizes + opacity -->
			<div class="flex items-center gap-1.5">
				<button
					v-for="s in SIZES"
					:key="s"
					class="w-8 h-8 flex items-center justify-center rounded-lg border shrink-0 transition-colors"
					:class="penSize === s ? 'border-white/70 bg-white/15' : 'border-neutral-700'"
					@click="penSize = s"
				>
					<span
						class="rounded-full bg-white block"
						:style="{ width: `${Math.round(s / 2)}px`, height: `${Math.round(s / 2)}px` }"
					/>
				</button>
				<input
					type="range"
					v-model.number="opacity"
					min="0.1"
					max="1"
					step="0.05"
					class="flex-1 h-1 accent-white ml-1"
					aria-label="Opacity"
				/>
				<span class="text-xs text-neutral-400 w-7 text-right tabular-nums"
					>{{ Math.round(opacity * 100) }}%</span
				>
			</div>

			<div class="flex gap-1.5 flex-wrap items-center">
				<button
					v-for="s in SHAPES"
					:key="s.id"
					class="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs border transition-colors"
					:class="
						tool === s.id
							? 'border-white/60 bg-white/15 text-white'
							: 'border-neutral-700 text-neutral-400'
					"
					@click="tool = s.id as typeof tool"
				>
					<UIcon
						:name="s.icon"
						class="size-3.5"
					/>
					{{ s.label }}
				</button>
			</div>

			<div class="flex items-center gap-1.5">
				<button
					v-for="t in TOOLS"
					:key="t.id"
					class="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs border transition-colors"
					:class="
						tool === t.id
							? 'border-white/60 bg-white/15 text-white'
							: 'border-neutral-700 text-neutral-400'
					"
					@click="tool = t.id as typeof tool"
				>
					<UIcon
						:name="t.icon"
						class="size-3.5"
					/>
					{{ t.label }}
				</button>
				<div class="flex-1" />
				<button
					class="p-1.5 rounded-lg border border-neutral-700 transition-colors"
					:class="canUndo ? 'text-neutral-300' : 'text-neutral-600 cursor-not-allowed'"
					:disabled="!canUndo"
					@click="undo"
				>
					<UIcon
						name="i-lucide-undo-2"
						class="size-4"
					/>
				</button>
				<button
					class="p-1.5 rounded-lg border border-red-900/60 text-red-400"
					@click="clearCanvas"
				>
					<UIcon
						name="i-lucide-trash-2"
						class="size-4"
					/>
				</button>
				<button
					class="px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors"
					:class="
						props.disabled
							? 'bg-success/30 text-neutral-600 cursor-not-allowed'
							: 'bg-success text-neutral-900 cursor-pointer'
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

<script lang="ts">
// canvas persistence across mounts
const persistedCanvas = ref<string | null>(null);
</script>

<script setup lang="ts">
const props = defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ capture: [file: File]; close: [] }>();

const CANVAS_SIZE = 800;
const RAINBOW = [
	'#ef4444',
	'#f97316',
	'#eab308',
	'#22c55e',
	'#3b82f6',
	'#8b5cf6',
	'#ec4899',
	'#ffffff',
	'#a3a3a3',
	'#000000'
];
const SIZES = [4, 8, 16, 28];
const TOOLS = [
	{ id: 'pen', icon: 'i-lucide-pen-line', label: 'Pen' },
	{ id: 'eraser', icon: 'i-lucide-eraser', label: 'Eraser' },
	{ id: 'fill', icon: 'i-lucide-paint-bucket', label: 'Fill' }
];
const SHAPES = [
	{ id: 'line', icon: 'i-lucide-minus', label: 'Line' },
	{ id: 'rect', icon: 'i-lucide-square', label: 'Rect' },
	{ id: 'circle', icon: 'i-lucide-circle', label: 'Circle' },
	{ id: 'triangle', icon: 'i-lucide-triangle', label: 'Triangle' },
	{ id: 'octagon', icon: 'i-lucide-octagon', label: 'Octagon' }
];

const tool = ref<'pen' | 'eraser' | 'fill' | 'line' | 'rect' | 'circle' | 'triangle' | 'octagon'>(
	'pen'
);
const currentColor = ref<string>(RAINBOW[0]!);
const customColor = ref('#ff0000');
const penSize = ref<number>(SIZES[1]!);
const opacity = ref(1);
const isDrawing = ref(false);
const canUndo = ref(false);
const isCustom = computed(() => !RAINBOW.includes(currentColor.value));

const canvasEl = ref<HTMLCanvasElement | null>(null);
const history: ImageData[] = [];
const shapeStart = ref<{ x: number; y: number } | null>(null);
const shapeSnapshot = ref<ImageData | null>(null);
const isShapeTool = computed(() =>
	['line', 'rect', 'circle', 'triangle', 'octagon'].includes(tool.value)
);

function ctx() {
	return canvasEl.value!.getContext('2d', { willReadFrequently: true })!;
}

function getPos(e: PointerEvent) {
	const canvas = canvasEl.value!;
	const rect = canvas.getBoundingClientRect();
	return {
		x: Math.round((e.clientX - rect.left) * (CANVAS_SIZE / rect.width)),
		y: Math.round((e.clientY - rect.top) * (CANVAS_SIZE / rect.height))
	};
}

function saveHistory() {
	history.push(ctx().getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE));
	if (history.length > 12) history.shift();
	canUndo.value = true;
}

function undo() {
	if (!history.length) return;
	ctx().putImageData(history.pop()!, 0, 0);
	canUndo.value = history.length > 0;
	persist();
}

function clearCanvas() {
	saveHistory();
	ctx().fillStyle = '#ffffff';
	ctx().fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
	persist();
}

function selectColor(c: string) {
	currentColor.value = c;
	if (!RAINBOW.includes(c)) customColor.value = c;
	// only snap back to pen when leaving the eraser; fill/shapes stay selected
	if (tool.value === 'eraser') tool.value = 'pen';
}

function onDown(e: PointerEvent) {
	if (props.disabled) return;
	const { x, y } = getPos(e);
	if (tool.value === 'fill') {
		saveHistory();
		floodFill(x, y);
		persist();
		return;
	}
	if (isShapeTool.value) {
		saveHistory();
		shapeStart.value = { x, y };
		shapeSnapshot.value = ctx().getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
		canvasEl.value!.setPointerCapture(e.pointerId);
		return;
	}
	saveHistory();
	isDrawing.value = true;
	const c = ctx();
	c.globalAlpha = opacity.value;
	c.strokeStyle = tool.value === 'eraser' ? '#ffffff' : (currentColor.value ?? '#000000');
	c.lineWidth = tool.value === 'eraser' ? (penSize.value ?? 8) * 2 : (penSize.value ?? 8);
	c.lineCap = 'round';
	c.lineJoin = 'round';
	c.beginPath();
	c.moveTo(x, y);
	c.lineTo(x + 0.1, y);
	c.stroke();
	canvasEl.value!.setPointerCapture(e.pointerId);
}

function onMove(e: PointerEvent) {
	const { x, y } = getPos(e);
	if (shapeStart.value && isShapeTool.value && shapeSnapshot.value) {
		ctx().putImageData(shapeSnapshot.value, 0, 0);
		drawShape(shapeStart.value.x, shapeStart.value.y, x, y);
		return;
	}
	if (!isDrawing.value) return;
	ctx().lineTo(x, y);
	ctx().stroke();
}

function onUp() {
	if (shapeStart.value && isShapeTool.value) {
		shapeStart.value = null;
		shapeSnapshot.value = null;
		ctx().beginPath();
		ctx().globalAlpha = 1;
		persist();
		return;
	}
	if (!isDrawing.value) return;
	isDrawing.value = false;
	ctx().beginPath();
	ctx().globalAlpha = 1;
	persist();
}

function persist() {
	persistedCanvas.value = canvasEl.value!.toDataURL('image/png');
}

function drawShape(x1: number, y1: number, x2: number, y2: number) {
	const c = ctx();
	c.globalAlpha = opacity.value;
	c.strokeStyle = currentColor.value ?? '#000000';
	c.lineWidth = penSize.value;
	c.lineCap = 'round';
	c.lineJoin = 'round';
	c.beginPath();
	switch (tool.value) {
		case 'line':
			c.moveTo(x1, y1);
			c.lineTo(x2, y2);
			break;
		case 'rect':
			c.rect(x1, y1, x2 - x1, y2 - y1);
			break;
		case 'circle': {
			const rx = (x2 - x1) / 2;
			const ry = (y2 - y1) / 2;
			c.ellipse(x1 + rx, y1 + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
			break;
		}
		case 'triangle':
			c.moveTo((x1 + x2) / 2, y1);
			c.lineTo(x2, y2);
			c.lineTo(x1, y2);
			c.closePath();
			break;
		case 'octagon': {
			const cx = (x1 + x2) / 2;
			const cy = (y1 + y2) / 2;
			const rx2 = Math.abs(x2 - x1) / 2;
			const ry2 = Math.abs(y2 - y1) / 2;
			for (let i = 0; i < 8; i++) {
				const angle = (Math.PI * 2 * i) / 8 - Math.PI / 8;
				const px = cx + rx2 * Math.cos(angle);
				const py = cy + ry2 * Math.sin(angle);
				if (i === 0) c.moveTo(px, py);
				else c.lineTo(px, py);
			}
			c.closePath();
			break;
		}
	}
	c.stroke();
}

function floodFill(startX: number, startY: number) {
	const c = ctx();
	const imageData = c.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
	const { data } = imageData;
	const w = CANVAS_SIZE;

	const si = (startY * w + startX) * 4;
	const tr = data[si],
		tg = data[si + 1],
		tb = data[si + 2],
		ta = data[si + 3];

	const hex = (currentColor.value ?? '#000000').replace('#', '');
	const fr = parseInt(hex.slice(0, 2), 16);
	const fg = parseInt(hex.slice(2, 4), 16);
	const fb = parseInt(hex.slice(4, 6), 16);
	const fa = Math.round(opacity.value * 255);

	if (tr === fr && tg === fg && tb === fb && ta === fa) return;

	const visited = new Uint8Array(w * w);
	const stack = [startX + startY * w];

	while (stack.length) {
		const pos = stack.pop()!;
		if (visited[pos]) continue;
		const i = pos * 4;
		if (data[i] !== tr || data[i + 1] !== tg || data[i + 2] !== tb || data[i + 3] !== ta) continue;
		visited[pos] = 1;
		data[i] = fr;
		data[i + 1] = fg;
		data[i + 2] = fb;
		data[i + 3] = fa;
		const x = pos % w,
			y = Math.floor(pos / w);
		if (x > 0) stack.push(pos - 1);
		if (x < w - 1) stack.push(pos + 1);
		if (y > 0) stack.push(pos - w);
		if (y < w - 1) stack.push(pos + w);
	}
	c.putImageData(imageData, 0, 0);
}

function confirm() {
	if (props.disabled) return;
	canvasEl.value!.toBlob(
		(blob) => {
			if (!blob) return;
			emit('capture', new File([blob], `drawing-${Date.now()}.jpg`, { type: 'image/jpeg' }));
		},
		'image/jpeg',
		0.92
	);
}

onMounted(() => {
	const canvas = canvasEl.value!;
	canvas.width = CANVAS_SIZE;
	canvas.height = CANVAS_SIZE;
	if (persistedCanvas.value) {
		const img = new Image();
		img.onload = () => ctx().drawImage(img, 0, 0);
		img.src = persistedCanvas.value;
	} else {
		ctx().fillStyle = '#ffffff';
		ctx().fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
	}
});
</script>
