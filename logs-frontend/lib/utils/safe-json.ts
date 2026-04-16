export function safeStringify(value: unknown, indent = 2): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(
    value,
    (_, val) => {
      if (typeof val === "object" && val !== null) {
        if (seen.has(val as object)) return "[Circular]";
        seen.add(val as object);
      }
      if (typeof val === "bigint") return `${val}n`;
      return val;
    },
    indent,
  );
}

export type JsonToken =
  | { kind: "key"; text: string }
  | { kind: "string"; text: string }
  | { kind: "number"; text: string }
  | { kind: "boolean"; text: string }
  | { kind: "null"; text: string }
  | { kind: "punct"; text: string }
  | { kind: "ws"; text: string };

const TOKEN_REGEX = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)|([\s\n\r\t]+)|([{}[\],])/giu;

export function tokenizeJson(source: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  TOKEN_REGEX.lastIndex = 0;
  while ((match = TOKEN_REGEX.exec(source)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ kind: "punct", text: source.slice(lastIndex, match.index) });
    }
    const [full, str, colon, kw, num, ws, punct] = match;
    if (str !== undefined) {
      if (colon) {
        tokens.push({ kind: "key", text: str });
        tokens.push({ kind: "punct", text: colon });
      } else {
        tokens.push({ kind: "string", text: str });
      }
    } else if (kw !== undefined) {
      tokens.push({ kind: kw === "null" ? "null" : "boolean", text: kw });
    } else if (num !== undefined) {
      tokens.push({ kind: "number", text: num });
    } else if (ws !== undefined) {
      tokens.push({ kind: "ws", text: ws });
    } else if (punct !== undefined) {
      tokens.push({ kind: "punct", text: punct });
    } else {
      tokens.push({ kind: "punct", text: full });
    }
    lastIndex = TOKEN_REGEX.lastIndex;
  }
  if (lastIndex < source.length) {
    tokens.push({ kind: "punct", text: source.slice(lastIndex) });
  }
  return tokens;
}
