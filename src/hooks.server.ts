import type { Handle } from '@sveltejs/kit';
import { PALETTE_ANCHORS } from '$lib/palette';

const serialised = JSON.stringify(PALETTE_ANCHORS);

export const handle: Handle = async ({ event, resolve }) =>
	resolve(event, {
		transformPageChunk: ({ html }) => html.replace('/*palette*/[]', serialised)
	});
