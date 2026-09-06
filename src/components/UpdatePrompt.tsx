import { useRegisterSW } from "virtual:pwa-register/react";

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed right-5 bottom-5 z-50 flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-card px-4 py-3 shadow-2xl">
      <span className="text-xs font-semibold">A new version is ready.</span>
      <button
        onClick={() => void updateServiceWorker(true)}
        className="rounded-[var(--radius-control)] bg-accent px-3 py-1.5 text-xs font-bold text-on-accent"
      >
        Reload
      </button>
    </div>
  );
}
