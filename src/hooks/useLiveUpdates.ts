import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { LiveMessage } from "#shared/types";
import { queryKeys } from "@/lib/queries";

const MAX_BACKOFF = 30_000;

// How long an activity stays flagged as "just arrived" — long enough to
// register as an event, short enough that it never reads as a permanent state.
const ARRIVAL_TTL = 2_600;

/**
 * Holds the live socket. The socket is an optimisation, never the source of
 * truth: every path here ends in invalidating the activities cache, so a
 * dropped connection or a missed event self-corrects on the next refetch.
 */
export function useLiveUpdates(): {
  connected: boolean;
  arrivedIds: Set<number>;
  lastArrivalName: string | null;
} {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [arrivedIds, setArrivedIds] = useState<Set<number>>(() => new Set());
  const [lastArrivalName, setLastArrivalName] = useState<string | null>(null);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let backoff = 1000;
    let disposed = false;

    const refetch = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activities });
    };

    const connect = () => {
      if (disposed) return;
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${proto}//${window.location.host}/live`);

      socket.onopen = () => {
        backoff = 1000;
        setConnected(true);
        // Close whatever gap the disconnection opened.
        refetch();
      };

      socket.onmessage = (event) => {
        let msg: LiveMessage;
        try {
          msg = JSON.parse(String(event.data)) as LiveMessage;
        } catch {
          return;
        }
        if (msg.type === "activity.upsert") {
          const id = msg.activity.id;
          setArrivedIds((prev) => new Set(prev).add(id));
          setLastArrivalName(msg.activity.name);
          setTimeout(() => {
            if (disposed) return;
            setArrivedIds((prev) => {
              if (!prev.has(id)) return prev;
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            setLastArrivalName(null);
          }, ARRIVAL_TTL);
        }
        if (msg.type === "activity.upsert" || msg.type === "activity.delete") {
          refetch();
        }
      };

      socket.onclose = () => {
        setConnected(false);
        if (disposed) return;
        timer = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, MAX_BACKOFF);
      };
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") refetch();
    };

    connect();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer) clearTimeout(timer);
      socket?.close();
    };
  }, [queryClient]);

  return { connected, arrivedIds, lastArrivalName };
}

const LiveArrivalsContext = createContext<Set<number>>(new Set());
const LiveStatusContext = createContext<{ connected: boolean; lastArrivalName: string | null }>({
  connected: false,
  lastArrivalName: null,
});

/**
 * Runs the live socket once at the app shell and republishes connection
 * status plus which activity ids just arrived, so any component in the tree
 * — nav badge, row glow, or a persistent shell indicator — can react without
 * every route re-deriving its own socket connection.
 */
export function LiveArrivalsProvider({ children }: { children: ReactNode }) {
  const { connected, arrivedIds, lastArrivalName } = useLiveUpdates();
  return createElement(
    LiveStatusContext.Provider,
    { value: { connected, lastArrivalName } },
    createElement(LiveArrivalsContext.Provider, { value: arrivedIds }, children),
  );
}

export function useJustArrived(activityId: number): boolean {
  return useContext(LiveArrivalsContext).has(activityId);
}

/** Whether any activity is currently flagged "just arrived," for a nav-level cue. */
export function useHasLiveArrival(): boolean {
  return useContext(LiveArrivalsContext).size > 0;
}

/** Live-socket connection state and the name of the most recently arrived activity, if any. */
export function useLiveStatus(): { connected: boolean; lastArrivalName: string | null } {
  return useContext(LiveStatusContext);
}
