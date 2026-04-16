import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import Docker from "dockerode";
import {
  createLineSplitter,
  createParserState,
  feedLine,
  type ParserState,
} from "@/lib/logs/parser";
import type { LogEntry } from "@/lib/logs/types";

const DOCKER_SOCKET_PATH = process.env.DOCKER_SOCKET_PATH ?? "/var/run/docker.sock";
const BACKEND_CONTAINER = process.env.LOGS_BACKEND_CONTAINER ?? "gamemaster-backend";
const TAIL = Number(process.env.LOGS_TAIL ?? "200");

let docker: Docker | null = null;

export function getDocker(): Docker {
  if (!docker) {
    docker = new Docker({ socketPath: DOCKER_SOCKET_PATH });
  }
  return docker;
}

export interface UpstreamSnapshot {
  recent: LogEntry[];
  emitter: EventEmitter;
  subscribe(): void;
  unsubscribe(): void;
  status: () => UpstreamStatus;
}

export interface UpstreamStatus {
  connected: boolean;
  lastError: string | null;
  lastConnectedAt: number | null;
  refCount: number;
}

const RECENT_BUFFER_LIMIT = 500;
const RECONNECT_DELAY_MS = 2000;

class Upstream {
  private readonly emitter = new EventEmitter();
  private readonly recent: LogEntry[] = [];
  private readonly parserState: ParserState = createParserState();
  private readonly stdoutSplitter = createLineSplitter();
  private readonly stderrSplitter = createLineSplitter();
  private refCount = 0;
  private connected = false;
  private lastError: string | null = null;
  private lastConnectedAt: number | null = null;
  private currentStream: NodeJS.ReadableStream | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(private readonly containerName: string) {
    this.emitter.setMaxListeners(0);
  }

  subscribe(): void {
    this.refCount += 1;
    if (this.refCount === 1) {
      this.stopped = false;
      this.connect();
    }
  }

  unsubscribe(): void {
    this.refCount -= 1;
    if (this.refCount <= 0) {
      this.refCount = 0;
      this.stopped = true;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      const stream = this.currentStream as unknown as { destroy?: () => void } | null;
      if (stream && typeof stream.destroy === "function") {
        stream.destroy();
      }
      this.currentStream = null;
      this.connected = false;
    }
  }

  getRecent(): LogEntry[] {
    return [...this.recent];
  }

  getEmitter(): EventEmitter {
    return this.emitter;
  }

  getStatus(): UpstreamStatus {
    return {
      connected: this.connected,
      lastError: this.lastError,
      lastConnectedAt: this.lastConnectedAt,
      refCount: this.refCount,
    };
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    try {
      const container = getDocker().getContainer(this.containerName);
      const stream = (await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
        tail: TAIL,
        timestamps: false,
      })) as unknown as NodeJS.ReadableStream;
      // Между запросом logs() и его завершением мог сработать unsubscribe (refCount=0).
      // Если так — закрываем только что полученный stream и выходим, иначе он останется
      // висеть с подписанным listener'ом и продолжит качать данные.
      if (this.stopped || this.refCount === 0) {
        const dyingStream = stream as unknown as { destroy?: () => void } | null;
        if (dyingStream && typeof dyingStream.destroy === "function") {
          dyingStream.destroy();
        }
        return;
      }
      this.currentStream = stream;
      this.connected = true;
      this.lastError = null;
      this.lastConnectedAt = Date.now();
      this.emitter.emit("status", this.getStatus());

      const stdoutPass = new PassThrough();
      const stderrPass = new PassThrough();
      getDocker().modem.demuxStream(stream, stdoutPass, stderrPass);

      stdoutPass.on("data", (chunk: Buffer) => this.handleChunk(chunk, this.stdoutSplitter));
      stderrPass.on("data", (chunk: Buffer) => this.handleChunk(chunk, this.stderrSplitter));

      const onClose = (err?: Error) => {
        this.connected = false;
        this.currentStream = null;
        if (err) {
          this.lastError = err.message;
        }
        this.emitter.emit("status", this.getStatus());
        if (!this.stopped && this.refCount > 0) {
          this.scheduleReconnect();
        }
      };
      stream.on("end", () => onClose());
      stream.on("close", () => onClose());
      stream.on("error", (err: Error) => onClose(err));
    } catch (error) {
      this.connected = false;
      this.lastError = error instanceof Error ? error.message : String(error);
      this.emitter.emit("status", this.getStatus());
      if (!this.stopped && this.refCount > 0) {
        this.scheduleReconnect();
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, RECONNECT_DELAY_MS);
  }

  private handleChunk(chunk: Buffer, splitter: (chunk: Buffer | string) => string[]): void {
    const lines = splitter(chunk);
    for (const line of lines) {
      const result = feedLine(this.parserState, line);
      if (result.emit) {
        this.emit(result.emit);
      }
    }
  }

  private emit(entry: LogEntry): void {
    this.recent.push(entry);
    if (this.recent.length > RECENT_BUFFER_LIMIT) {
      this.recent.shift();
    }
    this.emitter.emit("entry", entry);
  }
}

const upstreams = new Map<string, Upstream>();

export function getBackendUpstream(): Upstream {
  let upstream = upstreams.get(BACKEND_CONTAINER);
  if (!upstream) {
    upstream = new Upstream(BACKEND_CONTAINER);
    upstreams.set(BACKEND_CONTAINER, upstream);
  }
  return upstream;
}

export async function pingDocker(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getDocker().ping();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
