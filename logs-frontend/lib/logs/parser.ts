import { ulid } from "ulid";
import type { LogEntry, LogLevel, LogSource } from "./types";

// TZ-suffix опционален: backend всегда пишет offset, но если форматтер однажды поедет
// или придёт строка из другого источника — лучше не дропать запись молча.
const LINE_REGEX = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)\s+(DEBUG|INFO|WARNING|ERROR)\s+(\S+)\s+(?:\[([^\]]+)\]\s+)?(.*)$/;

const LEVEL_MAP: Record<string, LogLevel> = {
  DEBUG: "debug",
  INFO: "info",
  WARNING: "warn",
  ERROR: "error",
};

function parseDetails(raw: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function parseContext(segment: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of segment.split(/\s+/)) {
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    out[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return out;
}

function splitTail(messageAndTail: string): {
  message: string;
  context?: Record<string, string>;
  details?: Record<string, unknown>;
} {
  const detailsMarker = " | details=";
  const detailsIdx = messageAndTail.indexOf(detailsMarker);
  let detailsRaw: string | null = null;
  let withoutDetails = messageAndTail;
  if (detailsIdx >= 0) {
    detailsRaw = messageAndTail.slice(detailsIdx + detailsMarker.length);
    withoutDetails = messageAndTail.slice(0, detailsIdx);
  }

  const ctxMarker = " | ";
  const ctxIdx = withoutDetails.lastIndexOf(ctxMarker);
  let message = withoutDetails;
  let context: Record<string, string> | undefined;
  if (ctxIdx >= 0) {
    const candidate = withoutDetails.slice(ctxIdx + ctxMarker.length);
    if (/^[a-z_][\w]*=/.test(candidate)) {
      context = parseContext(candidate);
      message = withoutDetails.slice(0, ctxIdx);
    }
  }

  return {
    message,
    context,
    details: detailsRaw ? parseDetails(detailsRaw) : undefined,
  };
}

function asString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  return String(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function parseLine(line: string): LogEntry | null {
  const match = LINE_REGEX.exec(line);
  if (!match) return null;

  const [, timestamp, levelName, logger, event, tail] = match;
  const { message, context, details } = splitTail(tail ?? "");

  const sourceRaw = context?.source ?? "backend";
  const source: LogSource = sourceRaw === "frontend" ? "frontend" : "backend";

  let resolvedDetails = details;
  let resolvedRoute = context?.route;
  let resolvedUserId = context?.user_id;
  let resolvedSessionId = context?.session_id;
  let resolvedClientRequestId = context?.client_request_id;
  let resolvedTimestamp = timestamp;

  if (source === "frontend" && details) {
    const frontendContext = isPlainObject(details.frontend_context) ? details.frontend_context : undefined;
    const frontendDetails = isPlainObject(details.frontend_details) ? details.frontend_details : undefined;
    const frontendRoute = asString(details.frontend_route);
    const frontendTimestamp = asString(details.frontend_timestamp);

    if (frontendContext) {
      resolvedRoute = asString(frontendContext.route) ?? resolvedRoute;
      resolvedUserId = asString(frontendContext.userId ?? frontendContext.user_id) ?? resolvedUserId;
      resolvedSessionId = asString(frontendContext.sessionId ?? frontendContext.session_id) ?? resolvedSessionId;
      resolvedClientRequestId =
        asString(frontendContext.clientRequestId ?? frontendContext.client_request_id) ?? resolvedClientRequestId;
    }
    if (frontendDetails) {
      resolvedDetails = frontendDetails;
    }
    if (frontendRoute) resolvedRoute = frontendRoute;
    if (frontendTimestamp) resolvedTimestamp = frontendTimestamp;
  }

  return {
    id: ulid(),
    timestamp: resolvedTimestamp,
    level: LEVEL_MAP[levelName] ?? "info",
    logger,
    event: event ?? null,
    message: message.trim(),
    source,
    requestId: context?.request_id,
    clientRequestId: resolvedClientRequestId,
    userId: resolvedUserId,
    sessionId: resolvedSessionId,
    route: resolvedRoute,
    details: resolvedDetails,
    raw: line,
  };
}

export interface ParserState {
  current: LogEntry | null;
}

export function createParserState(): ParserState {
  return { current: null };
}

export function feedLine(state: ParserState, line: string): { emit?: LogEntry } {
  if (!line) {
    return {};
  }
  const parsed = parseLine(line);
  if (parsed) {
    const previous = state.current;
    state.current = parsed;
    return previous ? { emit: previous } : {};
  }

  if (state.current) {
    state.current.traceback = state.current.traceback ? state.current.traceback + "\n" + line : line;
    state.current.raw = state.current.raw + "\n" + line;
  }
  return {};
}

export function flush(state: ParserState): LogEntry | undefined {
  if (state.current) {
    const out = state.current;
    state.current = null;
    return out;
  }
  return undefined;
}

export function createLineSplitter(): (chunk: Buffer | string) => string[] {
  let buffer = "";
  return (chunk: Buffer | string): string[] => {
    buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    const lines: string[] = [];
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      lines.push(buffer.slice(0, idx).replace(/\r$/, ""));
      buffer = buffer.slice(idx + 1);
    }
    return lines;
  };
}
