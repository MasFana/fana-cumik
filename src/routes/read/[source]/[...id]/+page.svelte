<script lang="ts">
	import type { PageData } from './$types';
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		ArrowLeft,
		Maximize2,
		Minimize2,
		ChevronLeft,
		ChevronRight,
		ChevronDown,
		AlertCircle,
		RefreshCw,
		BookOpen,
		Home,
		Library
	} from 'lucide-svelte';
	import {
		saveReading,
		saveChapterProgress,
		getChapterProgress
	} from '$lib/stores/history';
	import CatPawLoader from '$lib/components/CatPawLoader.svelte';
	import ReaderPage from '$lib/components/ReaderPage.svelte';

	const { data }: { data: PageData } = $props();
	let { pages, source, chapterId, mangaInfo, chapters, currentChapter, prevChapter, nextChapter, error } =
		$derived(data);

	let currentPage = $state(0);
	let initialActivePage = $state(0);
	let readerMode = $state<'vertical' | 'horizontal'>('vertical');
	let showControls = $state(true);
	let showChapterList = $state(false);
	let lastScrollY = $state(0);
	let isFullscreen = $state(false);
	let isZoomed = $state(false);
	let zoomLevel = $state(1);
	let horizontalLoaded = $state(false);
	let resumedPageNotification = $state<number | null>(null);
	let hideResumeTimeout: ReturnType<typeof setTimeout> | null = null;

	// Spreading Render Queue State
	let allowedToLoad = $state<boolean[]>([]);
	let loadedStates = $state<boolean[]>([]);
	let errorStates = $state<boolean[]>([]);
	const MAX_CONCURRENT_LOADS = 4;
	const NEAR_FORWARD_RADIUS = 2; // immediate next 2 pages
	const NEAR_BACKWARD_RADIUS = 1; // immediate previous 1 page

	function getSpreadingScore(idx: number, cursor: number): number {
		const diff = idx - cursor;
		if (diff === 0) return 0;
		if (diff > 0) {
			return diff;
		} else {
			return Math.abs(diff) * 1.5 + 2;
		}
	}

	function updateSpreadingQueue() {
		if (!pages || pages.length === 0) return;
		const total = pages.length;

		if (allowedToLoad.length !== total) {
			allowedToLoad = new Array(total).fill(false);
			loadedStates = new Array(total).fill(false);
			errorStates = new Array(total).fill(false);
		}

		// Always grant load permission to immediate near pages around currentPage
		const nearStart = Math.max(0, currentPage - NEAR_BACKWARD_RADIUS);
		const nearEnd = Math.min(total - 1, currentPage + NEAR_FORWARD_RADIUS);
		let hasChanges = false;

		for (let i = nearStart; i <= nearEnd; i++) {
			if (!allowedToLoad[i]) {
				allowedToLoad[i] = true;
				hasChanges = true;
			}
		}

		// Count in-flight image requests (allowed but not loaded and not error)
		let inFlight = 0;
		for (let i = 0; i < total; i++) {
			if (allowedToLoad[i] && !loadedStates[i] && !errorStates[i]) {
				inFlight++;
			}
		}

		// If near pages are loaded or slots open, spread rendering cursor outward
		const availableSlots = MAX_CONCURRENT_LOADS - inFlight;
		if (availableSlots > 0) {
			const candidates: number[] = [];
			for (let i = 0; i < total; i++) {
				if (!allowedToLoad[i]) {
					candidates.push(i);
				}
			}

			candidates.sort((a, b) => getSpreadingScore(a, currentPage) - getSpreadingScore(b, currentPage));

			const countToAllow = Math.min(availableSlots, candidates.length);
			for (let k = 0; k < countToAllow; k++) {
				allowedToLoad[candidates[k]] = true;
				hasChanges = true;
			}
		}

		if (hasChanges) {
			allowedToLoad = [...allowedToLoad];
		}
	}

	function requestImmediateLoad(idx: number) {
		if (idx >= 0 && idx < allowedToLoad.length && !allowedToLoad[idx]) {
			allowedToLoad[idx] = true;
			allowedToLoad = [...allowedToLoad];
			updateSpreadingQueue();
		}
	}

	function handlePageLoaded(idx: number) {
		if (idx >= 0 && idx < loadedStates.length) {
			loadedStates[idx] = true;
			errorStates[idx] = false;
			updateSpreadingQueue();
		}
	}

	function handlePageError(idx: number) {
		if (idx >= 0 && idx < errorStates.length) {
			errorStates[idx] = true;
			updateSpreadingQueue();
		}
	}

	// Mobile touch handling
	let touchStartX = $state(0);
	let touchStartY = $state(0);
	let touchStartTime = $state(0);
	let lastTapTime = $state(0);

	// Auto-hide controls with delay
	let hideControlsTimeout: ReturnType<typeof setTimeout> | null = null;
	const HIDE_DELAY = 3000;

	function proxyImage(url: string): string {
		return `/api/proxy?url=${encodeURIComponent(url)}&source=${source}`;
	}

	function scheduleHideControls() {
		if (hideControlsTimeout) clearTimeout(hideControlsTimeout);
		hideControlsTimeout = setTimeout(() => {
			if (showChapterList) return;
			if (!isZoomed) showControls = false;
		}, HIDE_DELAY);
	}

	function showControlsNow() {
		showControls = true;
		scheduleHideControls();
	}

	// Scroll down = get the bar out of the way, scroll up = bring it back briefly
	let scrollTicking = false;
	function handleScroll() {
		if (scrollTicking) return;
		scrollTicking = true;
		requestAnimationFrame(() => {
			const y = window.scrollY;
			const dy = y - lastScrollY;
			if (y < 60) {
				showControls = true;
			} else if (dy > 6) {
				showControls = false;
				showChapterList = false;
			} else if (dy < -6) {
				showControls = true;
				scheduleHideControls();
			}
			lastScrollY = y;
			scrollTicking = false;
		});
	}

	// Desktop: hover reveals the bar (touch pointers are ignored, they fight scroll-hide)
	function handlePointerMove(e: PointerEvent) {
		if (e.pointerType !== 'mouse' || showControls) return;
		showControls = true;
		scheduleHideControls();
	}

	function toggleChapterList() {
		showChapterList = !showChapterList;
		if (showChapterList) showControls = true;
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
		// Touches that land on the bar belong to its buttons, not to the tap-toggle
		if ((e.target as HTMLElement)?.closest('header, a, button')) return;

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
			return;
		}

		// Plain tap on a panel = show/hide the bar
		if (Math.abs(deltaX) < 12 && Math.abs(deltaY) < 12) {
			showControls = !showControls;
			if (!showControls) showChapterList = false;
			else scheduleHideControls();
			return;
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
		window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
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
			horizontalLoaded = false;
			saveCurrentProgress(currentPage);
			updateSpreadingQueue();
		} else if (nextChapter) {
			goToChapter(nextChapter.id);
		}
	}

	function prevPage() {
		if (currentPage > 0) {
			currentPage--;
			horizontalLoaded = false;
			saveCurrentProgress(currentPage);
			updateSpreadingQueue();
		} else if (prevChapter) {
			goToChapter(prevChapter.id);
		}
	}

	// Track and save reading progress debounced
	let progressDebounce: ReturnType<typeof setTimeout> | null = null;
	function saveCurrentProgress(pageIdx: number) {
		if (progressDebounce) clearTimeout(progressDebounce);
		progressDebounce = setTimeout(() => {
			if (!chapterId || !source) return;

			saveChapterProgress(source, chapterId, {
				pageIndex: pageIdx,
				scrollY: window.scrollY,
				totalPages: pages.length
			});

			if (pages.length > 0 && mangaInfo) {
				saveReading({
					sourceId: source,
					mangaId: mangaInfo.id,
					mangaSlug: mangaInfo.slug || '',
					mangaTitle: mangaInfo.title,
					cover: mangaInfo.cover,
					chapterId,
					chapterTitle: currentChapter?.title || '',
					chapterNumber: currentChapter?.number || 0,
					pageIndex: pageIdx,
					totalPages: pages.length
				});
			}
		}, 300);
	}

	function handlePageVisible(idx: number) {
		if (currentPage !== idx) {
			currentPage = idx;
			saveCurrentProgress(idx);
			updateSpreadingQueue();
		}
	}

	// Restore scroll position on chapter mount/change
	async function restoreChapterPosition() {
		if (!source || !chapterId || pages.length === 0) return;

		const saved = getChapterProgress(source, chapterId);
		if (saved && saved.pageIndex > 0 && saved.pageIndex < pages.length) {
			currentPage = saved.pageIndex;
			initialActivePage = saved.pageIndex;
			resumedPageNotification = saved.pageIndex + 1;
			updateSpreadingQueue();

			if (hideResumeTimeout) clearTimeout(hideResumeTimeout);
			hideResumeTimeout = setTimeout(() => {
				resumedPageNotification = null;
			}, 4000);

			await tick();
			// Scroll into view after page containers mount
			setTimeout(() => {
				const el = document.getElementById(`reader-page-${saved.pageIndex}`);
				if (el) {
					el.scrollIntoView({ behavior: 'instant', block: 'start' });
				} else if (saved.scrollY > 0) {
					window.scrollTo({ top: saved.scrollY, behavior: 'instant' });
				}
			}, 60);
		} else {
			// Brand new chapter -> reset to top
			currentPage = 0;
			initialActivePage = 0;
			updateSpreadingQueue();
			window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
		}
	}

	// Trigger restore and reset spreading queue when chapter or source changes
	$effect(() => {
		const len = pages ? pages.length : 0;
		chapterId;
		source;
		allowedToLoad = new Array(len).fill(false);
		loadedStates = new Array(len).fill(false);
		errorStates = new Array(len).fill(false);
		restoreChapterPosition();
	});

	function scrollToTop() {
		window.scrollTo({ top: 0, behavior: 'smooth' });
		resumedPageNotification = null;
		currentPage = 0;
		if (source && chapterId) {
			saveChapterProgress(source, chapterId, {
				pageIndex: 0,
				scrollY: 0,
				totalPages: pages.length
			});
		}
	}

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
		horizontalLoaded = false;
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

	// Error handling
	function retryLoad() {
		window.location.reload();
	}

	function changeSource(newSource: string) {
		goto(`/?source=${newSource}`);
	}
