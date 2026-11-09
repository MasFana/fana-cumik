<script lang="ts">
	import type { PageData } from './$types';
	import { BookOpen, User, Clock, Tag, ChevronRight, ArrowRight } from 'lucide-svelte';
	import { getLastRead } from '$lib/stores/history';
	import MangaCover from '$lib/components/MangaCover.svelte';

	const { data }: { data: PageData } = $props();
	let { manga, source } = $derived(data);

	// Check if user has reading history for this manga
	let lastRead = $derived(getLastRead(manga.id));

	function proxyImage(url: string): string {
		if (!url) return '';
		return `/api/proxy?url=${encodeURIComponent(url)}&source=${source}`;
	}
</script>

<svelte:head>
	<title>{manga.title} | FanaCumik</title>
	<meta name="description" content={manga.description?.slice(0, 160)} />
</svelte:head>

<div class="max-w-5xl mx-auto px-4 py-5 sm:py-6">
	<!-- Header: cover beside the facts on phones, wider block on desktop -->
	<div class="flex gap-4 sm:gap-6 mb-5 sm:mb-8">
		<div class="shrink-0">
			<MangaCover
				src={proxyImage(manga.cover)}
				alt="{manga.title} Cover"
				containerClass="w-28 sm:w-40 md:w-48 rounded-xl shadow-lg"
			/>
		</div>

		<div class="flex-1 min-w-0">
			<h1 class="text-lg sm:text-2xl md:text-3xl font-bold text-white mb-2 leading-tight">
				{manga.title}
			</h1>

			<!-- Meta -->
			<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-zinc-400 mb-3">
				{#if manga.authors?.length}
					<span class="flex items-center gap-1 min-w-0">
						<User class="w-3.5 h-3.5 shrink-0" />
						<span class="truncate">{manga.authors.join(', ')}</span>
					</span>
				{/if}
				<span
					class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-medium {manga.status ===
					'Ongoing'
						? 'bg-emerald-500/20 text-emerald-400'
						: 'bg-zinc-700/50 text-zinc-400'}"
				>
					<Clock class="w-3 h-3" />
					{manga.status}
				</span>
			</div>

			<!-- Genres -->
			{#if manga.genres?.length}
				<div class="flex flex-wrap gap-1.5 mb-3">
					{#each manga.genres as genre}
						<span
							class="flex items-center gap-1 px-2 py-0.5 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 rounded-full text-[11px] sm:text-xs text-[var(--color-primary)]"
						>
							<Tag class="w-3 h-3" />
							{genre}
						</span>
					{/each}
				</div>
			{/if}

			<!-- Reading action -->
			{#if lastRead}
				<a
					href="/read/{source}{lastRead.chapterId}"
					class="flex sm:inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-[var(--color-primary)] hover:opacity-90 rounded-xl font-medium text-sm sm:text-base transition-colors active:scale-[0.98]"
				>
					<BookOpen class="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
					<span class="truncate">Continue: {lastRead.chapterTitle}</span>
				</a>
			{:else if manga.chapters?.length}
				<a
					href="/read/{source}{manga.chapters[manga.chapters.length - 1].id}"
					class="flex sm:inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium text-sm sm:text-base border border-zinc-700 transition-colors active:scale-[0.98]"
				>
					<BookOpen class="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
					Start from Chapter 1
					<ArrowRight class="w-4 h-4 shrink-0" />
				</a>
			{/if}
		</div>
	</div>

	<!-- Synopsis -->
	{#if manga.description}
		<p class="text-sm sm:text-base text-zinc-300 leading-relaxed mb-6 sm:mb-8 max-w-3xl">
			{manga.description}
		</p>
	{/if}

	<!-- Chapters -->
	<div>
		<h2 class="text-base sm:text-lg font-semibold text-white mb-3 flex items-center gap-2">
			<BookOpen class="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-primary)]" />
			Chapters
			<span class="text-sm text-zinc-500 font-normal">({manga.chapters?.length || 0})</span>
		</h2>

		{#if manga.chapters?.length}
			<div class="space-y-1">
				{#each manga.chapters as chapter}
					<a
						href="/read/{source}{chapter.id}"
						class="flex items-center gap-2 min-h-11 px-3 sm:px-4 py-2.5 bg-zinc-900/50 hover:bg-zinc-800/50 border border-zinc-800/50 rounded-xl transition-colors group active:bg-zinc-800"
					>
						<span class="flex-1 min-w-0 truncate text-sm text-zinc-300 group-hover:text-white transition-colors">
							{chapter.title}
						</span>
						{#if chapter.date}
							<span class="shrink-0 text-[11px] sm:text-xs text-zinc-500 tabular-nums"
								>{chapter.date}</span
							>
						{/if}
						<ChevronRight
							class="w-4 h-4 shrink-0 text-zinc-600 group-hover:text-[var(--color-primary)] transition-colors"
						/>
					</a>
				{/each}
			</div>
		{:else}
			<p class="text-center text-zinc-500 py-10">No chapters available.</p>
		{/if}
	</div>
</div>

<style>
	/* Tap feedback only — sizes come from Tailwind, so nothing here can break the layout. */
	a {
		-webkit-tap-highlight-color: transparent;
	}

	.space-y-1 > a:active {
		transform: scale(0.99);
	}
</style>