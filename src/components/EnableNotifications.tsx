import { useState } from "react";

export function EnableNotifications({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<"idle" | "done" | "denied" | "unsupported">(
    "Notification" in window && "serviceWorker" in navigator ? "idle" : "unsupported",
  );

  async function enable() {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return setState("denied");

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidPublicKey,
    });

    await fetch("/api/push/subscribe", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    setState("done");
  }

  if (state === "unsupported") return null;
  if (state === "done") return <p className="text-xs text-muted">Notifications on.</p>;
  if (state === "denied") {
    return <p className="text-xs text-muted">Notifications blocked in browser settings.</p>;
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={() => void enable()}
        className="rounded-[10px] border border-dashed border-line px-4 py-2 text-xs font-semibold text-muted hover:border-muted"
      >
        Notify me when an activity lands
      </button>
      <p className="text-[11px] text-faint">
        On iOS, this only works once the app is installed to the home screen.
      </p>
    </div>
  );
}
