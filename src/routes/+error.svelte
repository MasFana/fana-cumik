<script lang="ts">
	import type { PageProps } from '@sveltejs/kit';
	import { ArrowLeft, Home, RefreshCw, Library } from 'lucide-svelte';

	let { status, message } = $props() as PageProps['error'] & { status: number; message: string };
	
	// Provide defaults if not set
	status = status || 500;
	message = message || 'Internal Server Error';
</script>

<svelte:head>
	<title>Error {status} | FanaCumik</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
	<div class="text-center max-w-md animate-fade-in">
		{#if status === 404}
			<svg class="w-24 h-24 text-zinc-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<h1 class="text-3xl font-bold text-white mb-2">Chapter Not Found</h1>
			<p class="text-zinc-400 mb-6">{message || 'The chapter you\'re looking for doesn\'t exist or has been removed.'}</p>
			<div class="flex flex-col sm:flex-row gap-3 justify-center items-center mb-6">
				<a href="/" class="flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] hover:opacity-90 rounded-xl font-medium transition-colors text-base shadow-lg shadow-[var(--color-primary)]/20 active:scale-[0.98]">
					<Home class="w-5 h-5" />
					Go Home
				</a>
				<a href="/sources" class="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium transition-colors text-base border border-zinc-700 active:scale-[0.98]">
					<Library class="w-5 h-5" />
					Browse Sources
				</a>
			</div>
		{:else if status === 500}
			<svg class="w-24 h-24 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
			</svg>
			<h1 class="text-3xl font-bold text-white mb-2">Server Error</h1>
			<p class="text-zinc-400 mb-6">Something went wrong on our end. The source may be temporarily unavailable.</p>
			<div class="flex flex-col sm:flex-row gap-3 justify-center items-center mb-6">
				<button on:click={() => window.history.back()} class="flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] hover:opacity-90 rounded-xl font-medium transition-colors text-base shadow-lg shadow-[var(--color-primary)]/20 active:scale-[0.98]">
					<ArrowLeft class="w-5 h-5" />
					Go Back
				</button>
				<button on:click={() => window.location.reload()} class="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium transition-colors text-base border border-zinc-700 active:scale-[0.98]">
					<RefreshCw class="w-5 h-5" />
					Retry
				</button>
			</div>
			<div class="flex flex-col sm:flex-row gap-3 justify-center items-center">
				<a href="/" class="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm transition-colors">
					<Home class="w-4 h-4" />
					Home
				</a>
				<a href="/sources" class="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm transition-colors">
					<Library class="w-4 h-4" />
					Try Another Source
				</a>
			</div>
		{:else}
			<svg class="w-24 h-24 text-amber-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
			</svg>
			<h1 class="text-3xl font-bold text-white mb-2">Error {status}</h1>
			<p class="text-zinc-400 mb-6">{message}</p>
			<div class="flex flex-col sm:flex-row gap-3 justify-center items-center">
				<button on:click={() => window.history.back()} class="flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] hover:opacity-90 rounded-xl font-medium transition-colors text-base shadow-lg shadow-[var(--color-primary)]/20 active:scale-[0.98]">
					<ArrowLeft class="w-5 h-5" />
					Go Back
				</button>
				<a href="/" class="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium transition-colors text-base border border-zinc-700 active:scale-[0.98]">
					<Home class="w-5 h-5" />
					Home
				</a>
				<button on:click={() => window.location.reload()} class="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm transition-colors">
					<RefreshCw class="w-4 h-4" />
					Retry
				</button>
			</div>
		{/if}

		<p class="mt-6 text-sm text-zinc-500">
			If this persists, try clearing your cache or <a href="/" class="text-[var(--color-primary)] hover:underline">return home</a>
		</p>
	</div>
</div>

<style>
	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(20px); }
		to { opacity: 1; transform: translateY(0); }
	}
	
	.animate-fade-in {
		animation: fadeIn 0.4s ease-out;
	}
	
	/* Tap highlight removal */
	* {
		-webkit-tap-highlight-color: transparent;
	}
	
	/* Better focus states */
	button:focus-visible, a:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
</style>