<!--
  History Page - Reading History
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { History, Trash2, BookOpen, Clock } from 'lucide-svelte';
	import { getHistory, clearHistory, removeFromHistory, type ReadingEntry } from '$lib/stores/history';

	let history = $state<ReadingEntry[]>([]);

	onMount(() => {
		history = getHistory();
	});

	function handleClear() {
		if (confirm('Clear all reading history?')) {
			clearHistory();
			history = [];
		}
	}

	function handleRemove(mangaId: string) {
		removeFromHistory(mangaId);
		history = getHistory();
	}

	function formatTime(timestamp: number): string {
		const diff = Date.now() - timestamp;
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (days > 0) return `${days}d ago`;
		if (hours > 0) return `${hours}h ago`;
		if (minutes > 0) return `${minutes}m ago`;
		return 'Just now';
	}
</script>

<svelte:head>
	<title>History | FanaCumik</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-4 py-6">
	<div class="flex items-center justify-between mb-6">
		<div>
			<h1
				class="text-2xl sm:text-3xl font-bold text-[var(--color-primary)]"
			>
				Reading History
			</h1>
			<p class="text-sm text-zinc-500 mt-1">{history.length} entries</p>
		</div>

		{#if history.length > 0}
			<button
				onclick={handleClear}
				class="flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
			>
				<Trash2 class="w-4 h-4" />
				Clear All
			</button>
		{/if}
	</div>

	{#if history.length === 0}
		<div class="text-center py-20">
			<History class="w-12 h-12 text-zinc-700 mx-auto mb-4" />
			<p class="text-zinc-500">No reading history yet.</p>
			<p class="text-sm text-zinc-600 mt-1">Start reading to track your progress.</p>
		</div>
	{:else}
		<div class="space-y-2">
			{#each history as entry}
				<div
					class="flex items-center gap-4 p-3 bg-zinc-900/50 border border-zinc-800/50 rounded-xl group"
				>
					<!-- Cover -->
					<a href="/manga/{entry.sourceId}{entry.mangaId}" class="shrink-0">
						<div class="w-14 h-20 bg-zinc-800 rounded-lg overflow-hidden">
							{#if entry.cover}
								<img
									src="/api/proxy?url={encodeURIComponent(entry.cover)}&source={entry.sourceId}"
									alt=""
									class="w-full h-full object-cover"
								/>
							{:else}
								<div class="w-full h-full flex items-center justify-center">
									<BookOpen class="w-5 h-5 text-zinc-700" />
								</div>
							{/if}
						</div>
					</a>

					<!-- Info -->
					<div class="flex-1 min-w-0">
						<a
							href="/manga/{entry.sourceId}{entry.mangaId}"
							class="font-medium text-zinc-300 hover:text-white transition-colors line-clamp-1"
						>
							{entry.mangaTitle}
						</a>
						<a
							href="/read/{entry.sourceId}{entry.chapterId}"
							class="text-sm text-[var(--color-primary)] hover:opacity-80 transition-colors line-clamp-1"
						>
							{entry.chapterTitle}
						</a>
						<div class="flex items-center gap-1 text-xs text-zinc-600 mt-1">
							<Clock class="w-3 h-3" />
							{formatTime(entry.timestamp)}
						</div>
					</div>

					<!-- Actions -->
					<div class="flex items-center gap-2">
						<a
							href="/read/{entry.sourceId}{entry.chapterId}"
							class="px-3 py-1.5 bg-[var(--color-primary)] hover:opacity-90 rounded-lg text-sm font-medium transition-colors"
						>
							Continue
						</a>
						<button
							onclick={() => handleRemove(entry.mangaId)}
							class="p-1.5 text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
						>
							<Trash2 class="w-4 h-4" />
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
