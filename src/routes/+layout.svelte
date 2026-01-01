<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.ico';
	import { BookOpen, Home, Library, History, Loader2 } from 'lucide-svelte';
	import { getHistory } from '$lib/stores/history';
	import { page, navigating } from '$app/stores';

	let { children } = $props();

	// Check if we're on reader page for minimal header
	let isReaderPage = $derived($page.url.pathname.startsWith('/read/'));
	
	// Loading state for navigation
	let isLoading = $derived($navigating !== null);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-zinc-100 font-[Inter,system-ui,sans-serif]">
	<!-- Global Loading Overlay -->
	{#if isLoading}
		<div 
			class="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-[100] flex items-center justify-center"
			style="animation: fadeIn 0.2s ease-out;"
		>
			<div class="flex flex-col items-center gap-4">
				<div class="relative">
					<!-- Outer ring -->
					<div class="w-12 h-12 border-4 border-zinc-800 rounded-full"></div>
					<!-- Spinning ring -->
					<div class="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-[var(--color-primary)] rounded-full animate-spin"></div>
					<!-- Inner glow -->
					<div class="absolute inset-2 bg-[var(--color-primary)]/20 rounded-full blur-sm"></div>
				</div>
				<p class="text-sm text-zinc-400 font-medium">Loading...</p>
			</div>
		</div>
	{/if}

	<!-- Navbar - Hidden on reader pages -->
	{#if !isReaderPage}
		<nav
			class="sticky top-0 z-50 backdrop-blur-xl bg-zinc-950/80 border-b border-zinc-800/50"
		>
			<div class="max-w-7xl mx-auto px-4 sm:px-6">
				<div class="flex items-center justify-between h-14">
					<!-- Logo -->
					<a
						href="/"
						class="flex items-center gap-2 text-lg font-bold group"
					>
						<div
							class="p-1.5 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] group-hover:shadow-lg group-hover:shadow-[var(--color-primary)]/25 transition-all"
						>
							<BookOpen class="w-4 h-4 text-white" />
						</div>
						<span
							class="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] bg-clip-text text-transparent"
							>FanaCumik</span
						>
					</a>

					<!-- Nav Links -->
					<div class="flex items-center gap-1">
						<a
							href="/"
							class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-all"
						>
							<Home class="w-4 h-4" />
							<span class="hidden sm:inline">Browse</span>
						</a>
						<a
							href="/sources"
							class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-all"
						>
							<Library class="w-4 h-4" />
							<span class="hidden sm:inline">Sources</span>
						</a>
						<a
							href="/history"
							class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-all"
						>
							<History class="w-4 h-4" />
							<span class="hidden sm:inline">History</span>
						</a>
					</div>
				</div>
			</div>
		</nav>
	{/if}

	<!-- Main Content -->
	<main>
		{@render children()}
	</main>

	<!-- Footer - Hidden on reader -->
	{#if !isReaderPage}
		<footer class="mt-auto py-6 border-t border-zinc-800/50 text-center text-zinc-500 text-xs">
			FanaCumik - Manga Reader
		</footer>
	{/if}
</div>

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>
