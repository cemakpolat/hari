// ─────────────────────────────────────────────────────────────────────────────
// collaborative-editing.test.ts — unit tests for useDocumentCollaboration
// and the CollaborativeDocument schema types
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  BlockCommentSchema,
  DocumentEditOperationSchema,
  StampedOperationSchema,
} from '@hari/core';
import {
  useDocumentCollaboration,
  createBroadcastTransport,
} from '../hooks/useDocumentCollaboration';
import type { CollabTransport } from '../hooks/useDocumentCollaboration';
import type { DocumentSection } from '@hari/core';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SECTION_A: DocumentSection = {
  id: 'sec-a',
  title: 'Introduction',
  blocks: [
    { type: 'paragraph', text: 'Hello world' },
    { type: 'heading', level: 2, text: 'Overview' },
    { type: 'paragraph', text: 'Details here' },
  ],
  collapsible: false,
  defaultCollapsed: false,
};

const SECTION_B: DocumentSection = {
  id: 'sec-b',
  title: 'Appendix',
  blocks: [
    { type: 'paragraph', text: 'Appendix content' },
  ],
  collapsible: false,
  defaultCollapsed: false,
};

const INITIAL_SECTIONS = [SECTION_A, SECTION_B];

function makeNoopTransport(): CollabTransport {
  return {
    send: vi.fn(),
    onReceive: vi.fn(() => vi.fn()),
    dispose: vi.fn(),
  };
}

function makeCapturingTransport(): CollabTransport & { _sent: unknown[] } {
  const _sent: unknown[] = [];
  return {
    _sent,
    send: vi.fn((op) => { _sent.push(op); }),
    onReceive: vi.fn(() => vi.fn()),
    dispose: vi.fn(),
  };
}

function defaultOpts(overrides = {}) {
  return {
    sections: INITIAL_SECTIONS,
    authorId: 'user-1',
    authorName: 'Alice',
    authorColor: '#4f46e5',
    transport: makeNoopTransport(),
    ...overrides,
  };
}

// ── Schema Tests ──────────────────────────────────────────────────────────────

describe('BlockCommentSchema', () => {
  it('parses a valid open comment', () => {
    const c = BlockCommentSchema.parse({
      commentId: 'c1',
      authorId: 'u1',
      authorName: 'Alice',
      authorColor: '#ff0000',
      text: 'Looks good!',
      createdAt: new Date().toISOString(),
    });
    expect(c.resolved).toBe(false);
  });

  it('parses a resolved comment', () => {
    const c = BlockCommentSchema.parse({
      commentId: 'c2',
      authorId: 'u2',
      authorName: 'Bob',
      authorColor: '#00ff00',
      text: 'Fixed.',
      createdAt: new Date().toISOString(),
      resolved: true,
    });
    expect(c.resolved).toBe(true);
  });

  it('rejects a comment with an empty text', () => {
    expect(() =>
      BlockCommentSchema.parse({
        commentId: 'c3',
        authorId: 'u1',
        authorName: 'Alice',
        authorColor: '#ff0000',
        text: '',
        createdAt: new Date().toISOString(),
      }),
    ).toThrow();
  });
});

describe('DocumentEditOperationSchema', () => {
  it('parses block_edit', () => {
    const op = DocumentEditOperationSchema.parse({
      type: 'block_edit',
      sectionId: 'sec-a',
      blockIndex: 0,
      block: { type: 'paragraph', text: 'Updated' },
    });
    expect(op.type).toBe('block_edit');
  });

  it('parses block_insert', () => {
    const op = DocumentEditOperationSchema.parse({
      type: 'block_insert',
      sectionId: 'sec-a',
      afterIndex: 1,
      block: { type: 'divider' },
    });
    expect(op.type).toBe('block_insert');
  });

  it('parses block_delete', () => {
    const op = DocumentEditOperationSchema.parse({
      type: 'block_delete',
      sectionId: 'sec-a',
      blockIndex: 2,
    });
    expect(op.type).toBe('block_delete');
  });

  it('parses block_move', () => {
    const op = DocumentEditOperationSchema.parse({
      type: 'block_move',
      sectionId: 'sec-a',
      fromIndex: 0,
      toIndex: 2,
    });
    expect(op.type).toBe('block_move');
  });

  it('parses comment_add', () => {
    const op = DocumentEditOperationSchema.parse({
      type: 'comment_add',
      sectionId: 'sec-a',
      blockIndex: 0,
      comment: {
        commentId: 'c1',
        authorId: 'u1',
        authorName: 'Alice',
        authorColor: '#ff0000',
        text: 'Nice!',
        createdAt: new Date().toISOString(),
      },
    });
    expect(op.type).toBe('comment_add');
  });

  it('parses comment_resolve', () => {
    const op = DocumentEditOperationSchema.parse({
      type: 'comment_resolve',
      sectionId: 'sec-a',
      blockIndex: 0,
      commentId: 'c1',
    });
    expect(op.type).toBe('comment_resolve');
  });

  it('rejects unknown types', () => {
    expect(() =>
      DocumentEditOperationSchema.parse({ type: 'block_explode', sectionId: 'sec-a', blockIndex: 0 }),
    ).toThrow();
  });
});

