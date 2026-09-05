import type { Action } from 'svelte/action';

export const countUp: Action<HTMLElement, { target: number | string; duration?: number }> = (
  node,
  params
) => {
  const { target, duration = 1200 } = params;
  const str = String(target);
  const match = str.match(/^(\d+(?:\.\d+)?)(.*)$/);
  const isNumeric = match !== null;

  let observer: IntersectionObserver | undefined;
  let fired = false;

  function animate() {
    if (fired) return;
    fired = true;

    if (!isNumeric) {
      node.textContent = '';
      let i = 0;
      const delay = Math.max(40, duration / str.length);
      const id = setInterval(() => {
        node.textContent = str.slice(0, ++i);
        if (i >= str.length) clearInterval(id);
      }, delay);
      return;
    }

    const numeric = parseFloat(match[1]);
    const suffix = match[2];
    const startTime = performance.now();

    function tick(now: number) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = String(Math.round(numeric * eased)) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }

    node.textContent = '0' + suffix;
    requestAnimationFrame(tick);
  }

  if (typeof IntersectionObserver !== 'undefined') {
    node.textContent = isNumeric ? '0' + (match?.[2] ?? '') : '';
    observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) animate(); },
      { threshold: 0.5 }
    );
    observer.observe(node);
  } else {
    node.textContent = str;
  }

  return { destroy() { observer?.disconnect(); } };
};
