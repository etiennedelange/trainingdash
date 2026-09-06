import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";
import type { LiveMessage } from "#shared/types";

export class LiveRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Heartbeats are answered by the runtime without waking this object,
    // so an idle connection costs no duration billing.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/connect") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      // acceptWebSocket, not server.accept() — this is what makes the socket
      // hibernatable, letting the object be evicted while it stays open.
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/broadcast" && request.method === "POST") {
      const body = await request.text();
      let delivered = 0;
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(body);
          delivered += 1;
        } catch {
          // A socket that died between enumeration and send is not an error;
          // the client refetches on reconnect.
        }
      }
      return Response.json({ delivered });
    }

    return new Response("Not found", { status: 404 });
  }

  override async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    ws.close(code, reason);
  }
}

export async function broadcast(env: Env, msg: LiveMessage): Promise<void> {
  const stub = env.LIVE.getByName("live");
  await stub.fetch("http://do/broadcast", { method: "POST", body: JSON.stringify(msg) });
}
