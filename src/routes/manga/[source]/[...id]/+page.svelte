<!--
  Manga Detail Page - Tailwind CSS
-->
<script lang="ts">
	import type { PageData } from './$types';
	import { BookOpen, User, Clock, Tag, ChevronRight } from 'lucide-svelte';
	import { getLastRead } from '$lib/stores/history';

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

<div class="max-w-5xl mx-auto px-4 py-6">
	<!-- Header Section -->
	<div class="flex flex-col md:flex-row gap-6 mb-8">
		<!-- Cover -->
		<div class="shrink-0 mx-auto md:mx-0">
			<div class="w-48 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl shadow-[var(--color-primary)]/10">
				{#if manga.cover}
					<img
						src={proxyImage(manga.cover)}
						alt="{manga.title} Cover"
						class="w-full h-full object-cover"
					/>
				{:else}
					<div class="w-full h-full bg-zinc-900 flex items-center justify-center">
						<BookOpen class="w-12 h-12 text-zinc-700" />
					</div>
				{/if}
			</div>
		</div>

		<!-- Info -->
		<div class="flex-1 text-center md:text-left">
			<h1 class="text-2xl sm:text-3xl font-bold text-white mb-3">{manga.title}</h1>

			<!-- Meta -->
			<div class="flex flex-wrap justify-center md:justify-start gap-3 text-sm text-zinc-400 mb-4">
				{#if manga.authors?.length}
					<span class="flex items-center gap-1">
						<User class="w-4 h-4" />
						{manga.authors.join(', ')}
					</span>
				{/if}
				<span
					class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium {manga.status === 'Ongoing'
						? 'bg-emerald-500/20 text-emerald-400'
						: 'bg-zinc-700/50 text-zinc-400'}"
				>
					<Clock class="w-3 h-3" />
					{manga.status}
				</span>
			</div>

			<!-- Genres -->
			{#if manga.genres?.length}
				<div class="flex flex-wrap justify-center md:justify-start gap-2 mb-4">
					{#each manga.genres as genre}
						<span
							class="flex items-center gap-1 px-2 py-1 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 rounded-full text-xs text-[var(--color-primary)]"
						>
							<Tag class="w-3 h-3" />
							{genre}
						</span>
					{/each}
				</div>
			{/if}

			<!-- Continue Reading Button -->
			{#if lastRead}
				<a
					href="/read/{source}{lastRead.chapterId}"
					class="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:opacity-90 rounded-lg font-medium transition-colors mb-4"
				>
					<BookOpen class="w-4 h-4" />
					Continue: {lastRead.chapterTitle}
				</a>
			{/if}

			<!-- Synopsis -->
			{#if manga.description}
				<p class="text-sm text-zinc-400 leading-relaxed max-w-2xl">{manga.description}</p>
			{/if}
		</div>
	</div>

	<!-- Chapters Section -->
	<div>
		<h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
			<BookOpen class="w-5 h-5 text-[var(--color-primary)]" />
			Chapters
			<span class="text-sm text-zinc-500 font-normal">({manga.chapters?.length || 0})</span>
		</h2>

		{#if manga.chapters?.length}
			<div class="space-y-1">
				{#each manga.chapters as chapter}
					<a
						href="/read/{source}{chapter.id}"
						class="flex items-center justify-between px-4 py-3 bg-zinc-900/50 hover:bg-zinc-800/50 border border-zinc-800/50 rounded-lg transition-colors group"
					>
						<span class="text-sm text-zinc-300 group-hover:text-white transition-colors">
							{chapter.title}
						</span>
						<div class="flex items-center gap-3">
							{#if chapter.date}
								<span class="text-xs text-zinc-600">{chapter.date}</span>
							{/if}
							<ChevronRight
								class="w-4 h-4 text-zinc-600 group-hover:text-[var(--color-primary)] transition-colors"
							/>
						</div>
					</a>
				{/each}
			</div>
		{:else}
			<p class="text-center text-zinc-500 py-10">No chapters available.</p>
		{/if}
	</div>
</div>
