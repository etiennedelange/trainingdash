import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { LiveMessage } from "#shared/types";
import { queryKeys } from "@/lib/queries";

const MAX_BACKOFF = 30_000;

/**
 * Holds the live socket. The socket is an optimisation, never the source of
 * truth: every path here ends in invalidating the activities cache, so a
 * dropped connection or a missed event self-corrects on the next refetch.
 */
export function useLiveUpdates(): { connected: boolean } {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

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

  return { connected };
}
