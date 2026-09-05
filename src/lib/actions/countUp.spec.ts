import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { countUp } from '$lib/actions/countUp';

// Minimal fake DOM node
function makeNode(initial = ''): HTMLElement {
  let _text = initial;
  return {
    get textContent() { return _text; },
    set textContent(v: string) { _text = v ?? ''; },
  } as unknown as HTMLElement;
}

describe('countUp action', () => {
  const observeMock = vi.fn();
  const disconnectMock = vi.fn();
  let intersectionCallback: IntersectionObserverCallback | null = null;

  beforeEach(() => {
    observeMock.mockClear();
    disconnectMock.mockClear();
    intersectionCallback = null;

    // Mock IntersectionObserver
    class MockIO {
      constructor(public cb: IntersectionObserverCallback) {
        intersectionCallback = cb;
      }
      observe = observeMock;
      disconnect = disconnectMock;
    }

    vi.stubGlobal('IntersectionObserver', MockIO as any);
    vi.stubGlobal('performance', { now: () => 0 });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(1200); // fast-forward to end of animation
      return 1;
    });
    vi.stubGlobal('setInterval', (cb: () => void) => {
      // Call immediately for testing
      cb();
      return 1;
    });
    vi.stubGlobal('clearInterval', () => {});
  });

  afterEach(() => vi.unstubAllGlobals());

  it('observes the node via IntersectionObserver', () => {
    const node = makeNode();
    countUp(node, { target: '15+' });
    expect(observeMock).toHaveBeenCalledWith(node);
  });

  it('sets text to final value immediately when IntersectionObserver unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const node = makeNode();
    countUp(node, { target: '15+' });
    expect(node.textContent).toBe('15+');
  });

  it('sets non-numeric text to final value immediately when IO unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const node = makeNode();
    countUp(node, { target: 'Cum Laude' });
    expect(node.textContent).toBe('Cum Laude');
  });

  it('disconnects observer on destroy', () => {
    const node = makeNode();
    const action = countUp(node, { target: 6 });
    action?.destroy?.();
    expect(disconnectMock).toHaveBeenCalled();
  });
});