describe('StampedOperationSchema', () => {
  it('parses a valid stamped operation', () => {
    const stamped = StampedOperationSchema.parse({
      opId: 'op-1',
      authorId: 'user-1',
      authorName: 'Alice',
      lamport: 3,
      issuedAt: new Date().toISOString(),
      op: { type: 'block_delete', sectionId: 'sec-a', blockIndex: 1 },
    });
    expect(stamped.lamport).toBe(3);
    expect(stamped.op.type).toBe('block_delete');
  });
});

// ── Hook Tests ────────────────────────────────────────────────────────────────

describe('useDocumentCollaboration — local operations', () => {
  it('initialises with the provided sections', () => {
    const { result } = renderHook(() =>
      useDocumentCollaboration(defaultOpts()),
    );
    expect(result.current.sections).toHaveLength(2);
    expect(result.current.sections[0].blocks).toHaveLength(3);
  });

  it('editBlock replaces the block at the given index', () => {
    const { result } = renderHook(() =>
      useDocumentCollaboration(defaultOpts()),
    );
    act(() => {
      result.current.editBlock('sec-a', 0, { type: 'paragraph', text: 'Updated text' });
    });
    const block = result.current.sections[0].blocks[0];
    expect(block.type).toBe('paragraph');
    if (block.type === 'paragraph') expect(block.text).toBe('Updated text');
  });

  it('editBlock leaves other blocks untouched', () => {
    const { result } = renderHook(() =>
      useDocumentCollaboration(defaultOpts()),
    );
    act(() => {
      result.current.editBlock('sec-a', 0, { type: 'paragraph', text: 'Changed' });
    });
    const second = result.current.sections[0].blocks[1];
    expect(second.type).toBe('heading');
  });

  it('insertBlock appends a block after the given index', () => {
    const { result } = renderHook(() =>
      useDocumentCollaboration(defaultOpts()),
    );
    act(() => {
      result.current.insertBlock('sec-a', 0, { type: 'divider' });
    });
    expect(result.current.sections[0].blocks).toHaveLength(4);
    expect(result.current.sections[0].blocks[1].type).toBe('divider');
  });

  it('insertBlock with afterIndex = -1 prepends', () => {
    const { result } = renderHook(() =>
      useDocumentCollaboration(defaultOpts()),
    );
    act(() => {
      result.current.insertBlock('sec-a', -1, { type: 'divider' });
    });
    expect(result.current.sections[0].blocks[0].type).toBe('divider');
  });

  it('deleteBlock removes the block at the given index', () => {
    const { result } = renderHook(() =>
      useDocumentCollaboration(defaultOpts()),
    );
    act(() => {
      result.current.deleteBlock('sec-a', 1); // remove heading
    });
    expect(result.current.sections[0].blocks).toHaveLength(2);
    expect(result.current.sections[0].blocks[1].type).toBe('paragraph');
  });

  it('moveBlock reorders blocks', () => {
    const { result } = renderHook(() =>
      useDocumentCollaboration(defaultOpts()),
    );
    // Move first block (paragraph) to index 2
    act(() => {
      result.current.moveBlock('sec-a', 0, 2);
    });
    const blocks = result.current.sections[0].blocks;
    expect(blocks[0].type).toBe('heading');
    if (blocks[2].type === 'paragraph') expect(blocks[2].text).toBe('Hello world');
  });

  it('does not affect other sections when editing one', () => {
    const { result } = renderHook(() =>
      useDocumentCollaboration(defaultOpts()),
    );
    act(() => {
      result.current.editBlock('sec-a', 0, { type: 'paragraph', text: 'Changed' });
    });
    expect(result.current.sections[1].blocks[0]).toMatchObject({ type: 'paragraph', text: 'Appendix content' });
  });
});

describe('useDocumentCollaboration — comments', () => {
  it('addComment appends a comment to the block', () => {
    const { result } = renderHook(() =>
      useDocumentCollaboration(defaultOpts()),
    );
    act(() => {
      result.current.addComment('sec-a', 0, 'Great paragraph!');
    });
    const blockComments = result.current.comments['sec-a']?.[0];
    expect(blockComments).toHaveLength(1);
    expect(blockComments?.[0].text).toBe('Great paragraph!');
    expect(blockComments?.[0].authorId).toBe('user-1');
    expect(blockComments?.[0].resolved).toBe(false);
  });

  it('resolveComment marks a comment as resolved', () => {
    const { result } = renderHook(() =>
      useDocumentCollaboration(defaultOpts()),
    );
    act(() => {
      result.current.addComment('sec-a', 0, 'Fixable');
    });
    // Read commentId after the act() flush so state is committed.
    const commentId = result.current.comments['sec-a']?.[0]?.[0]?.commentId ?? '';
    expect(commentId).not.toBe('');
    act(() => {
      result.current.resolveComment('sec-a', 0, commentId);
    });
    const c = result.current.comments['sec-a']?.[0]?.[0];
    expect(c?.resolved).toBe(true);
  });

  it('multiple comments can coexist on the same block', () => {
    const { result } = renderHook(() =>
      useDocumentCollaboration(defaultOpts()),
    );
    act(() => {
      result.current.addComment('sec-a', 0, 'First');
      result.current.addComment('sec-a', 0, 'Second');
    });
    expect(result.current.comments['sec-a']?.[0]).toHaveLength(2);
  });
});

