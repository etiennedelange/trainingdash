import type { Action } from 'svelte/action';

export const stamp: Action<HTMLElement> = (node) => {
	function handleClick() {
		node.classList.add('is-stamped');
		setTimeout(() => node.classList.remove('is-stamped'), 350);
	}
	node.addEventListener('click', handleClick);
	return { destroy() { node.removeEventListener('click', handleClick); } };
};
