import { describe, it, expect } from 'vitest';
import {
  DocumentBlockSchema,
  DocumentSectionSchema,
  DocumentDataSchema,
} from '../schemas/document';

// ── DocumentBlockSchema ───────────────────────────────────────────────────────

describe('DocumentBlockSchema', () => {
  it('parses a heading block', () => {
    const block = { type: 'heading', level: 2, text: 'Root Cause' };
    const result = DocumentBlockSchema.parse(block);
    expect(result.type).toBe('heading');
    if (result.type === 'heading') {
      expect(result.level).toBe(2);
      expect(result.text).toBe('Root Cause');
    }
  });

  it('rejects a heading with an invalid level', () => {
    expect(() =>
      DocumentBlockSchema.parse({ type: 'heading', level: 7, text: 'Too deep' }),
    ).toThrow();
  });

  it('parses a paragraph block with optional confidence', () => {
    const block = { type: 'paragraph', text: 'The root cause was...', confidence: 0.88 };
    const result = DocumentBlockSchema.parse(block);
    expect(result.type).toBe('paragraph');
    if (result.type === 'paragraph') {
      expect(result.confidence).toBe(0.88);
    }
  });

  it('parses a paragraph block without confidence', () => {
    const result = DocumentBlockSchema.parse({ type: 'paragraph', text: 'Some text.' });
    expect(result.type).toBe('paragraph');
    if (result.type === 'paragraph') {
      expect(result.confidence).toBeUndefined();
    }
  });

  it('rejects a paragraph with empty text', () => {
    expect(() =>
      DocumentBlockSchema.parse({ type: 'paragraph', text: '' }),
    ).toThrow();
  });

  it('parses an ordered list block', () => {
    const block = { type: 'list', items: ['Step 1', 'Step 2'], ordered: true };
    const result = DocumentBlockSchema.parse(block);
    if (result.type === 'list') {
      expect(result.ordered).toBe(true);
      expect(result.items).toHaveLength(2);
    }
  });

  it('defaults ordered to false for list blocks', () => {
    const result = DocumentBlockSchema.parse({ type: 'list', items: ['A', 'B'] });
    if (result.type === 'list') {
      expect(result.ordered).toBe(false);
    }
  });

  it('rejects a list with no items', () => {
    expect(() =>
      DocumentBlockSchema.parse({ type: 'list', items: [] }),
    ).toThrow();
  });

  it('parses a code block', () => {
    const block = { type: 'code', code: 'SELECT * FROM events', language: 'sql' };
    const result = DocumentBlockSchema.parse(block);
    if (result.type === 'code') {
      expect(result.language).toBe('sql');
      expect(result.code).toContain('SELECT');
    }
  });

  it('parses a code block without language', () => {
    const result = DocumentBlockSchema.parse({ type: 'code', code: 'echo hello' });
    if (result.type === 'code') {
      expect(result.language).toBeUndefined();
    }
  });

  it.each(['info', 'warning', 'insight', 'critical'] as const)(
    'parses a %s callout block',
    (variant) => {
      const result = DocumentBlockSchema.parse({
        type: 'callout',
        variant,
        text: 'Something important.',
      });
      if (result.type === 'callout') {
        expect(result.variant).toBe(variant);
      }
    },
  );

  it('rejects a callout with an unknown variant', () => {
    expect(() =>
      DocumentBlockSchema.parse({ type: 'callout', variant: 'success', text: 'Done' }),
    ).toThrow();
  });

  it('parses a metric block with trend and delta', () => {
    const block = { type: 'metric', label: 'Error rate', value: '0.3%', trend: 'down', delta: '−0.2%' };
    const result = DocumentBlockSchema.parse(block);
    if (result.type === 'metric') {
      expect(result.trend).toBe('down');
      expect(result.delta).toBe('−0.2%');
    }
  });

  it('parses a divider block', () => {
    const result = DocumentBlockSchema.parse({ type: 'divider' });
    expect(result.type).toBe('divider');
  });

  it('rejects an unknown block type', () => {
    expect(() =>
      DocumentBlockSchema.parse({ type: 'video', src: 'https://example.com' }),
    ).toThrow();
  });

  // ── New block types ──────────────────────────────────────────────────────

  it('parses a table block with headers and rows', () => {
    const block = {
      type: 'table',
      headers: [
        { key: 'name', label: 'Name', align: 'left' },
        { key: 'value', label: 'Value', align: 'right' },
      ],
      rows: [{ name: 'Alpha', value: 42 }, { name: 'Beta', value: 17 }],
      caption: 'Sample data',
    };
    const result = DocumentBlockSchema.parse(block);
    expect(result.type).toBe('table');
    if (result.type === 'table') {
      expect(result.headers).toHaveLength(2);
      expect(result.rows).toHaveLength(2);
      expect(result.caption).toBe('Sample data');
    }
  });

  it('parses a table block without caption', () => {
    const block = {
      type: 'table',
      headers: [{ key: 'col', label: 'Col', align: 'center' }],
      rows: [{ col: 'x' }],
    };
    const result = DocumentBlockSchema.parse(block);
    if (result.type === 'table') {
      expect(result.caption).toBeUndefined();
    }
  });

  it('table header defaults align to left', () => {
    const block = {
      type: 'table',
      headers: [{ key: 'id', label: 'ID' }],
      rows: [],
    };
    const result = DocumentBlockSchema.parse(block);
    if (result.type === 'table') {
      expect(result.headers[0].align).toBe('left');
    }
  });

  it('rejects a table header with unknown alignment', () => {
    expect(() =>
      DocumentBlockSchema.parse({
        type: 'table',
        headers: [{ key: 'col', label: 'Col', align: 'justify' }],
        rows: [],
      }),
    ).toThrow();
  });

  it('parses an image block with all fields', () => {
    const block = {
      type: 'image',
      src: 'https://example.com/chart.png',
      alt: 'Performance chart',
      caption: 'Q1 2026 results',
      width: 800,
    };
    const result = DocumentBlockSchema.parse(block);
    expect(result.type).toBe('image');
    if (result.type === 'image') {
      expect(result.src).toBe('https://example.com/chart.png');
      expect(result.alt).toBe('Performance chart');
      expect(result.caption).toBe('Q1 2026 results');
      expect(result.width).toBe(800);
    }
  });

  it('parses an image block with minimal fields', () => {
    const result = DocumentBlockSchema.parse({
      type: 'image',
      src: '/img/logo.png',
      alt: 'Logo',
    });
    if (result.type === 'image') {
      expect(result.caption).toBeUndefined();
      expect(result.width).toBeUndefined();
    }
  });

  it('parses an image block with string width', () => {
    const result = DocumentBlockSchema.parse({
      type: 'image',
      src: '/img/a.png',
      alt: 'A',
      width: '100%',
    });
    if (result.type === 'image') {
      expect(result.width).toBe('100%');
    }
  });

  it('parses a quote block with all fields', () => {
    const block = {
      type: 'quote',
      text: 'The cloud is just someone else\'s computer.',
      author: 'Anonymous',
      source: 'Dev conference 2024',
    };
    const result = DocumentBlockSchema.parse(block);
    expect(result.type).toBe('quote');
    if (result.type === 'quote') {
      expect(result.author).toBe('Anonymous');
      expect(result.source).toBe('Dev conference 2024');
    }
  });

  it('parses a quote block with text only', () => {
    const result = DocumentBlockSchema.parse({ type: 'quote', text: 'Simple quote.' });
    if (result.type === 'quote') {
      expect(result.author).toBeUndefined();
      expect(result.source).toBeUndefined();
    }
  });

  it('rejects a quote block with empty text', () => {
    expect(() =>
      DocumentBlockSchema.parse({ type: 'quote', text: '' }),
    ).toThrow();
  });

  it.each(['line', 'bar', 'pie', 'scatter', 'area', 'sparkline'] as const)(
    'parses a %s dataviz block',
    (chartType) => {
      const result = DocumentBlockSchema.parse({
        type: 'dataviz',
        chartType,
        data: [{ x: 'Jan', y: 100 }, { x: 'Feb', y: 120 }],
      });
      expect(result.type).toBe('dataviz');
      if (result.type === 'dataviz') {
        expect(result.chartType).toBe(chartType);
        expect(result.data).toHaveLength(2);
      }
    },
  );

  it('parses a dataviz block with title and config', () => {
    const result = DocumentBlockSchema.parse({
      type: 'dataviz',
      chartType: 'bar',
      title: 'Monthly revenue',
      data: [{ x: 'Jan', y: 5000, label: 'January' }],
      config: { color: '#4f46e5' },
    });
    if (result.type === 'dataviz') {
      expect(result.title).toBe('Monthly revenue');
      expect(result.config).toEqual({ color: '#4f46e5' });
      expect(result.data[0].label).toBe('January');
    }
  });

  it('rejects a dataviz block with unknown chart type', () => {
    expect(() =>
      DocumentBlockSchema.parse({
        type: 'dataviz',
        chartType: 'heatmap',
        data: [],
      }),
    ).toThrow();
  });

  it('parses an embed block with all fields', () => {
    const result = DocumentBlockSchema.parse({
      type: 'embed',
      url: 'https://www.youtube.com/embed/abc123',
      fallbackText: 'Cannot display embedded content.',
      height: 400,
    });
    expect(result.type).toBe('embed');
    if (result.type === 'embed') {
      expect(result.fallbackText).toBe('Cannot display embedded content.');
      expect(result.height).toBe(400);
    }
  });

  it('parses an embed block with minimal fields', () => {
    const result = DocumentBlockSchema.parse({
      type: 'embed',
      url: 'https://figma.com/embed?url=...',
    });
    if (result.type === 'embed') {
      expect(result.fallbackText).toBeUndefined();
      expect(result.height).toBeUndefined();
    }
  });

  it('parses an embed block with string height', () => {
    const result = DocumentBlockSchema.parse({
      type: 'embed',
      url: 'https://example.com',
      height: '50vh',
    });
    if (result.type === 'embed') {
      expect(result.height).toBe('50vh');
    }
  });
});

