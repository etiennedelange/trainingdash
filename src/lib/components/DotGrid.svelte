<script lang="ts">
	interface Props {
		animate?: boolean;
		testHour?: number;
	}

	interface Burst {
		x: number;
		y: number;
		radius: number;
		maxRadius: number;
	}

	let { animate = true, testHour }: Props = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);

	$effect(() => {
		if (!canvas) return;

		const el = canvas;
		const ctx = el.getContext('2d');
		if (!ctx) return;

		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const shouldAnimate = animate && !prefersReducedMotion;

		const SPACING = 28;
		const DOT_RADIUS = 1.5;
		const BURST_SPEED = 4.5;
		const BURST_SIGMA = 30;
		const BURST_AMPLITUDE = 0.8;
		const MOUSE_SIGMA = 80;
		const MOUSE_AMPLITUDE = 0.35;

		let targetX = 0;
		let targetY = 0;
		let mouseInside = false;
		let animFrameId = 0;
		let inkColor = '#0a0a0a';
		let isDark = false;
		const bursts: Burst[] = [];

		// --- Time-of-day colour helpers ---

		interface ColorAnchor {
			hour: number;
			rgb: [number, number, number];
		}

		const TIME_ANCHORS: ColorAnchor[] = [
			{ hour: 0,  rgb: [74, 222, 128] }, // Green    #4ade80
			{ hour: 5,  rgb: [249, 115, 22] }, // Coral    #f97316
			{ hour: 7,  rgb: [234, 179, 8]  }, // Yellow   #eab308
			{ hour: 11, rgb: [56, 189, 248] }, // Sky blue #38bdf8
			{ hour: 16, rgb: [245, 158, 11] }, // Amber    #f59e0b
			{ hour: 19, rgb: [34, 197, 94]  }, // Green    #22c55e
			{ hour: 24, rgb: [74, 222, 128] }, // Green    #4ade80 (wrap)
		];

		function getTimeColor(): [number, number, number] {
			const fractionalHour = testHour ?? new Date().getHours() + new Date().getMinutes() / 60;

			// Find the two surrounding anchors
			let fromAnchor = TIME_ANCHORS[0];
			let toAnchor = TIME_ANCHORS[TIME_ANCHORS.length - 1];

			for (let i = 0; i < TIME_ANCHORS.length - 1; i++) {
				if (fractionalHour >= TIME_ANCHORS[i].hour && fractionalHour < TIME_ANCHORS[i + 1].hour) {
					fromAnchor = TIME_ANCHORS[i];
					toAnchor = TIME_ANCHORS[i + 1];
					break;
				}
			}

			const span = toAnchor.hour - fromAnchor.hour;
			const t = span > 0 ? (fractionalHour - fromAnchor.hour) / span : 0;

			return [
				Math.round(fromAnchor.rgb[0] + t * (toAnchor.rgb[0] - fromAnchor.rgb[0])),
				Math.round(fromAnchor.rgb[1] + t * (toAnchor.rgb[1] - fromAnchor.rgb[1])),
				Math.round(fromAnchor.rgb[2] + t * (toAnchor.rgb[2] - fromAnchor.rgb[2]))
			];
		}

		// --- Existing helpers ---

		function readColors() {
			const style = getComputedStyle(document.documentElement);
			inkColor = style.getPropertyValue('--c-ink').trim() || '#0a0a0a';
			isDark = document.documentElement.classList.contains('dark');
		}

		function resize() {
			const dpr = window.devicePixelRatio || 1;
			const rect = el.getBoundingClientRect();
			el.width = Math.round(rect.width * dpr);
			el.height = Math.round(rect.height * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			targetX = rect.width / 2;
			targetY = rect.height / 2;
		}

		function gaussian(dist: number, sigma: number): number {
			return Math.exp(-(dist * dist) / (2 * sigma * sigma));
		}

		function parseColor(color: string): [number, number, number] {
			const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
			if (rgbMatch) {
				return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])];
			}
			const clean = color.replace(/^#/, '');
			const full =
				clean.length === 3
					? clean
							.split('')
							.map((c) => c + c)
							.join('')
					: clean;
			const n = parseInt(full, 16);
			if (isNaN(n)) return [10, 10, 10];
			return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
		}

		function drawFrame() {
			const rect = el.getBoundingClientRect();
			const w = rect.width;
			const h = rect.height;
			ctx.clearRect(0, 0, w, h);

			const BASE_OPACITY = isDark ? 0.13 : 0.08;

			const [ir, ig, ib] = parseColor(inkColor);
			const [tr, tg, tb] = getTimeColor();

			const cols = Math.ceil(w / SPACING) + 1;
			const rows = Math.ceil(h / SPACING) + 1;
			const offsetX = (w % SPACING) / 2;
			const offsetY = (h % SPACING) / 2;

			for (let row = 0; row < rows; row++) {
				for (let col = 0; col < cols; col++) {
					const x = offsetX + col * SPACING;
					const y = offsetY + row * SPACING;

					// Draw base ink dot
					ctx.beginPath();
					ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
					ctx.fillStyle = `rgba(${ir},${ig},${ib},${BASE_OPACITY})`;
					ctx.fill();

					if (shouldAnimate) {
						// Accumulate interactive opacity delta in time colour
						let interactiveOpacity = 0;

						// Burst ripples from clicks
						for (const burst of bursts) {
							const bd = Math.sqrt((x - burst.x) ** 2 + (y - burst.y) ** 2);
							interactiveOpacity +=
								BURST_AMPLITUDE * gaussian(Math.abs(bd - burst.radius), BURST_SIGMA);
						}

						// Proximity glow under mouse
						if (mouseInside) {
							const md = Math.sqrt((x - targetX) ** 2 + (y - targetY) ** 2);
							interactiveOpacity += MOUSE_AMPLITUDE * gaussian(md, MOUSE_SIGMA);
						}

						if (interactiveOpacity > 0) {
							interactiveOpacity = Math.min(interactiveOpacity, 0.9);
							ctx.beginPath();
							ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
							ctx.fillStyle = `rgba(${tr},${tg},${tb},${interactiveOpacity})`;
							ctx.fill();
						}
					}
				}
			}

			if (shouldAnimate) {
				// Advance and cull bursts
				for (let i = bursts.length - 1; i >= 0; i--) {
					bursts[i].radius += BURST_SPEED;
					if (bursts[i].radius > bursts[i].maxRadius) bursts.splice(i, 1);
				}

				animFrameId = requestAnimationFrame(drawFrame);
			}
		}

		// Translate page-relative mouse coords to canvas-local coords
		function toLocal(e: MouseEvent): { x: number; y: number } {
			const rect = el.getBoundingClientRect();
			return { x: e.clientX - rect.left, y: e.clientY - rect.top };
		}

		function onMouseMove(e: MouseEvent) {
			const { x, y } = toLocal(e);
			targetX = x;
			targetY = y;
		}

		function onMouseEnter(e: MouseEvent) {
			mouseInside = true;
			const { x, y } = toLocal(e);
			targetX = x;
			targetY = y;
		}

		function onMouseLeave() {
			mouseInside = false;
			// Drift back to center
			const rect = el.getBoundingClientRect();
			targetX = rect.width / 2;
			targetY = rect.height / 2;
		}

		function onClick(e: MouseEvent) {
			const { x, y } = toLocal(e);
			const rect = el.getBoundingClientRect();
			const maxR = Math.sqrt(rect.width ** 2 + rect.height ** 2);
			bursts.push({ x, y, radius: 0, maxRadius: maxR });
		}

		// Attach listeners to the section (parent), not the canvas (pointer-events:none)
		const parent = el.parentElement;
		if (parent && shouldAnimate) {
			parent.addEventListener('mousemove', onMouseMove);
			parent.addEventListener('mouseenter', onMouseEnter);
			parent.addEventListener('mouseleave', onMouseLeave);
			parent.addEventListener('click', onClick);
		}

		readColors();
		resize();

		if (shouldAnimate) {
			animFrameId = requestAnimationFrame(drawFrame);
		} else {
			drawFrame();
		}

		const resizeObserver = new ResizeObserver(() => {
			resize();
			if (!shouldAnimate) drawFrame();
		});
		resizeObserver.observe(el.parentElement ?? el);

		const mutObs = new MutationObserver(() => {
			readColors();
			if (!shouldAnimate) drawFrame();
		});
		mutObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

		return () => {
			cancelAnimationFrame(animFrameId);
			resizeObserver.disconnect();
			mutObs.disconnect();
			if (parent && shouldAnimate) {
				parent.removeEventListener('mousemove', onMouseMove);
				parent.removeEventListener('mouseenter', onMouseEnter);
				parent.removeEventListener('mouseleave', onMouseLeave);
				parent.removeEventListener('click', onClick);
			}
		};
	});
</script>

<canvas
	bind:this={canvas}
	aria-hidden="true"
	class="pointer-events-none absolute inset-0 h-full w-full"
	style="z-index: 0;"
></canvas>
