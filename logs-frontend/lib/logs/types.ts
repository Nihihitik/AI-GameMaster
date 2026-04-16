export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogSource = "backend" | "frontend";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  logger: string;
  event: string | null;
  message: string;
  source: LogSource;
  requestId?: string;
  clientRequestId?: string;
  userId?: string;
  sessionId?: string;
  route?: string;
  details?: Record<string, unknown>;
  traceback?: string;
  raw: string;
}

export interface EventCatalogItem {
  source: LogSource;
  domain: string;
  event: string;
  description: string;
}
