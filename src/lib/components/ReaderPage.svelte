<script lang="ts">
	import { onMount } from 'svelte';
	import CatPawLoader from './CatPawLoader.svelte';
	import { AlertCircle, RefreshCw } from 'lucide-svelte';

	let {
		pageIndex,
		totalPages,
		proxyUrl,
		initialActive = false,
		onVisible,
		ondblclick
	}: {
		pageIndex: number;
		totalPages: number;
		proxyUrl: string;
		initialActive?: boolean;
		onVisible?: (index: number) => void;
		ondblclick?: (e: MouseEvent | TouchEvent) => void;
	} = $props();

	let containerEl: HTMLDivElement | null = $state(null);
	let inPreloadRange = $state(false);
	let isVisible = $state(false);
	let loaded = $state(false);
	let error = $state(false);
	let retryCount = $state(0);

	$effect(() => {
		if (initialActive) {
			inPreloadRange = true;
			isVisible = true;
		}
	});

	let currentSrc = $derived.by(() => {
		if (!inPreloadRange) return '';
		if (retryCount > 0) {
			const separator = proxyUrl.includes('?') ? '&' : '?';
			return `${proxyUrl}${separator}_retry=${retryCount}`;
		}
		return proxyUrl;
	});

	onMount(() => {
		if (!containerEl) return;

		// 1. Preload Observer: starts loading image before it enters viewport
		const preloadObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						inPreloadRange = true;
						preloadObserver.disconnect();
					}
				}
			},
			{ rootMargin: '1400px 0px 1400px 0px' }
		);

		preloadObserver.observe(containerEl);

		// 2. Viewport Observer: detects when page is visible to user
		const viewObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					isVisible = entry.isIntersecting;
					if (entry.isIntersecting && entry.intersectionRatio >= 0.2) {
						onVisible?.(pageIndex);
					}
				}
			},
			{ threshold: [0.1, 0.2, 0.5] }
		);

		viewObserver.observe(containerEl);

		return () => {
			preloadObserver.disconnect();
			viewObserver.disconnect();
		};
	});

	function handleRetry() {
		error = false;
		loaded = false;
		inPreloadRange = true;
		retryCount++;
	}
</script>

<div
	bind:this={containerEl}
	id="reader-page-{pageIndex}"
	data-page={pageIndex}
	class="reader-page-container relative flex flex-col items-center justify-center w-full min-h-[500px] sm:min-h-[650px] bg-zinc-950/40"
>
	<!-- Loading state with Cat Paw Animation -->
	{#if !loaded && !error}
		<div class="absolute inset-0 flex flex-col items-center justify-center p-6 z-10 pointer-events-none">
			<CatPawLoader size="lg" text="Halaman {pageIndex + 1} / {totalPages}" />
		</div>
	{/if}

	<!-- Error state with Retry -->
	{#if error}
		<div class="flex flex-col items-center justify-center gap-3 p-8 my-12 bg-zinc-900/80 border border-red-900/50 rounded-2xl max-w-sm text-center z-10 shadow-xl">
			<AlertCircle class="w-10 h-10 text-red-400" />
			<div>
				<p class="text-sm font-medium text-white">Gagal memuat halaman {pageIndex + 1}</p>
				<p class="text-xs text-zinc-400 mt-1">Koneksi lambat atau server sumber sibuk</p>
			</div>
			<button
				onclick={handleRetry}
				class="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:opacity-90 rounded-lg text-sm font-medium text-white transition-transform active:scale-95 shadow-md shadow-[var(--color-primary)]/20"
			>
				<RefreshCw class="w-4 h-4" />
				Coba Lagi
			</button>
		</div>
	{:else if currentSrc}
		<img
			src={currentSrc}
			alt="Page {pageIndex + 1}"
			loading={pageIndex < 2 ? 'eager' : 'lazy'}
			fetchpriority={isVisible || pageIndex === 0 ? 'high' : 'auto'}
			decoding="async"
			onload={() => (loaded = true)}
			onerror={() => {
				error = true;
				loaded = true;
			}}
			class="reader-image transition-opacity duration-300 {loaded ? 'opacity-100' : 'opacity-0'}"
			{ondblclick}
		/>
	{/if}
</div>

<style>
	/* Mobile: fill viewport width */
	.reader-image {
		width: 100vw;
		max-width: 100vw;
		height: auto;
		display: block;
		transition: transform 0.2s ease-out, opacity 0.3s ease;
		transform-origin: center center;
	}

	/* Desktop: constrained for readability */
	@media (min-width: 769px) {
		.reader-image {
			width: 100%;
			max-width: 800px;
		}
	}
</style>
