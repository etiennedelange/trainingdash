import { useRegisterSW } from "virtual:pwa-register/react";

// How often to poll for a new deploy while the tab stays open. The browser
// only checks the service worker for updates on navigation by default, so
// without this a long-lived dashboard tab would never see the prompt.
const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

// Sits in the sidebar footer, matching the nav-button style, and only takes
// up space once a deploy is actually detected — no floating toast.
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => void registration.update(), UPDATE_CHECK_INTERVAL_MS);
    },
  });

  if (!needRefresh) return null;

  return (
    <button
      onClick={() => void updateServiceWorker(true)}
      className="flex w-full items-center gap-2 rounded-[var(--radius-nav)] px-3 py-2.5 text-left text-sm font-bold text-accent transition-colors hover:bg-raised"
    >
      <span
        aria-hidden="true"
        className="size-1.5 rounded-full bg-gradient-to-r from-warm-from to-warm-to"
      />
      Update ready
    </button>
  );
}
