<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { Search, ChevronLeft, ChevronRight, Loader2, Github, Star } from 'lucide-svelte';
	const { data }: { data: PageData } = $props();
	let { mangas, sources, currentSource, currentPage, searchQuery } = $derived(data);

	let searchInput = $derived(searchQuery || '');

	let loading = $state(false);

	function proxyImage(url: string): string {
		if (!url) return '';
		return `/api/proxy?url=${encodeURIComponent(url)}&source=${currentSource}`;
	}

	function handleSearch(e: SubmitEvent) {
		e.preventDefault();
		loading = true;
		const params = new URLSearchParams();
		params.set('source', currentSource);
		if (searchInput) params.set('q', searchInput);
		goto(`/?${params.toString()}`).finally(() => (loading = false));
	}

	function handleSourceChange(e: Event) {
		const select = e.target as HTMLSelectElement;
		loading = true;
		goto(`/?source=${select.value}`).finally(() => (loading = false));
	}

	function goToPage(page: number) {
		const params = new URLSearchParams();
		params.set('source', currentSource);
		params.set('page', String(page));
		goto(`/?${params.toString()}`);
	}
</script>

<svelte:head>
	<title>FanaCumik - Browse Manga</title>
	<meta name="description" content="Browse and read manga from multiple sources" />
</svelte:head>

<div class="max-w-7xl mx-auto px-4 py-6">
	
	<!-- Header -->
	<div class="mb-6">
		<h1
			class="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] bg-clip-text text-transparent"
		>
			Browse
		</h1>

		<!-- Filters -->
		<div class="flex flex-wrap gap-3 mt-4">
			<select
				value={currentSource}
				onchange={handleSourceChange}
				class="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
			>
				{#each sources as source}
					<option value={source.id}>{source.name}</option>
				{/each}
			</select>

			<form class="flex gap-2 flex-1 max-w-md" onsubmit={handleSearch}>
				<div class="relative flex-1">
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
					<input
						type="text"
						placeholder="Search manga..."
						bind:value={searchInput}
						class="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
					/>
				</div>
				<button
					type="submit"
					disabled={loading}
					class="px-4 py-2 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
				>
					{#if loading}
						<Loader2 class="w-4 h-4 animate-spin" />
					{:else}
						Search
					{/if}
				</button>
			</form>
		</div>
	</div>

	<!-- Search Results Info -->
	{#if searchQuery}
		<p class="text-sm text-zinc-500 mb-4">
			Results for "<span class="text-zinc-300">{searchQuery}</span>"
			<a href="/?source={currentSource}" class="text-[var(--color-primary)] hover:underline ml-2">Clear</a>
		</p>
	{/if}

	<!-- Loading -->
	{#if loading}
		<div class="flex justify-center py-20">
			<Loader2 class="w-8 h-8 animate-spin text-[var(--color-primary)]" />
		</div>
	{:else if mangas.length === 0}
		<div class="text-center py-20 text-zinc-500">
			<p>No manga found.</p>
		</div>
	{:else}
		<!-- Manga Grid -->
		<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
			{#each mangas as manga}
				<a
					href="/manga/{manga.sourceId}{manga.id}"
					class="group block"
				>
					<div
						class="aspect-[2/3] rounded-lg overflow-hidden bg-zinc-900 relative"
					>
						{#if manga.cover}
							<img
								src={proxyImage(manga.cover)}
								alt={manga.title}
								loading="lazy"
								class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
							/>
						{:else}
							<div class="w-full h-full flex items-center justify-center text-3xl text-zinc-700">
								📚
							</div>
						{/if}
						<!-- Hover overlay -->
						<div
							class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity"
						></div>
					</div>
					<h3
						class="mt-2 text-sm font-medium line-clamp-2 text-zinc-300 group-hover:text-white transition-colors"
					>
						{manga.title}
					</h3>
				</a>
			{/each}
		</div>

		<!-- Pagination -->
		{#if !searchQuery}
			<div class="flex items-center justify-center gap-4 mt-8 pt-6 border-t border-zinc-800/50">
				<button
					onclick={() => goToPage(currentPage - 1)}
					disabled={currentPage <= 1}
					class="flex items-center gap-1 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors"
				>
					<ChevronLeft class="w-4 h-4" />
					Previous
				</button>

				<span class="text-sm text-zinc-500">
					Page <span class="text-white font-medium">{currentPage}</span>
				</span>

				<button
					onclick={() => goToPage(currentPage + 1)}
					class="flex items-center gap-1 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm hover:bg-zinc-800 transition-colors"
				>
					Next
					<ChevronRight class="w-4 h-4" />
				</button>
			</div>
		{/if}
	{/if}
</div>

<!-- Floating Star Repo FAB -->
<a
	href="https://github.com/MasFana/fana-cumik"
	target="_blank"
	rel="noreferrer"
	class="group fixed bottom-6 right-6 z-50 flex items-center gap-0 sm:gap-2 p-1.5 sm:pr-4 rounded-full bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 hover:border-[var(--color-primary)]/50 shadow-lg hover:shadow-[0_0_30px_-5px_var(--color-primary)] transition-all duration-500 hover:-translate-y-1 overflow-hidden"
>
	<!-- Continuous Shine Effect -->
	<div class="absolute top-0 bottom-0 left-0 w-24 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-25deg] z-10 pointer-events-none shine-effect"></div>

	<!-- Icon Circle with Morphing Effect -->
	<div class="relative flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-950 border border-zinc-700 group-hover:border-[var(--color-primary)] transition-colors duration-500 overflow-hidden shrink-0 z-20">
		<!-- Glow behind icon -->
		<div class="absolute inset-0 bg-[var(--color-primary)] opacity-0 group-hover:opacity-20 transition-opacity duration-500"></div>
		
		<Github class="w-4 h-4 text-zinc-400 group-hover:scale-0 group-hover:opacity-0 transition-all duration-300 absolute" />
		<Star class="w-4 h-4 text-[var(--color-accent)] scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 rotate-[-180deg] group-hover:rotate-0 transition-all duration-500 absolute fill-[var(--color-accent)]" />
	</div>

	<!-- Text Section -->
	<div class="relative overflow-hidden h-5 w-0 sm:w-20 transition-all duration-500 opacity-0 sm:opacity-100 z-20">
		<span class="absolute top-0 left-0 text-sm font-bold bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] bg-clip-text text-transparent group-hover:-translate-y-full transition-transform duration-300 flex items-center h-full whitespace-nowrap">Star Repo</span>
		<span class="absolute top-0 left-0 text-sm font-bold text-zinc-200 translate-y-full group-hover:translate-y-0 transition-transform duration-300 flex items-center h-full whitespace-nowrap">FanaCumik</span>
	</div>
</a>

<style>
	.shine-effect {
		animation: shine 3s linear infinite;
	}
	@keyframes shine {
		0% {
			transform: translateX(-150%) skewX(-25deg);
		}
		100% {
			transform: translateX(500%) skewX(-25deg);
		}
	}
</style>