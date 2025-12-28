<script lang="ts">
	import type { PageData } from './$types';
	import { Library, ExternalLink } from 'lucide-svelte';

	const { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Sources | FanaCumik</title>
	<meta name="description" content="Available manga sources" />
</svelte:head>

<div class="max-w-2xl mx-auto px-4 py-6">
	<h1
		class="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] bg-clip-text text-transparent mb-2"
	>
		Sources
	</h1>
	<p class="text-sm text-zinc-500 mb-6">Available manga sources</p>

	<div class="space-y-3">
		{#each data.sources as source}
			<a
				href="/?source={source.id}"
				class="flex items-center gap-4 p-4 bg-zinc-900/50 border border-zinc-800/50 hover:border-[var(--color-primary)]/30 rounded-xl transition-all group"
			>
				<div
					class="w-12 h-12 flex items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)]"
				>
					<Library class="w-5 h-5 text-white" />
				</div>

				<div class="flex-1 min-w-0">
					<h2 class="font-semibold text-white group-hover:text-[var(--color-primary)] transition-colors">
						{source.name}
					</h2>
					<p class="text-xs text-zinc-500 truncate">{source.baseUrl}</p>
				</div>

				<ExternalLink class="w-4 h-4 text-zinc-600 group-hover:text-[var(--color-primary)] transition-colors" />
			</a>
		{/each}
	</div>

	{#if data.sources.length === 0}
		<div class="text-center py-20 text-zinc-500">No sources available.</div>
	{/if}
</div>