</script>

<svelte:head>
	<title>{currentChapter?.title || 'Chapter'}{currentChapter?.date ? ` · ${currentChapter.date}` : ''} - {mangaInfo?.title || 'Manga'} | FanaCumik</title>
	<meta name="description" content="Read {mangaInfo?.title || 'manga'} {currentChapter?.title || ''} online for free" />
</svelte:head>

<svelte:window onscroll={handleScroll} />

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
	<!-- Keyed by source and chapterId so all previous chapter DOM is completely destroyed on switch -->
	{#key `${source}:${chapterId}`}
		<div
			class="reader-container min-h-screen bg-black"
			ontouchstart={handleTouchStart}
			ontouchend={handleTouchEnd}
			onpointermove={handlePointerMove}
			role="application"
			aria-label="Manga Reader"
		>
			<!-- Reading Progress Bar -->
			<div class="reader-progress" style="transform: scaleX({(currentPage + 1) / pages.length})"></div>

			<!-- Top Controls: one thin row on phones, full bar from sm up -->
			<header
				class="fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-out will-change-transform {showControls
					? 'translate-y-0'
					: '-translate-y-full'}"
				onpointerenter={(e) => {
					if (e.pointerType === 'mouse') showControls = true;
				}}
			>
				<div
					class="flex items-center gap-0.5 sm:gap-1 h-12 sm:h-14 px-1.5 sm:px-4 bg-gradient-to-b from-black/90 via-black/60 to-transparent backdrop-blur-[2px]"
				>
					<button
						onclick={goBack}
						aria-label="Back to {mangaInfo?.title || 'manga'}"
						class="flex items-center justify-center h-9 w-9 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-lg bg-white/10 text-zinc-200 active:bg-white/20 sm:hover:bg-white/20 transition-colors shrink-0"
					>
						<ArrowLeft class="w-5 h-5 sm:w-4 sm:h-4" />
						<span class="hidden sm:inline text-sm ml-1.5">Back</span>
					</button>

					{#if prevChapter}
						<button
							onclick={() => goToChapter(prevChapter.id)}
							aria-label="Previous chapter"
							class="flex items-center justify-center h-9 w-9 rounded-lg bg-white/10 text-zinc-200 active:bg-white/20 sm:hover:bg-white/20 transition-colors shrink-0"
						>
							<ChevronLeft class="w-5 h-5" />
						</button>
					{/if}

					<!-- Chapter title doubles as the chapter picker -->
					<div class="relative flex-1 min-w-0">
						<button
							onclick={toggleChapterList}
							aria-label="Select chapter"
							class="flex items-center justify-center gap-1 w-full h-9 px-2 rounded-lg bg-white/10 text-zinc-100 active:bg-white/20 sm:hover:bg-white/20 transition-colors"
						>
							<span class="truncate text-[13px] sm:text-sm font-medium"
								>{currentChapter?.title || 'Chapters'}</span
							>
							<ChevronDown
								class="w-3.5 h-3.5 shrink-0 opacity-60 transition-transform {showChapterList
									? 'rotate-180'
									: ''}"
							/>
						</button>

						{#if showChapterList}
							<div
								class="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-[92vw] sm:w-80 max-h-[65vh] overflow-y-auto bg-zinc-900/95 backdrop-blur-md border border-zinc-700 rounded-xl shadow-xl z-50"
							>
								<div
									class="sticky top-0 z-10 flex items-center gap-1 px-2 py-1.5 bg-zinc-950/95 backdrop-blur border-b border-white/10"
								>
									{#if mangaInfo?.slug}
										<a
											href="/manga/{source}/{mangaInfo.slug}"
											class="flex items-center gap-1.5 flex-1 min-w-0 h-9 px-2 rounded-lg text-xs text-zinc-300 active:bg-white/10 sm:hover:bg-white/10 transition-colors"
										>
											<Library class="w-3.5 h-3.5 shrink-0" />
											<span class="truncate">{mangaInfo.title}</span>
										</a>
									{/if}
									<a
										href="/"
										aria-label="Home"
										class="flex items-center justify-center w-9 h-9 shrink-0 rounded-lg bg-white/10 active:bg-white/20 sm:hover:bg-white/20 transition-colors"
									>
										<Home class="w-4 h-4" />
									</a>
								</div>
								{#each chapters as chapter}
									{#if chapter.title}
										<button
											onclick={() => goToChapter(chapter.id)}
											class="w-full px-4 py-3 text-left text-sm transition-colors {chapter.id ===
											chapterId
												? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
												: 'text-zinc-300 hover:bg-white/5'}"
										>
											<div class="flex flex-col items-start truncate w-full">
												<span class="truncate font-medium">{chapter.title}</span>
												{#if chapter.date}
													<span class="truncate text-[10px] text-zinc-500"
														>{chapter.date}</span
													>
												{/if}
											</div>
										</button>
									{/if}
								{/each}
								{#if chapters.length === 0}
									<p class="px-4 py-3 text-sm text-zinc-500">No chapters available</p>
								{/if}

								<!-- Phones keep reader settings here so the bar stays one line -->
								<div
									class="sm:hidden sticky bottom-0 flex items-center justify-between gap-2 px-3 py-2 bg-zinc-950/95 backdrop-blur border-t border-white/10"
								>
									<button
										onclick={toggleMode}
										class="flex-1 h-9 bg-white/10 active:bg-white/20 rounded-lg text-xs font-medium"
									>
										{readerMode === 'vertical' ? 'Scroll mode' : 'Paged mode'}
									</button>
									<button
										onclick={toggleFullscreen}
										aria-label="Toggle fullscreen"
										class="flex items-center justify-center w-9 h-9 bg-white/10 active:bg-white/20 rounded-lg"
									>
										{#if isFullscreen}
											<Minimize2 class="w-4 h-4" />
										{:else}
											<Maximize2 class="w-4 h-4" />
										{/if}
									</button>
								</div>
							</div>
						{/if}
					</div>

					{#if nextChapter}
						<button
							onclick={() => goToChapter(nextChapter.id)}
							aria-label="Next chapter"
							class="flex items-center justify-center h-9 w-9 rounded-lg bg-white/10 text-zinc-200 active:bg-white/20 sm:hover:bg-white/20 transition-colors shrink-0"
						>
							<ChevronRight class="w-5 h-5" />
						</button>
					{/if}

					<!-- Desktop-only extras -->
					<div class="hidden sm:flex items-center gap-2 shrink-0">
						<span class="text-xs text-zinc-500 tabular-nums">{currentPage + 1}/{pages.length}</span>
						<button
							onclick={toggleMode}
							class="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors"
						>
							{readerMode === 'vertical' ? 'Scroll' : 'Paged'}
						</button>
						<button
							onclick={toggleFullscreen}
							class="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
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

			<!-- Vertical Scroll Mode with Spreading Priority Viewport Loading -->
			{#if readerMode === 'vertical'}
				<div class="reader-pages flex flex-col items-center pt-12 sm:pt-14 pb-8 w-full">
					{#each pages as pageUrl, i (chapterId + '-' + i)}
						<ReaderPage
							pageIndex={i}
							totalPages={pages.length}
							proxyUrl={proxyImage(pageUrl)}
							shouldLoad={allowedToLoad[i] ?? false}
							isNear={Math.abs(i - currentPage) <= 2}
							isCurrent={i === currentPage}
							onVisible={handlePageVisible}
							onLoaded={handlePageLoaded}
							onError={handlePageError}
							onRequestImmediate={requestImmediateLoad}
							ondblclick={toggleZoom}
						/>
					{/each}

					<!-- End of chapter navigation -->
					<div class="flex flex-col items-center gap-4 py-8 px-4 w-full">
						<p class="text-zinc-500 text-sm">End of chapter</p>
						<div class="flex items-center gap-3 text-sm">
							{#if mangaInfo?.slug}
								<a
									href="/manga/{source}/{mangaInfo.slug}"
									class="flex items-center gap-1.5 text-zinc-300 hover:text-white transition-colors"
								>
									<Library class="w-4 h-4" />
									Manga details
								</a>
							{/if}
							<a href="/" class="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">
								<Home class="w-4 h-4" />
								Home
							</a>
						</div>
						<div class="flex gap-3 w-full max-w-xs justify-center">
							{#if prevChapter}
								<button
									onclick={() => goToChapter(prevChapter.id)}
									class="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors flex-1 justify-center"
								>
									<ChevronLeft class="w-4 h-4" />
									<div class="text-left hidden sm:block">
										<div class="truncate font-medium">{prevChapter.title}</div>
										{#if prevChapter.date}
											<div class="truncate text-[10px] text-zinc-500">{prevChapter.date}</div>
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
										<div class="truncate font-medium">{nextChapter.title}</div>
										{#if nextChapter.date}
											<div class="truncate text-[10px] text-zinc-500">{nextChapter.date}</div>
										{/if}
									</div>
									<ChevronRight class="w-4 h-4" />
								</button>
							{/if}
						</div>
					</div>
				</div>
			{:else}
				<!-- Horizontal Mode with Cat Paw Loading Fallback -->
				<div
					class="flex items-center justify-center min-h-screen pt-12 sm:pt-14 cursor-pointer relative"
					role="button"
					tabindex="0"
					onclick={nextPage}
					onkeypress={() => {}}
				>
					<!-- Prev Button -->
					<button
						class="fixed left-0 top-1/2 -translate-y-1/2 w-16 h-24 flex items-center justify-center bg-black/50 hover:bg-[var(--color-primary)]/50 transition-colors disabled:opacity-20 z-30"
						onclick={(e) => {
							e.stopPropagation();
							prevPage();
						}}
						disabled={currentPage === 0}
					>
						<ChevronLeft class="w-8 h-8" />
					</button>

					<div class="relative flex items-center justify-center max-h-[95vh] max-w-[95vw] min-h-[350px] min-w-[250px]">
						{#if !horizontalLoaded}
							<div class="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
								<CatPawLoader size="lg" text="Halaman {currentPage + 1} / {pages.length}" />
							</div>
						{/if}

						{#key `${chapterId}-${currentPage}`}
							<img
								src={proxyImage(pages[currentPage])}
								alt="Page {currentPage + 1}"
								fetchpriority="high"
								decoding="async"
								class="reader-image-horizontal max-h-[95vh] object-contain transition-opacity duration-300 {horizontalLoaded ? 'opacity-100' : 'opacity-0'}"
								style={isZoomed ? `transform: scale(${zoomLevel}); cursor: grab;` : ''}
								onload={() => {
									horizontalLoaded = true;
									handlePageLoaded(currentPage);
								}}
								onerror={() => handlePageError(currentPage)}
								ondblclick={toggleZoom}
								ontouchend={handleTouchEnd}
							/>
						{/key}
					</div>

					<!-- Hidden spreading preloader for horizontal mode -->
					<div class="hidden" aria-hidden="true">
						{#each pages as pageUrl, i}
							{#if allowedToLoad[i] && i !== currentPage && !loadedStates[i]}
								<img
									src={proxyImage(pageUrl)}
									alt=""
									loading="lazy"
									decoding="async"
									onload={() => handlePageLoaded(i)}
									onerror={() => handlePageError(i)}
								/>
							{/if}
						{/each}
					</div>

					<!-- Next Button -->
					<button
						class="fixed right-0 top-1/2 -translate-y-1/2 w-16 h-24 flex items-center justify-center bg-black/50 hover:bg-[var(--color-primary)]/50 transition-colors disabled:opacity-20 z-30"
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

			<!-- Scroll Resume Notification Toast -->
			{#if resumedPageNotification !== null}
				<div
					class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 bg-zinc-900/95 backdrop-blur-md border border-[var(--color-primary)]/40 rounded-full shadow-2xl text-xs sm:text-sm animate-fade-in"
				>
					<span class="text-zinc-200">Melanjutkan di <strong>Hal. {resumedPageNotification}</strong></span>
					<button
						onclick={scrollToTop}
						class="px-2.5 py-1 bg-[var(--color-primary)] hover:opacity-90 rounded-full text-white font-medium text-xs transition-colors shadow-md"
					>
						Ke Awal
					</button>
					<button
						onclick={() => (resumedPageNotification = null)}
						class="text-zinc-400 hover:text-white text-xs px-1"
						aria-label="Tutup notifikasi"
					>
						✕
					</button>
				</div>
			{/if}
		</div>
	{/key}
{/if}

<style>
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
		height: 2.5px;
		background: linear-gradient(to right, var(--color-primary), var(--color-accent));
		z-index: 100;
		transform-origin: left;
		transition: transform 0.15s ease-out;
	}

	/* Zoom cursor */
	.reader-image-horizontal[style*="scale(2)"] {
		cursor: grab;
	}

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

	.animate-fade-in {
		animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
	}
</style>
