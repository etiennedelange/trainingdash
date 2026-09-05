export const PALETTE_KEYS = [
	'--c-bg',
	'--c-bg-alt',
	'--c-bg-card',
	'--c-accent',
	'--c-muted',
	'--c-border-soft'
] as const;

export type PaletteKey = (typeof PALETTE_KEYS)[number];

// Each entry: [hour, lightValues[], darkValues[]]
// Values are ordered to match PALETTE_KEYS above.
export const PALETTE_ANCHORS: [number, string[], string[]][] = [
	[0,  ['#f0f7f4','#e4f0ea','#f0f7f4','#166534','#4a6e5a','#bbddc9'], ['#070f0a','#0d1a10','#0a130c','#4ade80','#4a7a58','#1a3322']],
	[5,  ['#fff7ed','#fff0dc','#fff7ed','#f97316','#78716c','#fed7aa'], ['#1c1008','#241509','#201208','#f97316','#9a7858','#3d2010']],
	[7,  ['#ffffff','#f5f5f4','#ffffff','#f5d90a','#6b7280','#e5e7eb'], ['#1c160e','#241b11','#2a1e12','#f5d90a','#a89178','#3d2d1a']],
	[11, ['#f0f9ff','#e0f2fe','#f0f9ff','#0ea5e9','#4b6a7a','#bae6fd'], ['#071525','#0a1c30','#091a2e','#38bdf8','#6a8aaa','#1a3a55']],
	[16, ['#fffbeb','#fef3c7','#fffbeb','#f59e0b','#78716c','#fde68a'], ['#1c1208','#241909','#201508','#fbbf24','#a89060','#3d2810']],
	[19, ['#f0f7f2','#e2f0e8','#f0f7f2','#15803d','#4d6e58','#bbddc8'], ['#080f0a','#0d1a10','#0a120d','#22c55e','#4a7558','#1a3020']],
	[24, ['#f0f7f4','#e4f0ea','#f0f7f4','#166534','#4a6e5a','#bbddc9'], ['#070f0a','#0d1a10','#0a130c','#4ade80','#4a7a58','#1a3322']],
];
