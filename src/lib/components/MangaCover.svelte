<script lang="ts">
	import CatPawLoader from './CatPawLoader.svelte';
	import { BookOpen } from 'lucide-svelte';

	let {
		src = '',
		alt = '',
		aspectRatio = 'aspect-[2/3]',
		class: className = '',
		containerClass = '',
		imgClass = ''
	}: {
		src?: string;
		alt?: string;
		aspectRatio?: string;
		class?: string;
		containerClass?: string;
		imgClass?: string;
	} = $props();

	let loaded = $state(false);
	let error = $state(false);
	let currentSrc = $state('');

	// When src changes, immediately reset loaded and error states so old image disappears
	$effect(() => {
		if (src !== currentSrc) {
			currentSrc = src;
			loaded = false;
			error = false;
		}
	});

	function handleLoad() {
		loaded = true;
	}

	function handleError() {
		error = true;
		loaded = true;
	}
</script>

<div class="{aspectRatio} rounded-lg overflow-hidden bg-zinc-900/90 relative flex items-center justify-center border border-zinc-800/40 {className} {containerClass}">
	{#if !src || error}
		<div class="flex flex-col items-center justify-center text-zinc-600 gap-1 p-2 text-center">
			<BookOpen class="w-8 h-8 opacity-40" />
			<span class="text-[10px] text-zinc-500">No Cover</span>
		</div>
	{:else}
		<!-- Cat Paw Loader while image is loading -->
		{#if !loaded}
			<div class="absolute inset-0 flex items-center justify-center bg-zinc-900/95 z-10">
				<CatPawLoader size="sm" />
			</div>
		{/if}

		<!-- The Cover Image -->
		<img
			src={currentSrc}
			{alt}
			loading="lazy"
			onload={handleLoad}
			onerror={handleError}
			class="w-full h-full object-cover transition-all duration-300 {loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'} {imgClass}"
		/>
	{/if}

	<!-- Hover shadow overlay -->
	<div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20"></div>
</div>
