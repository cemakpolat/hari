// ─────────────────────────────────────────────────────────────────────────────
// Streaming JSON utilities — NDJSON parser for progressive intent rendering.
//
// Two entry points:
//   1. NdjsonStreamParser  — stateful class; feed() raw chunks, receive onValue
//      callbacks as complete lines are delimited.
//   2. streamNdjson()      — async generator; works with ReadableStream / fetch
//      streaming responses (response.body piped through a TextDecoderStream).
//
// Why NDJSON for HARI?
//   Agents may stream multiple partial IntentPayload updates before sending
//   the final, fully-populated payload.  The frontend can render each update
//   progressively (skeleton → partial data → full data) without waiting for
//   the complete response.
//
// Protocol:
//   Each newline-terminated line is a complete JSON object — either a full
//   IntentPayload or a partial "intent_patch" that the receiver merges with
//   the previous state.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Low-level helpers ────────────────────────────────────────────────────────

export type NdjsonChunkResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; raw: string };

/**
 * Parse a single NDJSON line.
 * Returns a typed result rather than throwing so callers can handle errors
 * on a per-line basis without aborting the whole stream.
 */
export function parseNdjsonLine<T = unknown>(line: string): NdjsonChunkResult<T> {
  const trimmed = line.trim();
  if (!trimmed) return { ok: false, error: 'empty line', raw: line };
  try {
    return { ok: true, value: JSON.parse(trimmed) as T };
  } catch (err) {
    return { ok: false, error: String(err), raw: line };
  }
}

/**
 * Split a raw buffer string into complete NDJSON lines and a remainder.
 * The remainder contains bytes received after the last newline character —
 * i.e. the start of a not-yet-complete JSON object that should be buffered
 * until the next chunk arrives.
 */
export function splitNdjsonBuffer(buffer: string): {
  lines: string[];
  remainder: string;
} {
  const idx = buffer.lastIndexOf('\n');
  if (idx === -1) return { lines: [], remainder: buffer };
  return {
    lines: buffer.slice(0, idx).split('\n').filter((l) => l.trim()),
    remainder: buffer.slice(idx + 1),
  };
}

// ─── Stateful stream parser ───────────────────────────────────────────────────

/**
 * Stateful NDJSON stream parser.
 *
 * Feed raw string chunks (e.g. from a WebSocket message or SSE event) and
 * receive parsed values via the `onValue` callback as complete lines arrive.
 *
 * ```ts
 * const parser = new NdjsonStreamParser<IntentPayload>();
 * parser.onValue = (intent) => renderIntent(intent);
 * parser.onError = (err, raw) => console.warn('[stream]', err, raw);
 *
 * ws.addEventListener('message', (ev) => parser.feed(ev.data));
 * ws.addEventListener('close', () => parser.flush());
 * ```
 */
export class NdjsonStreamParser<T = unknown> {
  private _buffer = '';

  onValue?: (value: T) => void;
  onError?: (error: string, raw: string) => void;

  feed(chunk: string): void {
    this._buffer += chunk;
    const { lines, remainder } = splitNdjsonBuffer(this._buffer);
    this._buffer = remainder;
    for (const line of lines) {
      const result = parseNdjsonLine<T>(line);
      if (result.ok) {
        this.onValue?.(result.value);
      } else {
        this.onError?.(result.error, result.raw);
      }
    }
  }

  /**
   * Flush any remaining buffered content as a final parse attempt.
   * Call this when the stream ends (WebSocket close, SSE end-of-stream, etc.).
   */
  flush(): void {
    const remaining = this._buffer.trim();
    if (!remaining) return;
    this._buffer = '';
    const result = parseNdjsonLine<T>(remaining);
    if (result.ok) {
      this.onValue?.(result.value);
    } else {
      this.onError?.(result.error, remaining);
    }
  }

  reset(): void {
    this._buffer = '';
  }
}

// ─── Async generator API ──────────────────────────────────────────────────────

/**
 * Transform an async iterable of raw string chunks into an async iterable of
 * parsed JSON values.  Designed for use with the Fetch Streams API:
 *
 * ```ts
 * const response = await fetch('/hari/stream');
 * const stream = response.body!
 *   .pipeThrough(new TextDecoderStream())
 *   .getReader();
 *
 * async function* asAsyncIterable(reader: ReadableStreamDefaultReader<string>) {
 *   try { while (true) { const { done, value } = await reader.read(); if (done) break; yield value; } }
 *   finally { reader.releaseLock(); }
 * }
 *
 * for await (const intent of streamNdjson<IntentPayload>(asAsyncIterable(stream))) {
 *   renderIntent(intent); // render each partial update progressively
 * }
 * ```
 */
export async function* streamNdjson<T = unknown>(
  source: AsyncIterable<string>,
): AsyncGenerator<T> {
  let buffer = '';
  for await (const chunk of source) {
    buffer += chunk;
    const { lines, remainder } = splitNdjsonBuffer(buffer);
    buffer = remainder;
    for (const line of lines) {
      const result = parseNdjsonLine<T>(line);
      if (result.ok) yield result.value;
    }
  }
  // Flush any remaining partial line at end-of-stream
  if (buffer.trim()) {
    const result = parseNdjsonLine<T>(buffer);
    if (result.ok) yield result.value;
  }
}
