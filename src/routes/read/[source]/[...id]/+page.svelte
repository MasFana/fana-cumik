<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Maximize2, Minimize2, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-svelte';
	import { saveReading } from '$lib/stores/history';
	import debug from '$lib/utils/debug';

	const { data }: { data: PageData } = $props();
	let { pages, source, chapterId, mangaInfo, chapters, currentChapter, prevChapter, nextChapter } = $derived(data);

	let currentPage = $state(0);
	let readerMode = $state<'vertical' | 'horizontal'>('vertical');
	let showControls = $state(true);
	let lastScrollY = $state(0);
	let isFullscreen = $state(false);
	let showChapterList = $state(false);

	function proxyImage(url: string): string {
		return `/api/proxy?url=${encodeURIComponent(url)}&source=${source}`;
	}

	// Auto-hide controls on scroll
	function handleScroll() {
		const currentScrollY = window.scrollY;

		if (currentScrollY > lastScrollY && currentScrollY > 100) {
			showControls = false; // Scrolling down
			showChapterList = false; // Also hide chapter list
		} else {
			showControls = true; // Scrolling up
		}

		lastScrollY = currentScrollY;
	}

	function prevPage() {
		if (currentPage > 0) currentPage--;
	}

	function nextPage() {
		if (currentPage < pages.length - 1) currentPage++;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (readerMode === 'horizontal') {
			if (e.key === 'ArrowLeft') prevPage();
			if (e.key === 'ArrowRight') nextPage();
		}
	}

	function toggleMode() {
		readerMode = readerMode === 'vertical' ? 'horizontal' : 'vertical';
	}

	function toggleFullscreen() {
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen();
			isFullscreen = true;
		} else {
			document.exitFullscreen();
			isFullscreen = false;
		}
	}

	// Show controls on mouse move
	function handleMouseMove() {
		showControls = true;
	}

	// Navigate to chapter
	function goToChapter(chapterId: string) {
		showChapterList = false;
		goto(`/read/${source}${chapterId}`);
	}

	// Navigate back to manga page
	function goBack() {
		goto(`/manga/${source}/${mangaInfo.slug}`);
	}

	// Save reading progress on mount
	onMount(() => {
		saveReading({
			mangaId: mangaInfo.id,
			mangaSlug: mangaInfo.slug,
			mangaTitle: mangaInfo.title,
			cover: mangaInfo.cover,
			chapterId: chapterId,
			chapterTitle: currentChapter?.title || `Chapter ${currentChapter?.number || 0}`,
			chapterNumber: currentChapter?.number || 0,
			sourceId: source
		});
	});
</script>

<svelte:window onkeydown={handleKeydown} onscroll={handleScroll} />

<svelte:head>
	<title>{mangaInfo.title} - {currentChapter?.title || 'Reader'} | FanaCumik</title>
</svelte:head>

<div
	class="reader-container min-h-screen bg-black"
	onmousemove={handleMouseMove}
	role="application"
	aria-label="Manga Reader"
>
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
						<span class="truncate">{currentChapter?.title || 'Chapters'}</span>
						<ChevronDown class="w-4 h-4 shrink-0 transition-transform {showChapterList ? 'rotate-180' : ''}" />
					</button>

					<!-- Chapter Dropdown -->
					{#if showChapterList}
						<div class="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[85vw] sm:w-80 max-h-[60vh] overflow-y-auto bg-zinc-900/95 backdrop-blur-md border border-zinc-700 rounded-lg shadow-xl z-50">
							{#each chapters as chapter}
								<button
									onclick={() => goToChapter(chapter.id)}
									class="w-full px-4 py-3 sm:py-2 text-left text-sm hover:bg-[var(--color-primary)]/30 transition-colors {chapter.id === chapterId ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]' : 'text-zinc-300'}"
								>
									{chapter.title}
								</button>
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
				/>
			{/each}

			<!-- End of chapter navigation -->
			<div class="flex flex-col items-center gap-4 py-8 px-4">
				<p class="text-zinc-500 text-sm">End of chapter</p>
				<div class="flex gap-3">
					{#if prevChapter}
						<button
							onclick={() => goToChapter(prevChapter.id)}
							class="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
						>
							<ChevronLeft class="w-4 h-4" />
							Previous
						</button>
					{/if}
					{#if nextChapter}
						<button
							onclick={() => goToChapter(nextChapter.id)}
							class="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:opacity-90 rounded-lg text-sm font-medium transition-colors"
						>
							Next
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

<style>
	/* Mobile: fill viewport width */
	.reader-image {
		width: 100vw;
		max-width: 100vw;
		height: auto;
		display: block;
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
</style>
