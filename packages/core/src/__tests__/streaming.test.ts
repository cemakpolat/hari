import { describe, it, expect, vi } from 'vitest';
import {
  parseNdjsonLine,
  splitNdjsonBuffer,
  NdjsonStreamParser,
  streamNdjson,
} from '../transport/streaming';

describe('parseNdjsonLine', () => {
  it('parses a valid JSON line', () => {
    const result = parseNdjsonLine<{ x: number }>('{"x":42}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.x).toBe(42);
  });

  it('returns ok=false for an empty line', () => {
    const result = parseNdjsonLine('');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('empty');
  });

  it('returns ok=false for whitespace-only line', () => {
    const result = parseNdjsonLine('   ');
    expect(result.ok).toBe(false);
  });

  it('returns ok=false and preserves raw for invalid JSON', () => {
    const raw = '{ bad json }';
    const result = parseNdjsonLine(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.raw).toBe(raw);
      expect(typeof result.error).toBe('string');
    }
  });

  it('handles JSON primitives (string, number, boolean)', () => {
    expect(parseNdjsonLine<string>('"hello"')).toMatchObject({ ok: true, value: 'hello' });
    expect(parseNdjsonLine<number>('99')).toMatchObject({ ok: true, value: 99 });
    expect(parseNdjsonLine<boolean>('true')).toMatchObject({ ok: true, value: true });
  });
});

describe('splitNdjsonBuffer', () => {
  it('returns empty lines and full remainder when no newline present', () => {
    const result = splitNdjsonBuffer('{"incomplete":true');
    expect(result.lines).toHaveLength(0);
    expect(result.remainder).toBe('{"incomplete":true');
  });

  it('splits on newline and returns remainder after last newline', () => {
    const buf = '{"a":1}\n{"b":2}\n{"c":3';
    const { lines, remainder } = splitNdjsonBuffer(buf);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('{"a":1}');
    expect(lines[1]).toBe('{"b":2}');
    expect(remainder).toBe('{"c":3');
  });

  it('treats trailing newline as empty remainder', () => {
    const { lines, remainder } = splitNdjsonBuffer('{"a":1}\n{"b":2}\n');
    expect(lines).toHaveLength(2);
    expect(remainder).toBe('');
  });

  it('filters blank lines from the lines array', () => {
    const { lines } = splitNdjsonBuffer('{"a":1}\n\n{"b":2}\n');
    expect(lines).toHaveLength(2);
  });
});

describe('NdjsonStreamParser', () => {
  it('calls onValue for each complete JSON line', () => {
    const parser = new NdjsonStreamParser<{ n: number }>();
    const values: number[] = [];
    parser.onValue = (v) => values.push(v.n);

    parser.feed('{"n":1}\n{"n":2}\n');
    expect(values).toEqual([1, 2]);
  });

  it('buffers partial lines across feed() calls', () => {
    const parser = new NdjsonStreamParser<{ n: number }>();
    const values: number[] = [];
    parser.onValue = (v) => values.push(v.n);

    parser.feed('{"n":');
    expect(values).toHaveLength(0); // partial — not yet complete

    parser.feed('10}\n');
    expect(values).toEqual([10]);
  });

  it('calls onError for malformed JSON lines', () => {
    const parser = new NdjsonStreamParser();
    const errors: string[] = [];
    parser.onError = (e) => errors.push(e);

    parser.feed('{ bad json }\n{"ok":true}\n');
    expect(errors).toHaveLength(1);
  });

  it('flush() emits a pending partial line', () => {
    const parser = new NdjsonStreamParser<{ v: string }>();
    const values: string[] = [];
    parser.onValue = (v) => values.push(v.v);

    parser.feed('{"v":"final"}'); // no trailing newline
    expect(values).toHaveLength(0); // still buffered

    parser.flush();
    expect(values).toEqual(['final']);
  });

  it('flush() is a no-op on empty buffer', () => {
    const parser = new NdjsonStreamParser();
    const onValue = vi.fn();
    parser.onValue = onValue;
    parser.flush();
    expect(onValue).not.toHaveBeenCalled();
  });

  it('reset() discards buffered content', () => {
    const parser = new NdjsonStreamParser<{ n: number }>();
    const values: number[] = [];
    parser.onValue = (v) => values.push(v.n);

    parser.feed('{"n":1}'); // buffered — no newline
    parser.reset();
    parser.flush(); // buffer was cleared — nothing to flush
    expect(values).toHaveLength(0);
  });

  it('handles a large burst of lines in one feed() call', () => {
    const parser = new NdjsonStreamParser<{ i: number }>();
    const values: number[] = [];
    parser.onValue = (v) => values.push(v.i);

    const bulk = Array.from({ length: 100 }, (_, i) => JSON.stringify({ i })).join('\n') + '\n';
    parser.feed(bulk);
    expect(values).toHaveLength(100);
    expect(values[0]).toBe(0);
    expect(values[99]).toBe(99);
  });
});

describe('streamNdjson', () => {
  it('yields parsed values from an async iterable of chunks', async () => {
    async function* chunks() {
      yield '{"a":1}\n{"a":';
      yield '2}\n{"a":3}\n';
    }

    const values: number[] = [];
    for await (const v of streamNdjson<{ a: number }>(chunks())) {
      values.push(v.a);
    }
    expect(values).toEqual([1, 2, 3]);
  });

  it('flushes a trailing partial line with no newline at end of stream', async () => {
    async function* chunks() {
      yield '{"x":99}'; // no trailing newline
    }

    const values: number[] = [];
    for await (const v of streamNdjson<{ x: number }>(chunks())) {
      values.push(v.x);
    }
    expect(values).toEqual([99]);
  });

  it('silently skips malformed JSON lines', async () => {
    async function* chunks() {
      yield '{"ok":true}\n{ bad json }\n{"also":true}\n';
    }

    const values: unknown[] = [];
    for await (const v of streamNdjson(chunks())) {
      values.push(v);
    }
    expect(values).toHaveLength(2); // bad line is skipped
  });

  it('works with a single-chunk stream', async () => {
    async function* chunks() {
      yield '{"msg":"hello"}\n';
    }

    const values: Array<{ msg: string }> = [];
    for await (const v of streamNdjson<{ msg: string }>(chunks())) {
      values.push(v);
    }
    expect(values[0].msg).toBe('hello');
  });
});
