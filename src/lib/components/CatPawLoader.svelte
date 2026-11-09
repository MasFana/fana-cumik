<script lang="ts">
	let {
		size = 'md',
		text = '',
		class: className = '',
		variant = 'single'
	}: {
		size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
		text?: string;
		class?: string;
		variant?: 'single' | 'walking';
	} = $props();

	// Size mapping for SVG
	const sizeMap = {
		xs: 'w-7 h-7',
		sm: 'w-10 h-10',
		md: 'w-16 h-16',
		lg: 'w-24 h-24',
		xl: 'w-32 h-32'
	};

	const textSizeMap = {
		xs: 'text-[10px]',
		sm: 'text-xs',
		md: 'text-xs sm:text-sm',
		lg: 'text-sm font-medium',
		xl: 'text-base font-medium'
	};
</script>

<div class="inline-flex flex-col items-center justify-center gap-2 select-none {className}" role="status" aria-label="Loading">
	{#if variant === 'walking'}
		<!-- Walking/Alternating Paws with Line Draw Effect -->
		<div class="flex items-center gap-2 sm:gap-4">
			<!-- Left Paw Outline -->
			<div class="{sizeMap[size]} paw-step-left">
				<svg viewBox="0 0 100 100" class="w-full h-full filter drop-shadow-[0_2px_10px_rgba(249,115,22,0.4)]">
					<defs>
						<linearGradient id="pawStrokeGradL" x1="0%" y1="0%" x2="100%" y2="100%">
							<stop offset="0%" stop-color="#f97316" />
							<stop offset="100%" stop-color="#fb923c" />
						</linearGradient>
					</defs>
					<g class="paw-draw-group draw-paw-l">
						<!-- Paw Outer Outline -->
						<path
							d="M 28 88 C 14 88 12 70 14 56 C 16 42 28 24 50 24 C 72 24 84 42 86 56 C 88 70 86 88 72 88"
							class="paw-outline paw-line-body"
							stroke="url(#pawStrokeGradL)"
						/>
						<!-- Toe 1 (Leftmost) -->
						<path
							d="M 18 48 C 14 43 17 35 24 38 C 30 41 29 51 22 53 C 19 53 18 51 18 48 Z"
							class="paw-outline paw-line-toe toe-1"
							stroke="url(#pawStrokeGradL)"
						/>
						<!-- Toe 2 (Center Left) -->
						<path
							d="M 33 34 C 31 26 38 20 44 23 C 50 26 49 37 42 39 C 37 40 33 38 33 34 Z"
							class="paw-outline paw-line-toe toe-2"
							stroke="url(#pawStrokeGradL)"
						/>
						<!-- Toe 3 (Center Right) -->
						<path
							d="M 56 34 C 55 26 62 20 68 23 C 74 26 73 37 66 39 C 61 40 56 38 56 34 Z"
							class="paw-outline paw-line-toe toe-3"
							stroke="url(#pawStrokeGradL)"
						/>
						<!-- Toe 4 (Rightmost) -->
						<path
							d="M 82 48 C 86 43 83 35 76 38 C 70 41 71 51 78 53 C 81 53 82 51 82 48 Z"
							class="paw-outline paw-line-toe toe-4"
							stroke="url(#pawStrokeGradL)"
						/>
						<!-- Main Heart/Cat Palm Bean -->
						<path
							d="M 33 58 C 24 58 23 68 28 75 C 33 82 41 84 50 84 C 59 84 67 82 72 75 C 77 68 76 58 67 58 C 60 58 55 63 50 64 C 45 63 40 58 33 58 Z"
							class="paw-outline paw-line-palm"
							stroke="url(#pawStrokeGradL)"
						/>
					</g>
				</svg>
			</div>

			<!-- Right Paw Outline -->
			<div class="{sizeMap[size]} paw-step-right">
				<svg viewBox="0 0 100 100" class="w-full h-full filter drop-shadow-[0_2px_10px_rgba(249,115,22,0.4)]">
					<defs>
						<linearGradient id="pawStrokeGradR" x1="0%" y1="0%" x2="100%" y2="100%">
							<stop offset="0%" stop-color="#fb923c" />
							<stop offset="100%" stop-color="#f97316" />
						</linearGradient>
					</defs>
					<g class="paw-draw-group draw-paw-r">
						<path
							d="M 28 88 C 14 88 12 70 14 56 C 16 42 28 24 50 24 C 72 24 84 42 86 56 C 88 70 86 88 72 88"
							class="paw-outline paw-line-body"
							stroke="url(#pawStrokeGradR)"
						/>
						<path
							d="M 18 48 C 14 43 17 35 24 38 C 30 41 29 51 22 53 C 19 53 18 51 18 48 Z"
							class="paw-outline paw-line-toe toe-1"
							stroke="url(#pawStrokeGradR)"
						/>
						<path
							d="M 33 34 C 31 26 38 20 44 23 C 50 26 49 37 42 39 C 37 40 33 38 33 34 Z"
							class="paw-outline paw-line-toe toe-2"
							stroke="url(#pawStrokeGradR)"
						/>
						<path
							d="M 56 34 C 55 26 62 20 68 23 C 74 26 73 37 66 39 C 61 40 56 38 56 34 Z"
							class="paw-outline paw-line-toe toe-3"
							stroke="url(#pawStrokeGradR)"
						/>
						<path
							d="M 82 48 C 86 43 83 35 76 38 C 70 41 71 51 78 53 C 81 53 82 51 82 48 Z"
							class="paw-outline paw-line-toe toe-4"
							stroke="url(#pawStrokeGradR)"
						/>
						<path
							d="M 33 58 C 24 58 23 68 28 75 C 33 82 41 84 50 84 C 59 84 67 82 72 75 C 77 68 76 58 67 58 C 60 58 55 63 50 64 C 45 63 40 58 33 58 Z"
							class="paw-outline paw-line-palm"
							stroke="url(#pawStrokeGradR)"
						/>
					</g>
				</svg>
			</div>
		</div>
	{:else}
		<!-- Single Neko Paw Outline Line-Drawing Animation -->
		<div class="{sizeMap[size]} paw-loader-container">
			<svg viewBox="0 0 100 100" class="w-full h-full filter drop-shadow-[0_2px_12px_rgba(249,115,22,0.45)]">
				<defs>
					<linearGradient id="nekoPawGrad" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stop-color="#f97316" />
						<stop offset="100%" stop-color="#fb923c" />
					</linearGradient>
				</defs>

				<g class="paw-draw-group">
					<!-- Paw Outline Body (Drawn first) -->
					<path
						d="M 28 88 C 14 88 12 70 14 56 C 16 42 28 24 50 24 C 72 24 84 42 86 56 C 88 70 86 88 72 88"
						class="paw-outline paw-line-body"
						stroke="url(#nekoPawGrad)"
					/>

					<!-- Cute Toe Beans Outlines (Drawn consecutively) -->
					<!-- Toe 1 (Left Pinky Bean) -->
					<path
						d="M 18 48 C 14 43 17 35 24 38 C 30 41 29 51 22 53 C 19 53 18 51 18 48 Z"
						class="paw-outline paw-line-toe toe-1"
						stroke="url(#nekoPawGrad)"
					/>

					<!-- Toe 2 (Left Index Bean) -->
					<path
						d="M 33 34 C 31 26 38 20 44 23 C 50 26 49 37 42 39 C 37 40 33 38 33 34 Z"
						class="paw-outline paw-line-toe toe-2"
						stroke="url(#nekoPawGrad)"
					/>

					<!-- Toe 3 (Right Middle Bean) -->
					<path
						d="M 56 34 C 55 26 62 20 68 23 C 74 26 73 37 66 39 C 61 40 56 38 56 34 Z"
						class="paw-outline paw-line-toe toe-3"
						stroke="url(#nekoPawGrad)"
					/>

					<!-- Toe 4 (Right Pinky Bean) -->
					<path
						d="M 82 48 C 86 43 83 35 76 38 C 70 41 71 51 78 53 C 81 53 82 51 82 48 Z"
						class="paw-outline paw-line-toe toe-4"
						stroke="url(#nekoPawGrad)"
					/>

					<!-- Main Palm Pad (Heart-curved cat pad) -->
					<path
						d="M 33 58 C 24 58 23 68 28 75 C 33 82 41 84 50 84 C 59 84 67 82 72 75 C 77 68 76 58 67 58 C 60 58 55 63 50 64 C 45 63 40 58 33 58 Z"
						class="paw-outline paw-line-palm"
						stroke="url(#nekoPawGrad)"
					/>
				</g>
			</svg>
		</div>
	{/if}

	{#if text}
		<span class="{textSizeMap[size]} text-zinc-400 font-medium flex items-center gap-1.5 mt-1 tracking-wide">
			<span>{text}</span>
			<span class="inline-flex text-[var(--color-primary)] animate-pulse">🐾</span>
		</span>
	{/if}
</div>

<style>
	/* Base Outline Styling */
	.paw-outline {
		fill: transparent;
		stroke-width: 3.5;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition: fill 0.3s ease;
	}

	/* Micro bounce & breathing container */
	.paw-loader-container {
		animation: pawFloat 2s ease-in-out infinite;
	}

	@keyframes pawFloat {
		0%, 100% {
			transform: translateY(0) scale(1);
		}
		50% {
			transform: translateY(-4px) scale(1.03);
		}
	}

	/* Line Drawing Animation Sequences (dasharray & dashoffset trick) */
	/* Total loop duration = 2.4s: Draw lines -> Soft Fill Glow -> Fade Out -> Repeat */

	.paw-line-body {
		stroke-dasharray: 230;
		stroke-dashoffset: 230;
		animation: drawPawBody 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
	}

	.paw-line-toe {
		stroke-dasharray: 60;
		stroke-dashoffset: 60;
		animation: drawPawToe 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
	}

	.toe-1 { animation-delay: 0.2s; }
	.toe-2 { animation-delay: 0.35s; }
	.toe-3 { animation-delay: 0.5s; }
	.toe-4 { animation-delay: 0.65s; }

	.paw-line-palm {
		stroke-dasharray: 180;
		stroke-dashoffset: 180;
		animation: drawPawPalm 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
		animation-delay: 0.8s;
	}

	@keyframes drawPawBody {
		0% {
			stroke-dashoffset: 230;
			fill: transparent;
			opacity: 0.2;
		}
		35%, 75% {
			stroke-dashoffset: 0;
			fill: rgba(249, 115, 22, 0.08);
			opacity: 1;
		}
		90%, 100% {
			stroke-dashoffset: 0;
			fill: transparent;
			opacity: 0.2;
		}
	}

	@keyframes drawPawToe {
		0% {
			stroke-dashoffset: 60;
			fill: transparent;
			opacity: 0.2;
		}
		35%, 75% {
			stroke-dashoffset: 0;
			fill: rgba(249, 115, 22, 0.25);
			opacity: 1;
		}
		90%, 100% {
			stroke-dashoffset: 0;
			fill: transparent;
			opacity: 0.2;
		}
	}

	@keyframes drawPawPalm {
		0% {
			stroke-dashoffset: 180;
			fill: transparent;
			opacity: 0.2;
		}
		40%, 75% {
			stroke-dashoffset: 0;
			fill: rgba(249, 115, 22, 0.3);
			opacity: 1;
		}
		90%, 100% {
			stroke-dashoffset: 0;
			fill: transparent;
			opacity: 0.2;
		}
	}

	/* Walking variant animations */
	.draw-paw-l .paw-line-body { animation-delay: 0s; }
	.draw-paw-l .toe-1 { animation-delay: 0.15s; }
	.draw-paw-l .toe-2 { animation-delay: 0.28s; }
	.draw-paw-l .toe-3 { animation-delay: 0.4s; }
	.draw-paw-l .toe-4 { animation-delay: 0.52s; }
	.draw-paw-l .paw-line-palm { animation-delay: 0.65s; }

	.draw-paw-r .paw-line-body { animation-delay: 0.7s; }
	.draw-paw-r .toe-1 { animation-delay: 0.85s; }
	.draw-paw-r .toe-2 { animation-delay: 0.98s; }
	.draw-paw-r .toe-3 { animation-delay: 1.1s; }
	.draw-paw-r .toe-4 { animation-delay: 1.22s; }
	.draw-paw-r .paw-line-palm { animation-delay: 1.35s; }

	.paw-step-left {
		animation: stepLeft 1.4s ease-in-out infinite;
	}

	.paw-step-right {
		animation: stepRight 1.4s ease-in-out infinite;
	}

	@keyframes stepLeft {
		0%, 100% {
			transform: translateY(3px) scale(0.9);
			opacity: 0.4;
		}
		40% {
			transform: translateY(-4px) scale(1.05);
			opacity: 1;
		}
	}

	@keyframes stepRight {
		0%, 100% {
			transform: translateY(-4px) scale(1.05);
			opacity: 1;
		}
		50% {
			transform: translateY(3px) scale(0.9);
			opacity: 0.4;
		}
	}
</style>