describe('useDocumentCollaboration — undo', () => {
  it('canUndo is false initially', () => {
    const { result } = renderHook(() =>
      useDocumentCollaboration(defaultOpts()),
    );
    expect(result.current.canUndo).toBe(false);
  });

  it('canUndo becomes true after an edit', () => {
    const { result } = renderHook(() =>
      useDocumentCollaboration(defaultOpts()),
    );
    act(() => {
      result.current.editBlock('sec-a', 0, { type: 'paragraph', text: 'New' });
    });
    expect(result.current.canUndo).toBe(true);
  });

  it('undo() restores the previous section state', () => {
    const { result } = renderHook(() =>
      useDocumentCollaboration(defaultOpts()),
    );
    const originalText =
      result.current.sections[0].blocks[0].type === 'paragraph'
        ? result.current.sections[0].blocks[0].text
        : '';

    act(() => {
      result.current.editBlock('sec-a', 0, { type: 'paragraph', text: 'Modified' });
    });
    act(() => {
      result.current.undo();
    });

    const block = result.current.sections[0].blocks[0];
    expect(block.type === 'paragraph' && block.text).toBe(originalText);
  });
});

describe('useDocumentCollaboration — presence', () => {
  it('focusBlock records the current user in focusedBlocks', () => {
    const { result } = renderHook(() =>
      useDocumentCollaboration(defaultOpts()),
    );
    act(() => {
      result.current.focusBlock('sec-a', 0);
    });
    const key = 'sec-a:0';
    expect(result.current.focusedBlocks[key]).toBeDefined();
    expect(result.current.focusedBlocks[key].authorId).toBe('user-1');
    expect(result.current.focusedBlocks[key].authorName).toBe('Alice');
  });

  it('blurBlock removes the current user from focusedBlocks', () => {
    const { result } = renderHook(() =>
      useDocumentCollaboration(defaultOpts()),
    );
    act(() => { result.current.focusBlock('sec-a', 0); });
    act(() => { result.current.blurBlock(); });
    expect(result.current.focusedBlocks['sec-a:0']).toBeUndefined();
  });
});

describe('useDocumentCollaboration — transport', () => {
  it('sends a stamped op over the transport for each local operation', () => {
    const transport = makeCapturingTransport();
    const { result } = renderHook(() =>
      useDocumentCollaboration(defaultOpts({ transport })),
    );
    act(() => {
      result.current.editBlock('sec-a', 0, { type: 'paragraph', text: 'Sent' });
    });
    expect(transport.send).toHaveBeenCalledOnce();
    const sent = transport._sent[0] as { op: { type: string } };
    expect(sent.op.type).toBe('block_edit');
  });

  it('increments lamport clock on each issued op', () => {
    const transport = makeCapturingTransport();
    const { result } = renderHook(() =>
      useDocumentCollaboration(defaultOpts({ transport })),
    );
    act(() => {
      result.current.editBlock('sec-a', 0, { type: 'paragraph', text: 'A' });
      result.current.editBlock('sec-a', 1, { type: 'heading', level: 2, text: 'B' });
    });
    const ops = transport._sent as Array<{ lamport: number }>;
    expect(ops[1].lamport).toBeGreaterThan(ops[0].lamport);
  });

  it('calls dispose on transport unmount', () => {
    const transport = makeNoopTransport();
    const { unmount } = renderHook(() =>
      useDocumentCollaboration(defaultOpts({ transport })),
    );
    unmount();
    expect(transport.dispose).toHaveBeenCalledOnce();
  });

  it('calls onChange when sections change', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useDocumentCollaboration(defaultOpts({ onChange })),
    );
    act(() => {
      result.current.insertBlock('sec-a', 0, { type: 'divider' });
    });
    expect(onChange).toHaveBeenCalled();
    const latest = onChange.mock.calls[onChange.mock.calls.length - 1][0] as DocumentSection[];
    expect(latest[0].blocks.some((b) => b.type === 'divider')).toBe(true);
  });
});

describe('createBroadcastTransport', () => {
  it('returns a no-op transport when BroadcastChannel is unavailable', () => {
    const original = (globalThis as Record<string, unknown>).BroadcastChannel;
    delete (globalThis as Record<string, unknown>).BroadcastChannel;

    const t = createBroadcastTransport('test');
    expect(() => t.send({} as never)).not.toThrow();
    expect(() => t.dispose()).not.toThrow();
    const unsub = t.onReceive(() => {});
    expect(() => unsub()).not.toThrow();

    if (original) (globalThis as Record<string, unknown>).BroadcastChannel = original;
  });
});
