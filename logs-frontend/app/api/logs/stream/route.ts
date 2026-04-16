import { NextRequest } from "next/server";
import { getBackendUpstream } from "@/lib/docker/client";
import type { LogEntry } from "@/lib/logs/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENCODER = new TextEncoder();

function sseFrame(event: string, data: unknown): Uint8Array {
  return ENCODER.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: NextRequest) {
  const upstream = getBackendUpstream();
  const sourceParam = request.nextUrl.searchParams.get("source");
  const filterSource = sourceParam === "frontend" ? "frontend" : sourceParam === "backend" ? "backend" : null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const safeClose = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      const matches = (entry: LogEntry) => !filterSource || entry.source === filterSource;

      const onEntry = (entry: LogEntry) => {
        if (!matches(entry) || closed) return;
        try {
          controller.enqueue(sseFrame("entry", entry));
        } catch {
          safeClose();
        }
      };

      const onStatus = (status: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(sseFrame("status", status));
        } catch {
          safeClose();
        }
      };

      upstream.subscribe();
      const emitter = upstream.getEmitter();

      try {
        controller.enqueue(sseFrame("status", upstream.getStatus()));
        const recent = upstream.getRecent().filter(matches);
        controller.enqueue(sseFrame("backlog", recent));
      } catch {
        safeClose();
      }

      emitter.on("entry", onEntry);
      emitter.on("status", onStatus);

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(ENCODER.encode(`: ping\n\n`));
        } catch {
          safeClose();
        }
      }, 20_000);

      const cleanup = () => {
        clearInterval(heartbeat);
        emitter.off("entry", onEntry);
        emitter.off("status", onStatus);
        upstream.unsubscribe();
        safeClose();
      };

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
