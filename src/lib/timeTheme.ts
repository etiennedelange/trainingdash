import { PALETTE_ANCHORS, PALETTE_KEYS, type PaletteKey } from './palette';

type CSSPalette = Record<PaletteKey, string>;

function rowToPalette(values: string[]): CSSPalette {
	return Object.fromEntries(PALETTE_KEYS.map((k, i) => [k, values[i]])) as CSSPalette;
}

function lerpHex(a: string, b: string, t: number): string {
	const parse = (h: string): [number, number, number] => {
		const n = parseInt(h.replace('#', ''), 16);
		return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
	};
	const [ar, ag, ab] = parse(a);
	const [br, bg, bb] = parse(b);
	return '#' + [
		Math.round(ar + (br - ar) * t),
		Math.round(ag + (bg - ag) * t),
		Math.round(ab + (bb - ab) * t),
	].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function lerpPalette(a: CSSPalette, b: CSSPalette, t: number): CSSPalette {
	return Object.fromEntries(
		(Object.keys(a) as PaletteKey[]).map((k) => [k, lerpHex(a[k], b[k], t)])
	) as CSSPalette;
}

export function applyTimePalette(fractionalHour: number, isDark: boolean): void {
	let from = PALETTE_ANCHORS[0];
	let to = PALETTE_ANCHORS[PALETTE_ANCHORS.length - 1];

	for (let i = 0; i < PALETTE_ANCHORS.length - 1; i++) {
		if (fractionalHour >= PALETTE_ANCHORS[i][0] && fractionalHour < PALETTE_ANCHORS[i + 1][0]) {
			from = PALETTE_ANCHORS[i];
			to = PALETTE_ANCHORS[i + 1];
			break;
		}
	}

	const span = to[0] - from[0];
	const t = span > 0 ? (fractionalHour - from[0]) / span : 0;
	const palette = lerpPalette(
		rowToPalette(isDark ? from[2] : from[1]),
		rowToPalette(isDark ? to[2] : to[1]),
		t
	);

	const root = document.documentElement;
	for (const [key, value] of Object.entries(palette)) {
		root.style.setProperty(key, value);
	}

	// The portrait duotone multiplies a grayscale photo over this tint, which
	// only ever darkens the result — it needs the vivid (dark-mode) accent
	// variant even in light mode, since the light-mode accent is tuned dark
	// at night for button/tag contrast instead of brightness.
	const portraitTint = lerpHex(
		rowToPalette(from[2])['--c-accent'],
		rowToPalette(to[2])['--c-accent'],
		t
	);
	root.style.setProperty('--c-portrait-tint', portraitTint);
}
