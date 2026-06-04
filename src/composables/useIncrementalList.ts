import { extractServerMessage } from 'errors';

export function useIncrementalList<T>(options?: {
	staggerMs?: number;
	initialExpectedCount?: number;
}) {
	const itemsRef = ref<T[]>([]) as Ref<T[]>;
	const expectedCountRef = ref(options?.initialExpectedCount ?? 0);
	const isLoadingRef = ref(false);
	const errorRef = ref<string | null>(null);
	const stagger = Math.max(0, options?.staggerMs ?? 80);

	let currentToken = 0;

	const remainingRef = computed(() => Math.max(0, expectedCountRef.value - itemsRef.value.length));

	const sleep = (ms: number) =>
		new Promise<void>((resolve) => {
			setTimeout(resolve, ms);
		});

	async function load(
		loader: () => Promise<T[] | null | undefined>,
		opts?: { keepExisting?: boolean; expectedHint?: number }
	) {
		const token = ++currentToken;
		if (!opts?.keepExisting) {
			itemsRef.value = [];
		}
		if (typeof opts?.expectedHint === 'number') {
			expectedCountRef.value = opts.expectedHint;
		}
		errorRef.value = null;
		isLoadingRef.value = true;

		try {
			const fetched = await loader();
			if (token !== currentToken) return;

			if (!fetched || fetched.length === 0) {
				expectedCountRef.value = itemsRef.value.length;
				return;
			}

			expectedCountRef.value = itemsRef.value.length + fetched.length;

			if (stagger === 0) {
				itemsRef.value.push(...fetched);
				return;
			}

			for (const item of fetched) {
				if (token !== currentToken) return;
				itemsRef.value.push(item);
				if (stagger > 0) await sleep(stagger);
			}
		} catch (err: any) {
			if (token !== currentToken) return;
			console.error('useIncrementalList load failed:', err);
			errorRef.value = extractServerMessage(err, 'Failed to load more items.');
			expectedCountRef.value = itemsRef.value.length;
		} finally {
			if (token === currentToken) {
				isLoadingRef.value = false;
			}
		}
	}

	function reset(newExpectedCount?: number) {
		currentToken++;
		itemsRef.value = [];
		expectedCountRef.value = newExpectedCount ?? options?.initialExpectedCount ?? 0;
		isLoadingRef.value = false;
		errorRef.value = null;
	}

	return reactive({
		items: itemsRef,
		isLoading: isLoadingRef,
		expectedCount: expectedCountRef,
		remaining: remainingRef,
		error: errorRef,
		load,
		reset
	});
}
