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
		xs: 'w-6 h-6',
		sm: 'w-9 h-9',
		md: 'w-14 h-14',
		lg: 'w-20 h-20',
		xl: 'w-28 h-28'
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
		<!-- Walking Paws Variant: Alternating step paws -->
		<div class="flex items-center gap-2 sm:gap-3">
			<!-- Left Paw -->
			<div class="{sizeMap[size]} paw-step-left">
				<svg viewBox="0 0 100 100" class="w-full h-full filter drop-shadow-[0_4px_12px_rgba(249,115,22,0.25)]">
					<defs>
						<linearGradient id="pawGradL" x1="0%" y1="0%" x2="100%" y2="100%">
							<stop offset="0%" stop-color="var(--color-primary, #f97316)" />
							<stop offset="100%" stop-color="var(--color-accent, #db2777)" />
						</linearGradient>
					</defs>
					<!-- Paw Body -->
					<path
						d="M 30 92 C 16 92 12 76 13 60 C 14 44 26 22 50 22 C 74 22 86 44 87 60 C 88 76 84 92 70 92 Z"
						fill="#27272a"
						stroke="#3f3f46"
						stroke-width="2.5"
					/>
					<!-- Toe 1 -->
					<ellipse cx="23" cy="45" rx="6.5" ry="9" transform="rotate(-26 23 45)" fill="url(#pawGradL)" class="toe-bean toe-1" />
					<!-- Toe 2 -->
					<ellipse cx="40" cy="32" rx="7.5" ry="10.5" transform="rotate(-8 40 32)" fill="url(#pawGradL)" class="toe-bean toe-2" />
					<!-- Toe 3 -->
					<ellipse cx="60" cy="32" rx="7.5" ry="10.5" transform="rotate(8 60 32)" fill="url(#pawGradL)" class="toe-bean toe-3" />
					<!-- Toe 4 -->
					<ellipse cx="77" cy="45" rx="6.5" ry="9" transform="rotate(26 77 45)" fill="url(#pawGradL)" class="toe-bean toe-4" />
					<!-- Main Palm Pad -->
					<path
						d="M 33 58 C 24 58 22 67 26 75 C 31 83 40 85 50 85 C 60 85 69 83 74 75 C 78 67 76 58 67 58 C 60 58 55 62 50 63 C 45 62 40 58 33 58 Z"
						fill="url(#pawGradL)"
						class="palm-pad"
					/>
				</svg>
			</div>

			<!-- Right Paw -->
			<div class="{sizeMap[size]} paw-step-right">
				<svg viewBox="0 0 100 100" class="w-full h-full filter drop-shadow-[0_4px_12px_rgba(219,39,119,0.25)]">
					<defs>
						<linearGradient id="pawGradR" x1="0%" y1="0%" x2="100%" y2="100%">
							<stop offset="0%" stop-color="var(--color-accent, #db2777)" />
							<stop offset="100%" stop-color="var(--color-primary, #f97316)" />
						</linearGradient>
					</defs>
					<!-- Paw Body -->
					<path
						d="M 30 92 C 16 92 12 76 13 60 C 14 44 26 22 50 22 C 74 22 86 44 87 60 C 88 76 84 92 70 92 Z"
						fill="#27272a"
						stroke="#3f3f46"
						stroke-width="2.5"
					/>
					<!-- Toe 1 -->
					<ellipse cx="23" cy="45" rx="6.5" ry="9" transform="rotate(-26 23 45)" fill="url(#pawGradR)" class="toe-bean toe-1" />
					<!-- Toe 2 -->
					<ellipse cx="40" cy="32" rx="7.5" ry="10.5" transform="rotate(-8 40 32)" fill="url(#pawGradR)" class="toe-bean toe-2" />
					<!-- Toe 3 -->
					<ellipse cx="60" cy="32" rx="7.5" ry="10.5" transform="rotate(8 60 32)" fill="url(#pawGradR)" class="toe-bean toe-3" />
					<!-- Toe 4 -->
					<ellipse cx="77" cy="45" rx="6.5" ry="9" transform="rotate(26 77 45)" fill="url(#pawGradR)" class="toe-bean toe-4" />
					<!-- Main Palm Pad -->
					<path
						d="M 33 58 C 24 58 22 67 26 75 C 31 83 40 85 50 85 C 60 85 69 83 74 75 C 78 67 76 58 67 58 C 60 58 55 62 50 63 C 45 62 40 58 33 58 Z"
						fill="url(#pawGradR)"
						class="palm-pad"
					/>
				</svg>
			</div>
		</div>
	{:else}
		<!-- Single Kneading / Bouncing Cute Paw -->
		<div class="{sizeMap[size]} paw-knead-container">
			<svg viewBox="0 0 100 100" class="w-full h-full filter drop-shadow-[0_4px_16px_rgba(249,115,22,0.3)]">
				<defs>
					<linearGradient id="pawGradSingle" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stop-color="var(--color-primary, #f97316)" />
						<stop offset="100%" stop-color="var(--color-accent, #db2777)" />
					</linearGradient>
					<filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
						<feGaussianBlur stdDeviation="3" result="blur" />
						<feComposite in="SourceGraphic" in2="blur" operator="over" />
					</filter>
				</defs>

				<!-- Cute Paw Base -->
				<path
					d="M 30 92 C 16 92 12 76 13 60 C 14 44 26 22 50 22 C 74 22 86 44 87 60 C 88 76 84 92 70 92 Z"
					fill="#1c1c1f"
					stroke="#3f3f46"
					stroke-width="2.5"
				/>

				<!-- Cute Little Claws (soft rounded tips) -->
				<path d="M 23 34 Q 22 28 21 27 Q 24 29 25 34 Z" fill="#71717a" opacity="0.6" />
				<path d="M 40 20 Q 40 14 39 13 Q 42 15 42 20 Z" fill="#71717a" opacity="0.6" />
				<path d="M 60 20 Q 60 14 61 13 Q 58 15 58 20 Z" fill="#71717a" opacity="0.6" />
				<path d="M 77 34 Q 78 28 79 27 Q 76 29 75 34 Z" fill="#71717a" opacity="0.6" />

				<!-- Toe Beans with cute wave animations -->
				<ellipse cx="23" cy="45" rx="6.5" ry="9" transform="rotate(-26 23 45)" fill="url(#pawGradSingle)" class="toe-bean toe-1" />
				<ellipse cx="40" cy="32" rx="7.5" ry="10.5" transform="rotate(-8 40 32)" fill="url(#pawGradSingle)" class="toe-bean toe-2" />
				<ellipse cx="60" cy="32" rx="7.5" ry="10.5" transform="rotate(8 60 32)" fill="url(#pawGradSingle)" class="toe-bean toe-3" />
				<ellipse cx="77" cy="45" rx="6.5" ry="9" transform="rotate(26 77 45)" fill="url(#pawGradSingle)" class="toe-bean toe-4" />

				<!-- Main Palm Pad (Heart-lobed bean) -->
				<path
					d="M 33 58 C 24 58 22 67 26 75 C 31 83 40 85 50 85 C 60 85 69 83 74 75 C 78 67 76 58 67 58 C 60 58 55 62 50 63 C 45 62 40 58 33 58 Z"
					fill="url(#pawGradSingle)"
					class="palm-pad"
				/>
			</svg>
		</div>
	{/if}

	{#if text}
		<span class="{textSizeMap[size]} text-zinc-400 animate-pulse tracking-wide font-medium flex items-center gap-1.5">
			<span>{text}</span>
			<span class="inline-flex gap-0.5 text-[var(--color-primary)]">
				<span class="animate-bounce" style="animation-delay: 0ms">🐾</span>
			</span>
		</span>
	{/if}
</div>

<style>
	/* Single Paw Kneading / Bobbing Animation */
	.paw-knead-container {
		transform-origin: 50% 85%;
		animation: catKnead 1.4s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
		will-change: transform;
	}

	@keyframes catKnead {
		0%, 100% {
			transform: translateY(0) scale(1, 1);
		}
		28% {
			transform: translateY(-6px) scale(0.94, 1.06);
		}
		65% {
			transform: translateY(3px) scale(1.06, 0.94);
		}
	}

	/* Toe Beans Sequential Wave Animation */
	.toe-bean {
		transform-origin: center;
		animation: beanWave 1.4s ease-in-out infinite;
	}

	.toe-1 { animation-delay: 0.05s; }
	.toe-2 { animation-delay: 0.18s; }
	.toe-3 { animation-delay: 0.31s; }
	.toe-4 { animation-delay: 0.44s; }

	.palm-pad {
		transform-origin: 50% 70%;
		animation: palmPulse 1.4s ease-in-out infinite;
		animation-delay: 0.25s;
	}

	@keyframes beanWave {
		0%, 100% {
			opacity: 0.75;
			transform-origin: center;
		}
		50% {
			opacity: 1;
			filter: drop-shadow(0 0 5px var(--color-primary, #f97316));
		}
	}

	@keyframes palmPulse {
		0%, 100% {
			opacity: 0.85;
		}
		50% {
			opacity: 1;
			filter: drop-shadow(0 0 7px var(--color-accent, #db2777));
		}
	}

	/* Walking Paws Alternating Step Animations */
	.paw-step-left {
		transform-origin: 50% 85%;
		animation: stepLeft 1.2s ease-in-out infinite;
	}

	.paw-step-right {
		transform-origin: 50% 85%;
		animation: stepRight 1.2s ease-in-out infinite;
	}

	@keyframes stepLeft {
		0%, 100% {
			transform: translateY(4px) scale(0.85);
			opacity: 0.4;
		}
		35% {
			transform: translateY(-5px) scale(1.08);
			opacity: 1;
		}
		65% {
			transform: translateY(2px) scale(0.95);
			opacity: 0.6;
		}
	}

	@keyframes stepRight {
		0%, 100% {
			transform: translateY(-5px) scale(1.08);
			opacity: 1;
		}
		35% {
			transform: translateY(2px) scale(0.95);
			opacity: 0.6;
		}
		65% {
			transform: translateY(4px) scale(0.85);
			opacity: 0.4;
		}
	}
</style>
