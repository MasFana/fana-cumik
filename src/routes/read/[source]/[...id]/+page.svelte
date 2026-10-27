<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Maximize2, Minimize2, ChevronLeft, ChevronRight, ChevronDown, AlertCircle, RefreshCw, BookOpen } from 'lucide-svelte';
	import { saveReading } from '$lib/stores/history';

	const { data }: { data: PageData } = $props();
	let { pages, source, chapterId, mangaInfo, chapters, currentChapter, prevChapter, nextChapter, error } = $derived(data);

	let currentPage = $state(0);
	let readerMode = $state<'vertical' | 'horizontal'>('vertical');
	let showControls = $state(true);
	let lastScrollY = $state(0);
	let isFullscreen = $state(false);
	let showChapterList = $state(false);
	
	// Error handling
	function retryLoad() {
		window.location.reload();
	}

	function changeSource(newSource: string) {
		goto(`/?source=${newSource}`);
	}

	// Mobile touch handling
	let touchStartX = $state(0);
	let touchStartY = $state(0);
	let touchStartTime = $state(0);
	let lastTapTime = $state(0);
	let zoomLevel = $state(1);
	let isZoomed = $state(false);

	// Auto-hide controls with delay
	let hideControlsTimeout: ReturnType<typeof setTimeout> | null = null;
	const HIDE_DELAY = 3000;

	function proxyImage(url: string): string {
		return `/api/proxy?url=${encodeURIComponent(url)}&source=${source}`;
	}

	function scheduleHideControls() {
		if (hideControlsTimeout) clearTimeout(hideControlsTimeout);
		hideControlsTimeout = setTimeout(() => {
			if (!isZoomed) showControls = false;
			showChapterList = false;
		}, HIDE_DELAY);
	}

	function showControlsNow() {
		showControls = true;
		scheduleHideControls();
	}

	// Touch handling for swipe navigation
	function handleTouchStart(e: TouchEvent) {
		const touch = e.touches[0];
		touchStartX = touch.clientX;
		touchStartY = touch.clientY;
		touchStartTime = Date.now();
	}

	function handleTouchEnd(e: TouchEvent) {
		if (isZoomed || readerMode !== 'vertical') return;
		
		const touch = e.changedTouches[0];
		const deltaX = touch.clientX - touchStartX;
		const deltaY = touch.clientY - touchStartY;
		const deltaTime = Date.now() - touchStartTime;
		const velocity = Math.abs(deltaX) / deltaTime;

		// Double tap detection
		const now = Date.now();
		if (now - lastTapTime < 300 && Math.abs(deltaX) < 20 && Math.abs(deltaY) < 20) {
			toggleZoom(e);
			lastTapTime = 0;
			return;
		}
		lastTapTime = now;

		// Horizontal swipe for chapter navigation (vertical mode)
		if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50 && velocity > 0.3) {
			if (deltaX > 0 && prevChapter) {
				goToChapter(prevChapter.id);
			} else if (deltaX < 0 && nextChapter) {
				goToChapter(nextChapter.id);
			}
		}
		
		scheduleHideControls();
	}

	function toggleZoom(e: TouchEvent | MouseEvent) {
		const target = e.target as HTMLElement;
		if (target.tagName !== 'IMG') return;
		
		isZoomed = !isZoomed;
		if (isZoomed) {
			zoomLevel = 2;
		} else {
			zoomLevel = 1;
		}
	}

	function goToChapter(chapterUrl: string) {
		goto(`/read/${source}${chapterUrl}`);
	}

	function goBack() {
		if (mangaInfo?.slug) {
			goto(`/manga/${source}/${mangaInfo.slug}`);
		} else {
			goto(`/?source=${source}`);
		}
	}

	function nextPage() {
		if (currentPage < pages.length - 1) {
			currentPage++;
		} else if (nextChapter) {
			goToChapter(nextChapter.id);
		}
	}

	function prevPage() {
		if (currentPage > 0) {
			currentPage--;
		} else if (prevChapter) {
			goToChapter(prevChapter.id);
		}
	}

	// Save reading progress
	$effect(() => {
		if (pages.length > 0 && mangaInfo) {
			saveReading({
				source,
				mangaId: mangaInfo.id,
				mangaTitle: mangaInfo.title,
				mangaCover: mangaInfo.cover,
				chapterId,
				chapterTitle: currentChapter?.title || '',
				page: currentPage,
				slug: mangaInfo.slug
			});
		}
	});

	// Keyboard navigation
	$effect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
			
			switch (e.key) {
				case 'ArrowRight':
				case ' ':
					e.preventDefault();
					nextPage();
					break;
				case 'ArrowLeft':
					e.preventDefault();
					prevPage();
					break;
				case 'ArrowUp':
					e.preventDefault();
					if (prevChapter) goToChapter(prevChapter.id);
					break;
				case 'ArrowDown':
					e.preventDefault();
					if (nextChapter) goToChapter(nextChapter.id);
					break;
				case 'f':
				case 'F':
					toggleFullscreen();
					break;
				case 'm':
				case 'M':
					toggleMode();
					break;
				case 'Escape':
					if (isZoomed) {
						isZoomed = false;
						zoomLevel = 1;
					} else if (showChapterList) {
						showChapterList = false;
					} else if (isFullscreen) {
						toggleFullscreen();
					}
					break;
			}
		}
		
		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	});

	function toggleMode() {
		readerMode = readerMode === 'vertical' ? 'horizontal' : 'vertical';
		currentPage = 0;
	}

	function toggleFullscreen() {
		if (!isFullscreen) {
			const elem = document.documentElement;
			if (elem.requestFullscreen) {
				elem.requestFullscreen();
			}
			isFullscreen = true;
		} else {
			if (document.exitFullscreen) {
				document.exitFullscreen();
			}
			isFullscreen = false;
		}
	}

	// Handle fullscreen change
	$effect(() => {
		function onFullscreenChange() {
			isFullscreen = !!document.fullscreenElement;
		}
		document.addEventListener('fullscreenchange', onFullscreenChange);
		return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
	});
