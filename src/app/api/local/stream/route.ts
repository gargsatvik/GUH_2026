import { memoryEmitter } from "@/lib/db/memory";
import { supabaseConfigured } from "@/lib/env";
import { bad } from "@/lib/http";
import type { ChangeEvent } from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Local preview only: Server-Sent Events stand in for Supabase Realtime.
export async function GET(req: Request) {
  if (supabaseConfigured()) return bad("Not available", 404);
  const emitter = memoryEmitter();
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (e: ChangeEvent) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          cleanup();
        }
      };
      const ping = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: ping\n\n`));
        } catch {
          cleanup();
        }
      }, 15000);
      emitter.on("change", send);
      cleanup = () => {
        clearInterval(ping);
        emitter.off("change", send);
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
      controller.enqueue(enc.encode(`retry: 1000\n: connected\n\n`));
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