// ── DocumentSectionSchema ─────────────────────────────────────────────────────

describe('DocumentSectionSchema', () => {
  it('parses a minimal section', () => {
    const result = DocumentSectionSchema.parse({ id: 'sec-1', blocks: [] });
    expect(result.id).toBe('sec-1');
    expect(result.blocks).toHaveLength(0);
  });

  it('parses a full section with all optional fields', () => {
    const result = DocumentSectionSchema.parse({
      id: 'sec-2',
      title: 'Root Cause',
      confidence: 0.92,
      blocks: [{ type: 'paragraph', text: 'Connection pool exhausted.' }],
      explainElementId: 'explain-root-cause',
    });
    expect(result.title).toBe('Root Cause');
    expect(result.confidence).toBe(0.92);
    expect(result.explainElementId).toBe('explain-root-cause');
  });

  it('rejects a section with an empty id', () => {
    expect(() =>
      DocumentSectionSchema.parse({ id: '', blocks: [] }),
    ).toThrow();
  });

  it('rejects confidence out of [0, 1]', () => {
    expect(() =>
      DocumentSectionSchema.parse({ id: 's', blocks: [], confidence: 1.5 }),
    ).toThrow();
  });
});

// ── DocumentDataSchema ────────────────────────────────────────────────────────

describe('DocumentDataSchema', () => {
  const MINIMAL = {
    title: 'Incident Post-Mortem',
    sections: [{ id: 'exec', blocks: [{ type: 'paragraph', text: 'All clear.' }] }],
  };

  it('parses a minimal document', () => {
    const result = DocumentDataSchema.parse(MINIMAL);
    expect(result.title).toBe('Incident Post-Mortem');
    expect(result.sections).toHaveLength(1);
  });

  it('parses a full document', () => {
    const result = DocumentDataSchema.parse({
      ...MINIMAL,
      author: 'AI SRE Assistant',
      publishedAt: '2026-02-22T09:00:00Z',
      summary: 'Brief overview.',
      revision: 3,
    });
    expect(result.author).toBe('AI SRE Assistant');
    expect(result.revision).toBe(3);
  });

  it('rejects a document with an empty title', () => {
    expect(() =>
      DocumentDataSchema.parse({ title: '', sections: [{ id: 's', blocks: [] }] }),
    ).toThrow();
  });

  it('rejects a document with no sections', () => {
    expect(() =>
      DocumentDataSchema.parse({ title: 'Empty', sections: [] }),
    ).toThrow();
  });

  it('rejects a non-positive revision number', () => {
    expect(() =>
      DocumentDataSchema.parse({ ...MINIMAL, revision: 0 }),
    ).toThrow();
  });
});
