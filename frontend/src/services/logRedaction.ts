const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'refresh_token',
  'access_token',
  'authorization',
  'token',
  'token_hash',
]);

const REDACTED = '***';

export function redactValue<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value as object)) {
    return '[Circular]' as unknown as T;
  }
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen)) as unknown as T;
  }

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.trim().toLowerCase())) {
      out[key] = REDACTED;
    } else {
      out[key] = redactValue(item, seen);
    }
  }
  return out as unknown as T;
}