</script>

<svelte:head>
	<title>{currentChapter?.title || 'Chapter'}{currentChapter?.date ? ` · ${currentChapter.date}` : ''} - {mangaInfo?.title || 'Manga'} | FanaCumik</title>
	<meta name="description" content="Read {mangaInfo?.title || 'manga'} {currentChapter?.title || ''} online for free" />
</svelte:head>

<!-- Error State -->
{#if error || !pages || pages.length === 0}
	<div class="min-h-screen bg-black flex items-center justify-center px-4">
		<div class="text-center max-w-md">
			<AlertCircle class="w-16 h-16 text-red-500/80 mx-auto mb-4" />
			<h1 class="text-2xl font-bold text-white mb-2">Unable to Load Chapter</h1>
			<p class="text-zinc-400 mb-6">{error || 'Chapter not found or has no pages'}</p>
			
			<div class="flex flex-col sm:flex-row gap-3 justify-center items-center">
				<button
					onclick={retryLoad}
					class="flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] hover:opacity-90 rounded-xl font-medium transition-colors text-base shadow-lg shadow-[var(--color-primary)]/20 active:scale-[0.98]"
				>
					<RefreshCw class="w-5 h-5" />
					Retry
				</button>
				
				{#if mangaInfo?.slug}
					<a
						href="/manga/{source}/{mangaInfo.slug}"
						class="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium transition-colors text-base border border-zinc-700 active:scale-[0.98]"
					>
						<BookOpen class="w-5 h-5" />
						Back to Manga
					</a>
				{:else}
					<button
						onclick={goBack}
						class="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium transition-colors text-base border border-zinc-700 active:scale-[0.98]"
					>
						<ArrowLeft class="w-5 h-5" />
						Go Back
					</button>
				{/if}
				
				<button
					onclick={() => changeSource(source === 'komiku' ? 'asura' : 'komiku')}
					class="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm transition-colors"
				>
					Try {source === 'komiku' ? 'Asura' : 'Komiku'} instead
				</button>
			</div>
			
			{#if mangaInfo?.slug}
				<p class="mt-6 text-sm text-zinc-500">
					Or try a different chapter from the <a href="/manga/{source}/{mangaInfo.slug}" class="text-[var(--color-primary)] hover:underline">manga page</a>
				</p>
			{/if}
		</div>
	</div>
{:else}
<!-- Reader Container -->
<div
	class="reader-container min-h-screen bg-black"
	ontouchstart={handleTouchStart}
	ontouchend={handleTouchEnd}
	onmousemove={showControlsNow}
	role="application"
	aria-label="Manga Reader"
>
	<!-- Reading Progress Bar -->
	<div class="reader-progress" style="transform: scaleX({(currentPage + 1) / pages.length})"></div>
	
	<!-- Top Controls -->
	<header
		class="fixed top-0 left-0 right-0 z-50 transition-all duration-300 {showControls
			? 'translate-y-0 opacity-100'
			: '-translate-y-full opacity-0'}"
	>
		<div class="flex items-center justify-between px-2 sm:px-4 py-2 bg-linear-to-b from-black/95 to-transparent backdrop-blur-sm gap-2">
			<!-- Left: Back button -->
			<button
				onclick={goBack}
				class="flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors shrink-0"
				aria-label="Back"
			>
				<ArrowLeft class="w-4 h-4" />
				<span class="hidden sm:inline">Back</span>
			</button>

			<!-- Center: Chapter navigation -->
			<div class="flex items-center justify-center gap-1 sm:gap-2 flex-1 min-w-0">
				<!-- Prev Chapter -->
				{#if prevChapter}
					<button
						onclick={() => goToChapter(prevChapter.id)}
						class="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors shrink-0"
						title="Previous Chapter"
					>
						<ChevronLeft class="w-4 h-4" />
					</button>
				{:else}
					<div class="w-7 sm:w-8 shrink-0"></div>
				{/if}

				<!-- Chapter Selector -->
				<div class="relative min-w-0 shrink">
					<button
						onclick={() => showChapterList = !showChapterList}
						class="flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors w-full max-w-[140px] sm:max-w-[300px]"
					>
						<div class="flex flex-col items-start truncate w-full">
							<span class="truncate font-medium">{currentChapter?.title || 'Chapters'}</span>
							{#if currentChapter?.date}
								<span class="truncate text-[10px] text-zinc-500">{currentChapter.date}</span>
							{/if}
						</div>
						<ChevronDown class="w-4 h-4 shrink-0 transition-transform {showChapterList ? 'rotate-180' : ''}" />
					</button>

					<!-- Chapter Dropdown -->
									{#if showChapterList}
										<div class="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[85vw] sm:w-80 max-h-[60vh] overflow-y-auto bg-zinc-900/95 backdrop-blur-md border border-zinc-700 rounded-lg shadow-xl z-50">
											{#each chapters as chapter}
												{#if chapter.title}
													<button
														onclick={() => goToChapter(chapter.id)}
														class="w-full px-4 py-3 sm:py-2 text-left text-sm hover:bg-[var(--color-primary)]/30 transition-colors {chapter.id === chapterId ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]' : 'text-zinc-300'}"
													>
														<div class="flex flex-col items-start truncate w-full">
															{#if chapter.title.match(/^(Chapter\s+\d+(?:\.\d+)?)(.+)$/i)}
																<span class="truncate font-medium">{chapter.title.match(/^(Chapter\s+\d+(?:\.\d+)?)(.+)$/i)[1].trim()}</span>
																<span class="truncate text-[10px] text-zinc-500">{chapter.title.match(/^(Chapter\s+\d+(?:\.\d+)?)(.+)$/i)[2].trim()}</span>
															{:else}
																<span class="truncate">{chapter.title}</span>
															{/if}
														</div>
													</button>
												{/if}
											{/each}
											{#if chapters.length === 0}
												<p class="px-4 py-3 text-sm text-zinc-500">No chapters available</p>
											{/if}
										</div>
									{/if}
				</div>

				<!-- Next Chapter -->
				{#if nextChapter}
					<button
						onclick={() => goToChapter(nextChapter.id)}
						class="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors shrink-0"
						title="Next Chapter"
					>
						<ChevronRight class="w-4 h-4" />
					</button>
				{:else}
					<div class="w-7 sm:w-8 shrink-0"></div>
				{/if}
			</div>

			<!-- Right: Mode & Fullscreen -->
			<div class="flex items-center gap-1 sm:gap-2 shrink-0">
				<span class="text-xs text-zinc-500 hidden md:flex items-center mr-1">
					{currentPage + 1}/{pages.length}
				</span>
				<button
					onclick={toggleMode}
					class="px-2 sm:px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors"
				>
					{readerMode === 'vertical' ? 'Scroll' : 'Paged'}
				</button>
				<button
					onclick={toggleFullscreen}
					class="p-1.5 sm:px-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
					title="Toggle Fullscreen"
				>
					{#if isFullscreen}
						<Minimize2 class="w-4 h-4" />
					{:else}
						<Maximize2 class="w-4 h-4" />
					{/if}
				</button>
			</div>
		</div>
	</header>

	<!-- Vertical Mode -->
	{#if readerMode === 'vertical'}
		<div class="reader-pages flex flex-col items-center pt-14 pb-8">
			{#each pages as pageUrl, i}
				<img
					src={proxyImage(pageUrl)}
					alt="Page {i + 1}"
					loading={i < 3 ? 'eager' : 'lazy'}
					class="reader-image"
					ondblclick={toggleZoom}
					ontouchend={handleTouchEnd}
				/>
			{/each}

			<!-- End of chapter navigation -->
							<div class="flex flex-col items-center gap-4 py-8 px-4">
								<p class="text-zinc-500 text-sm">End of chapter</p>
								<div class="flex gap-3 w-full max-w-xs justify-center">
									{#if prevChapter}
										<button
											onclick={() => goToChapter(prevChapter.id)}
											class="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors flex-1 justify-center"
										>
											<ChevronLeft class="w-4 h-4" />
											<div class="text-left hidden sm:block">
												<div class="truncate font-medium">{prevChapter.title?.match(/^(Chapter\s+\d+(?:\.\d+)?)(.+)$/i)?.[1]?.trim() || prevChapter.title || 'Previous'}</div>
												{#if prevChapter.title?.match(/^(Chapter\s+\d+(?:\.\d+)?)(.+)$/i)?.[2]}
													<div class="truncate text-[10px] text-zinc-500">{prevChapter.title.match(/^(Chapter\s+\d+(?:\.\d+)?)(.+)$/i)[2].trim()}</div>
												{/if}
											</div>
										</button>
									{/if}
									{#if nextChapter}
										<button
											onclick={() => goToChapter(nextChapter.id)}
											class="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:opacity-90 rounded-lg text-sm font-medium transition-colors flex-1 justify-center"
										>
											<div class="text-right hidden sm:block">
												<div class="truncate font-medium">{nextChapter.title?.match(/^(Chapter\s+\d+(?:\.\d+)?)(.+)$/i)?.[1]?.trim() || nextChapter.title || 'Next'}</div>
												{#if nextChapter.title?.match(/^(Chapter\s+\d+(?:\.\d+)?)(.+)$/i)?.[2]}
													<div class="truncate text-[10px] text-zinc-500">{nextChapter.title.match(/^(Chapter\s+\d+(?:\.\d+)?)(.+)$/i)[2].trim()}</div>
												{/if}
											</div>
											<ChevronRight class="w-4 h-4" />
										</button>
									{/if}
								</div>
							</div>
		</div>
	{:else}
		<!-- Horizontal Mode -->
		<div
			class="flex items-center justify-center min-h-screen pt-14 cursor-pointer"
			role="button"
			tabindex="0"
			onclick={nextPage}
			onkeypress={() => {}}
		>
			<!-- Prev Button -->
			<button
				class="fixed left-0 top-1/2 -translate-y-1/2 w-16 h-24 flex items-center justify-center bg-black/50 hover:bg-[var(--color-primary)]/50 transition-colors disabled:opacity-20"
				onclick={(e) => {
					e.stopPropagation();
					prevPage();
				}}
				disabled={currentPage === 0}
			>
				<ChevronLeft class="w-8 h-8" />
			</button>

			<img
				src={proxyImage(pages[currentPage])}
				alt="Page {currentPage + 1}"
				class="reader-image-horizontal max-h-[95vh] object-contain"
				ondblclick={toggleZoom}
				ontouchend={handleTouchEnd}
			/>

			<!-- Next Button -->
			<button
				class="fixed right-0 top-1/2 -translate-y-1/2 w-16 h-24 flex items-center justify-center bg-black/50 hover:bg-[var(--color-primary)]/50 transition-colors disabled:opacity-20"
				onclick={(e) => {
					e.stopPropagation();
					nextPage();
				}}
				disabled={currentPage === pages.length - 1}
			>
				<ChevronRight class="w-8 h-8" />
			</button>
		</div>
	{/if}
</div>
{/if}

<style>
	/* Mobile: fill viewport width */
	.reader-image {
		width: 100vw;
		max-width: 100vw;
		height: auto;
		display: block;
		transition: transform 0.2s ease-out;
		transform-origin: center center;
	}

	/* Desktop: constrained for readability */
	@media (min-width: 769px) {
		.reader-image {
			width: 100%;
			max-width: 800px;
		}
	}

	/* Horizontal mode image */
	.reader-image-horizontal {
		max-width: 90vw;
		height: auto;
		transition: transform 0.2s ease-out;
		transform-origin: center center;
	}

	@media (min-width: 769px) {
		.reader-image-horizontal {
			max-width: min(90vw, 1000px);
		}
	}

	/* Hide scrollbar for chapter list */
	.reader-container :global(.overflow-y-auto) {
		scrollbar-width: thin;
		scrollbar-color: var(--color-primary) transparent;
	}

	/* Smooth header transitions */
	header {
		transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
	}

	/* Chapter dropdown animation */
	.absolute.top-full {
		animation: dropdownSlide 0.2s ease-out;
	}

	@keyframes dropdownSlide {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	/* Tap highlight removal */
	* {
		-webkit-tap-highlight-color: transparent;
	}

	/* Better focus states for accessibility */
	button:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	/* Reading progress indicator */
	.reader-progress {
		position: fixed;
		bottom: 0;
		left: 0;
		height: 2px;
		background: var(--color-primary);
		z-index: 100;
		transform-origin: left;
	}

	/* Zoom cursor */
	.reader-image[style*="scale(2)"],
	.reader-image-horizontal[style*="scale(2)"] {
		cursor: grab;
	}

	.reader-image[style*="scale(2)"]:active,
	.reader-image-horizontal[style*="scale(2)"]:active {
		cursor: grabbing;
	}

	/* Prevent text selection during reading */
	.reader-container {
		user-select: none;
		-webkit-user-select: none;
	}

	/* Smooth chapter navigation buttons */
	button[onclick*="goToChapter"] {
		transition: all 0.15s ease;
	}

	button[onclick*="goToChapter"]:active {
		transform: scale(0.95);
	}

	/* Error state animations */
	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(20px); }
		to { opacity: 1; transform: translateY(0); }
	}
	
	.min-h-screen > div:first-child {
		animation: fadeIn 0.4s ease-out;
	}
</style>