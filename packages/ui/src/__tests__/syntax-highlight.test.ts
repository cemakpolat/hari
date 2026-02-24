// ─────────────────────────────────────────────────────────────────────────────
// syntaxTokenize — unit tests
//
// Verifies that the lightweight regex-based tokenizer produces the correct
// token types for each supported language (TypeScript, Python, Bash, JSON)
// and handles edge cases (empty input, unknown language, multiline comments,
// backtick template literals, hex numbers).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { syntaxTokenize } from '../components/DocumentRenderer';

// ── Helpers ────────────────────────────────────────────────────────────────────

function typesOf(code: string, lang?: string): string[] {
  return syntaxTokenize(code, lang).map((t) => t.type);
}

function valuesOf(code: string, lang?: string): string[] {
  return syntaxTokenize(code, lang).map((t) => t.value);
}

function tokensOfType(code: string, lang: string, type: string): string[] {
  return syntaxTokenize(code, lang)
    .filter((t) => t.type === type)
    .map((t) => t.value);
}

// ── TypeScript / JavaScript ─────────────────────────────────────────────────

describe('syntaxTokenize — TypeScript', () => {
  it('tokenizes a const declaration', () => {
    const tokens = syntaxTokenize('const x = 1', 'ts');
    expect(tokensOfType('const x = 1', 'ts', 'keyword')).toContain('const');
    expect(tokensOfType('const x = 1', 'ts', 'number')).toContain('1');
  });

  it('tokenizes multiple keywords on one line', () => {
    const code = 'const fn = async () => null';
    const kws = tokensOfType(code, 'ts', 'keyword');
    expect(kws).toContain('const');
    expect(kws).toContain('async');
    expect(kws).toContain('null');
  });

  it('tokenizes a double-quoted string', () => {
    const code = 'const s = "hello world"';
    expect(tokensOfType(code, 'ts', 'string')).toEqual(['"hello world"']);
  });

  it('tokenizes a single-quoted string', () => {
    const code = "const s = 'hi'";
    expect(tokensOfType(code, 'ts', 'string')).toEqual(["'hi'"]);
  });

  it('tokenizes a backtick template literal', () => {
    const code = 'const t = `hello ${name}`';
    expect(tokensOfType(code, 'ts', 'string')).toEqual(['`hello ${name}`']);
  });

  it('tokenizes a single-line comment', () => {
    const code = '// this is a comment';
    expect(tokensOfType(code, 'ts', 'comment')).toEqual(['// this is a comment']);
  });

  it('tokenizes a multi-line comment', () => {
    const code = '/* line1\nline2 */';
    expect(tokensOfType(code, 'ts', 'comment')).toEqual(['/* line1\nline2 */']);
  });

  it('tokenizes integer and float numbers', () => {
    const code = 'let x = 42; let y = 3.14;';
    const nums = tokensOfType(code, 'js', 'number');
    expect(nums).toContain('42');
    expect(nums).toContain('3.14');
  });

  it('tokenizes a hex number', () => {
    const code = 'const mask = 0xFF;';
    expect(tokensOfType(code, 'ts', 'number')).toContain('0xFF');
  });

  it('comments swallow keywords inside them', () => {
    const code = '// const inside comment';
    expect(tokensOfType(code, 'ts', 'keyword')).toHaveLength(0);
    expect(tokensOfType(code, 'ts', 'comment')).toEqual(['// const inside comment']);
  });

  it('strings swallow keywords inside them', () => {
    const code = '"const is a keyword"';
    expect(tokensOfType(code, 'ts', 'keyword')).toHaveLength(0);
    expect(tokensOfType(code, 'ts', 'string')).toEqual(['"const is a keyword"']);
  });

  it('reconstructed output equals original input', () => {
    const code = 'const add = (a: number, b: number): number => a + b;';
    const reconstructed = syntaxTokenize(code, 'ts').map((t) => t.value).join('');
    expect(reconstructed).toBe(code);
  });

  it('handles empty string', () => {
    expect(syntaxTokenize('', 'ts')).toEqual([]);
  });
});

// ── Python ──────────────────────────────────────────────────────────────────

describe('syntaxTokenize — Python', () => {
  it('tokenizes Python keywords', () => {
    const code = 'def greet(name): return None';
    const kws = tokensOfType(code, 'python', 'keyword');
    expect(kws).toContain('def');
    expect(kws).toContain('return');
    expect(kws).toContain('None');
  });

  it('tokenizes Python hash comment', () => {
    const code = '# this is python';
    expect(tokensOfType(code, 'python', 'comment')).toEqual(['# this is python']);
  });

  it('does NOT tokenize // as a comment in Python', () => {
    const code = '// not a comment in python';
    expect(tokensOfType(code, 'py', 'comment')).toHaveLength(0);
  });

  it('does NOT tokenize backtick template literals in Python', () => {
    // backtick is not a string delimiter in Python; should not be a 'string' token
    const code = 'echo `date`';
    expect(tokensOfType(code, 'python', 'string').some((s) => s.startsWith('`'))).toBe(false);
  });

  it('tokenizes True and False as keywords', () => {
    const code = 'x = True; y = False';
    const kws = tokensOfType(code, 'py', 'keyword');
    expect(kws).toContain('True');
    expect(kws).toContain('False');
  });

  it('reconstructed output equals original input', () => {
    const code = 'def add(a, b):\n    return a + b  # add two numbers';
    const reconstructed = syntaxTokenize(code, 'python').map((t) => t.value).join('');
    expect(reconstructed).toBe(code);
  });
});

// ── Bash ────────────────────────────────────────────────────────────────────

describe('syntaxTokenize — Bash', () => {
  it('tokenizes bash keywords', () => {
    const code = 'if [ -f file ]; then echo ok; fi';
    const kws = tokensOfType(code, 'bash', 'keyword');
    expect(kws).toContain('if');
    expect(kws).toContain('then');
    expect(kws).toContain('fi');
    expect(kws).toContain('echo');
  });

  it('tokenizes hash comment in bash', () => {
    const code = '# set -e';
    expect(tokensOfType(code, 'sh', 'comment')).toEqual(['# set -e']);
  });

  it('does NOT generate backtick template literal tokens for bash', () => {
    // backtick in bash is command substitution, not a string — tokenizer
    // should not treat it as a string for bash language
    const code = 'echo `date`';
    const strings = tokensOfType(code, 'bash', 'string');
    // backtick should not appear as a string token in bash mode
    expect(strings.some((s) => s.startsWith('`'))).toBe(false);
  });

  it('reconstructed output equals original input', () => {
    const code = 'for f in *.ts; do echo $f; done';
    const reconstructed = syntaxTokenize(code, 'shell').map((t) => t.value).join('');
    expect(reconstructed).toBe(code);
  });
});

// ── JSON ────────────────────────────────────────────────────────────────────

describe('syntaxTokenize — JSON', () => {
  it('tokenizes strings in JSON', () => {
    const code = '{"key": "value"}';
    const strings = tokensOfType(code, 'json', 'string');
    expect(strings).toContain('"key"');
    expect(strings).toContain('"value"');
  });

  it('tokenizes numbers in JSON', () => {
    const code = '{"count": 42, "ratio": 0.5}';
    const nums = tokensOfType(code, 'json', 'number');
    expect(nums).toContain('42');
    expect(nums).toContain('0.5');
  });

  it('does NOT tokenize // as comment in JSON', () => {
    const code = '// not a comment';
    expect(tokensOfType(code, 'json', 'comment')).toHaveLength(0);
  });

  it('does NOT produce keywords for JSON', () => {
    // true/false/null are not in the JSON keyword list (no keywords defined)
    const code = '{"ok": true, "x": null}';
    expect(tokensOfType(code, 'json', 'keyword')).toHaveLength(0);
  });

  it('reconstructed output equals original input', () => {
    const code = '{"a": 1, "b": "hello", "c": true}';
    const reconstructed = syntaxTokenize(code, 'json').map((t) => t.value).join('');
    expect(reconstructed).toBe(code);
  });
});

// ── Unknown / no language ───────────────────────────────────────────────────

describe('syntaxTokenize — unknown language', () => {
  it('falls back to TypeScript tokenizer for unknown languages', () => {
    // Unknown lang is treated as TypeScript (isTs = true fallback)
    const code = 'const x = 1';
    const kws = tokensOfType(code, 'cobol', 'keyword');
    // TypeScript path is taken; 'const' is a TS keyword
    expect(kws).toContain('const');
  });

  it('handles undefined language without error', () => {
    const tokens = syntaxTokenize('hello world', undefined);
    expect(tokens.map((t) => t.value).join('')).toBe('hello world');
  });
});
