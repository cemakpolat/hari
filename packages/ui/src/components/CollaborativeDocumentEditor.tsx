// ─────────────────────────────────────────────────────────────────────────────
// CollaborativeDocumentEditor — wraps DocumentRenderer with live multi-user editing.
//
// Features:
//   - Block-level edit-in-place (paragraph, heading, code, callout, list)
//   - Real-time collaborator cursors (coloured avatar badges per focused block)
//   - Inline comment threads per block (add, view, resolve)
//   - Pending-op indicator (yellow border = your op in-flight to peers)
//   - Insert block above/below + delete block toolbar (appears on hover/focus)
//   - Undo last local operation (Ctrl/⌘Z)
//   - Block move (↑/↓ arrow buttons)
//   - Read-only mode fallback when `editable={false}`
//   - Delegates to DocumentRenderer for all non-edit rendering concerns
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { DocumentSection, DocumentBlock, BlockCommentMap } from '@hari/core';
import type {
  UseDocumentCollaborationOptions,
  CollaboratorPresenceInfo,
} from '../hooks/useDocumentCollaboration';
import {
  useDocumentCollaboration,
  createBroadcastTransport,
} from '../hooks/useDocumentCollaboration';

// ── Public props ──────────────────────────────────────────────────────────────

export interface CollaborativeDocumentEditorProps {
  /** Initial document sections (from IntentPayload.data.sections). */
  sections: DocumentSection[];
  /** Document title displayed in the header. */
  title: string;
  /** Collaborator identity for this user. */
  authorId: string;
  authorName: string;
  /** Hex colour for this user's cursors / avatars. */
  authorColor: string;
  /**
   * BroadcastChannel name for same-origin tab sync.
   * Use the intent ID so each document has its own channel.
   * @default 'hari-collab-default'
   */
  channelName?: string;
  /** Custom transport (e.g. WebSocket) — overrides channelName. */
  transport?: UseDocumentCollaborationOptions['transport'];
  /** When false, renders read-only (no edit overlay). @default true */
  editable?: boolean;
  /** Called whenever sections change (for lifting state up). */
  onChange?: (sections: DocumentSection[]) => void;
  density?: 'executive' | 'operator' | 'expert';
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CollaborativeDocumentEditor({
  sections: initialSections,
  title,
  authorId,
  authorName,
  authorColor,
  channelName = 'hari-collab-default',
  transport,
  editable = true,
  onChange,
  density = 'operator',
}: CollaborativeDocumentEditorProps) {
  const collab = useDocumentCollaboration({
    sections: initialSections,
    authorId,
    authorName,
    authorColor,
    channelName,
    transport,
    onChange,
  });

  // Undo keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        collab.undo();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [collab]);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Editor header */}
      <CollabHeader
        title={title}
        pendingCount={collab.pendingOps.length}
        canUndo={collab.canUndo}
        onUndo={collab.undo}
        focusedBlocks={collab.focusedBlocks}
        editable={editable}
      />

      {/* Section list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.25rem' }}>
        {collab.sections.map((section) => (
          <CollabSection
            key={section.id}
            section={section}
            collab={collab}
            editable={editable}
            comments={collab.comments}
            density={density}
          />
        ))}
      </div>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

interface CollabHeaderProps {
  title: string;
  pendingCount: number;
  canUndo: boolean;
  onUndo: () => void;
  focusedBlocks: Record<string, CollaboratorPresenceInfo>;
  editable: boolean;
}

function CollabHeader({ title, pendingCount, canUndo, onUndo, focusedBlocks, editable }: CollabHeaderProps) {
  const activeCollabs = Object.values(focusedBlocks).reduce<Record<string, CollaboratorPresenceInfo>>(
    (acc, info) => { acc[info.authorId] = info; return acc; },
    {},
  );
  const collabList = Object.values(activeCollabs);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      paddingBottom: '0.75rem',
      borderBottom: '2px solid #e2e8f0',
    }}>
      <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', flex: 1 }}>
        {title}
      </h2>

      {/* Collaborator avatars */}
      {collabList.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '-0.25rem' }}>
          {collabList.slice(0, 5).map((c) => (
            <CollabAvatar key={c.authorId} info={c} size={24} />
          ))}
          {collabList.length > 5 && (
            <span style={{ fontSize: '0.7rem', color: '#64748b', marginLeft: '0.25rem' }}>
              +{collabList.length - 5}
            </span>
          )}
        </div>
      )}

      {pendingCount > 0 && (
        <span style={{
          fontSize: '0.65rem',
          fontWeight: 600,
          color: '#d97706',
          backgroundColor: '#fefce8',
          border: '1px solid #fcd34d',
          borderRadius: '0.25rem',
          padding: '0.15rem 0.4rem',
        }}>
          Syncing…
        </span>
      )}

      {editable && (
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo last edit (⌘Z)"
          aria-label="Undo last edit"
          style={{
            fontSize: '0.75rem',
            padding: '0.25rem 0.5rem',
            border: '1px solid #e2e8f0',
            borderRadius: '0.375rem',
            backgroundColor: 'white',
            color: canUndo ? '#334155' : '#cbd5e1',
            cursor: canUndo ? 'pointer' : 'not-allowed',
          }}
        >
          ↩ Undo
        </button>
      )}
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

interface CollabSectionProps {
  section: DocumentSection;
  collab: ReturnType<typeof useDocumentCollaboration>;
  editable: boolean;
  comments: BlockCommentMap;
  density: 'executive' | 'operator' | 'expert';
}

function CollabSection({ section, collab, editable, comments }: CollabSectionProps) {
  return (
    <div style={{ borderRadius: '0.5rem', border: '1px solid #f1f5f9', padding: '1rem' }}>
      {section.title && (
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
          {section.title}
        </h3>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {section.blocks.map((block, idx) => (
          <CollabBlock
            key={idx}
            block={block}
            blockIndex={idx}
            sectionId={section.id}
            totalBlocks={section.blocks.length}
            collab={collab}
            editable={editable}
            blockComments={(comments[section.id]?.[idx]) ?? []}
          />
        ))}
        {editable && (
          <InsertBlockButton
            onInsert={(block) => collab.insertBlock(section.id, section.blocks.length - 1, block)}
          />
        )}
      </div>
    </div>
  );
}

// ── Block ─────────────────────────────────────────────────────────────────────

interface CollabBlockProps {
  block: DocumentBlock;
  blockIndex: number;
  sectionId: string;
  totalBlocks: number;
  collab: ReturnType<typeof useDocumentCollaboration>;
  editable: boolean;
  blockComments: import('@hari/core').BlockComment[];
}

function CollabBlock({
  block,
  blockIndex,
  sectionId,
  totalBlocks,
  collab,
  editable,
  blockComments,
}: CollabBlockProps) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');

  const focusKey = `${sectionId}:${blockIndex}`;
  const focusedBy = collab.focusedBlocks[focusKey];
  const isPending = collab.pendingOps.some(
    (op) =>
      op.op.type !== 'block_move' &&
      'sectionId' in op.op &&
      op.op.sectionId === sectionId &&
      'blockIndex' in op.op &&
      op.op.blockIndex === blockIndex,
  );

  const handleFocus = useCallback(() => {
    if (editable) collab.focusBlock(sectionId, blockIndex);
  }, [editable, collab, sectionId, blockIndex]);

  const handleBlur = useCallback(() => {
    if (editable) collab.blurBlock();
    setEditing(false);
  }, [editable, collab]);

  const openedComments = blockComments.filter((c) => !c.resolved);
  const resolvedComments = blockComments.filter((c) => c.resolved);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={handleFocus}
      style={{ position: 'relative' }}
    >
      {/* Collaborator focus indicator */}
      {focusedBy && (
        <div style={{
          position: 'absolute',
          top: -2,
          left: -2,
          right: -2,
          bottom: -2,
          borderRadius: '0.25rem',
          border: `2px solid ${focusedBy.authorColor}`,
          pointerEvents: 'none',
          zIndex: 1,
        }}>
          <CollabAvatar
            info={focusedBy}
            size={18}
            style={{ position: 'absolute', top: -10, right: -10 }}
          />
        </div>
      )}

      {/* Pending indicator */}
      {isPending && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: -4,
          width: 3,
          bottom: 0,
          backgroundColor: '#f59e0b',
          borderRadius: '2px',
          zIndex: 2,
        }} title="Syncing…" />
      )}

      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem',
        borderRadius: '0.375rem',
        padding: '0.375rem 0.5rem',
        backgroundColor: editing ? '#fffbeb' : hovered ? '#f8fafc' : 'transparent',
        transition: 'background-color 0.15s',
      }}>
        {/* Block content — either editor or rendered */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing && editable ? (
            <BlockEditor
              block={block}
              onSave={(newBlock) => {
                collab.editBlock(sectionId, blockIndex, newBlock);
                setEditing(false);
              }}
              onCancel={() => {
                setEditing(false);
                handleBlur();
              }}
            />
          ) : (
            <BlockPreview
              block={block}
              onDoubleClick={() => { if (editable) { setEditing(true); handleFocus(); } }}
            />
          )}
        </div>

        {/* Block toolbar (visible on hover when editable) */}
        {editable && hovered && !editing && (
          <BlockToolbar
            blockIndex={blockIndex}
            totalBlocks={totalBlocks}
            commentCount={openedComments.length}
            onEdit={() => setEditing(true)}
            onDelete={() => collab.deleteBlock(sectionId, blockIndex)}
            onMoveUp={() => blockIndex > 0 && collab.moveBlock(sectionId, blockIndex, blockIndex - 1)}
            onMoveDown={() => blockIndex < totalBlocks - 1 && collab.moveBlock(sectionId, blockIndex, blockIndex + 1)}
            onToggleComments={() => setShowComments((v) => !v)}
          />
        )}
      </div>

      {/* Comments */}
      {(showComments || openedComments.length > 0) && (
        <div style={{
          marginTop: '0.25rem',
          marginLeft: '1rem',
          borderLeft: '2px solid #e0e7ff',
          paddingLeft: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.375rem',
        }}>
          {openedComments.map((c) => (
            <CommentThread
              key={c.commentId}
              comment={c}
              onResolve={() => collab.resolveComment(sectionId, blockIndex, c.commentId)}
              editable={editable}
            />
          ))}
          {resolvedComments.length > 0 && (
            <details style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
              <summary style={{ cursor: 'pointer' }}>
                {resolvedComments.length} resolved
              </summary>
              {resolvedComments.map((c) => (
                <CommentThread
                  key={c.commentId}
                  comment={c}
                  onResolve={() => {}}
                  editable={false}
                />
              ))}
            </details>
          )}
          {editable && showComments && (
            <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.25rem' }}>
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newComment.trim()) {
                    collab.addComment(sectionId, blockIndex, newComment.trim());
                    setNewComment('');
                  }
                }}
                placeholder="Add a comment… (Enter to submit)"
                aria-label="New comment"
                style={{
                  flex: 1,
                  fontSize: '0.75rem',
                  padding: '0.3rem 0.5rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.25rem',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (newComment.trim()) {
                    collab.addComment(sectionId, blockIndex, newComment.trim());
                    setNewComment('');
                  }
                }}
                style={{
                  fontSize: '0.7rem',
                  padding: '0.3rem 0.5rem',
                  backgroundColor: '#4f46e5',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.25rem',
                  cursor: 'pointer',
                }}
              >
                Post
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Block preview (read mode) ─────────────────────────────────────────────────

function BlockPreview({
  block,
  onDoubleClick,
}: {
  block: DocumentBlock;
  onDoubleClick?: () => void;
}) {
  const baseStyle: React.CSSProperties = {
    margin: 0,
    cursor: onDoubleClick ? 'pointer' : 'default',
  };

  switch (block.type) {
    case 'heading': {
      const Tag = `h${block.level}` as keyof JSX.IntrinsicElements;
      const fs = block.level === 1 ? '1.3rem'
        : block.level === 2 ? '1.1rem'
        : block.level === 3 ? '0.95rem'
        : '0.85rem';
      return (
        <Tag
          onDoubleClick={onDoubleClick}
          title={onDoubleClick ? 'Double-click to edit' : undefined}
          style={{ ...baseStyle, fontSize: fs, fontWeight: 700, color: '#0f172a' }}
        >
          {block.text}
        </Tag>
      );
    }
    case 'paragraph':
      return (
        <p
          onDoubleClick={onDoubleClick}
          title={onDoubleClick ? 'Double-click to edit' : undefined}
          style={{ ...baseStyle, fontSize: '0.875rem', color: '#334155', lineHeight: 1.6 }}
        >
          {block.text}
        </p>
      );
    case 'callout':
      return (
        <div
          onDoubleClick={onDoubleClick}
          title={onDoubleClick ? 'Double-click to edit' : undefined}
          style={{
            ...baseStyle,
            padding: '0.5rem 0.75rem',
            borderRadius: '0.375rem',
            borderLeft: `4px solid ${
              block.variant === 'critical' ? '#ef4444'
              : block.variant === 'warning' ? '#f59e0b'
              : block.variant === 'insight' ? '#8b5cf6'
              : '#3b82f6'
            }`,
            backgroundColor:
              block.variant === 'critical' ? '#fef2f2'
              : block.variant === 'warning' ? '#fffbeb'
              : block.variant === 'insight' ? '#f5f3ff'
              : '#eff6ff',
            fontSize: '0.825rem',
            color: '#1e293b',
          }}
        >
          {block.title && <strong>{block.title}: </strong>}
          {block.text}
        </div>
      );
    case 'list':
      return (
        <ul
          onDoubleClick={onDoubleClick}
          style={{ ...baseStyle, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#334155' }}
        >
          {block.items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      );
    case 'code':
      return (
        <pre
          onDoubleClick={onDoubleClick}
          title={onDoubleClick ? 'Double-click to edit' : undefined}
          style={{
            ...baseStyle,
            fontSize: '0.8rem',
            backgroundColor: '#1e293b',
            color: '#e2e8f0',
            padding: '0.75rem',
            borderRadius: '0.375rem',
            overflowX: 'auto',
          }}
        >
          <code>{block.code}</code>
        </pre>
      );
    case 'metric':
      return (
        <div onDoubleClick={onDoubleClick} style={{ ...baseStyle, display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{block.label}</span>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{block.value}</span>
          {block.unit && <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{block.unit}</span>}
          {block.trend && (
            <span style={{ fontSize: '0.75rem', color: block.trend === 'up' ? '#16a34a' : block.trend === 'down' ? '#dc2626' : '#64748b' }}>
              {block.trend === 'up' ? '↑' : block.trend === 'down' ? '↓' : '→'}
            </span>
          )}
        </div>
      );
    case 'divider':
      return <hr onDoubleClick={onDoubleClick} style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.25rem 0' }} />;
    case 'quote':
      return (
        <blockquote
          onDoubleClick={onDoubleClick}
          style={{ ...baseStyle, borderLeft: '3px solid #c7d2fe', paddingLeft: '0.75rem', color: '#475569', fontStyle: 'italic', fontSize: '0.875rem' }}
        >
          {block.text}
          {block.author && <footer style={{ marginTop: '0.25rem', fontSize: '0.75rem', fontStyle: 'normal', color: '#64748b' }}>— {block.author}</footer>}
        </blockquote>
      );
    default:
      return (
        <div
          onDoubleClick={onDoubleClick}
          style={{ ...baseStyle, fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}
        >
          [{block.type} block — double-click to edit]
        </div>
      );
  }
}

// ── Block editor ──────────────────────────────────────────────────────────────

function BlockEditor({
  block,
  onSave,
  onCancel,
}: {
  block: DocumentBlock;
  onSave: (b: DocumentBlock) => void;
  onCancel: () => void;
}) {
  // Only support text-based blocks inline; others get a JSON fallback
  const [text, setText] = useState(() => {
    if (block.type === 'paragraph') return block.text;
    if (block.type === 'heading') return block.text;
    if (block.type === 'callout') return block.text;
    if (block.type === 'code') return block.code;
    return JSON.stringify(block, null, 2);
  });

  const [isJson] = useState(
    !['paragraph', 'heading', 'callout', 'code', 'list'].includes(block.type),
  );

  const [listItems, setListItems] = useState<string[]>(
    block.type === 'list' ? [...block.items] : [],
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { textareaRef.current?.focus(); }, []);

  const handleSave = () => {
    if (isJson) {
      try {
        onSave(JSON.parse(text) as DocumentBlock);
      } catch {
        alert('Invalid JSON');
      }
      return;
    }
    if (block.type === 'paragraph') onSave({ ...block, text });
    else if (block.type === 'heading') onSave({ ...block, text });
    else if (block.type === 'callout') onSave({ ...block, text });
    else if (block.type === 'code') onSave({ ...block, code: text });
    else if (block.type === 'list') onSave({ ...block, items: listItems.filter(Boolean) });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
  };

  if (block.type === 'list') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {listItems.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.25rem' }}>
            <input
              value={item}
              onChange={(e) => {
                const next = [...listItems];
                next[i] = e.target.value;
                setListItems(next);
              }}
              style={{ flex: 1, fontSize: '0.875rem', padding: '0.25rem 0.375rem', border: '1px solid #93c5fd', borderRadius: '0.25rem' }}
            />
            <button type="button" onClick={() => setListItems((prev) => prev.filter((_, j) => j !== i))} style={{ fontSize: '0.7rem', color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}>✕</button>
          </div>
        ))}
        <button type="button" onClick={() => setListItems((prev) => [...prev, ''])} style={{ fontSize: '0.75rem', color: '#4f46e5', border: 'none', background: 'none', cursor: 'pointer', alignSelf: 'flex-start' }}>+ Add item</button>
        <EditorActions onSave={handleSave} onCancel={onCancel} />
      </div>
    );
  }

  return (
    <div>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={isJson ? 6 : 3}
        style={{
          width: '100%',
          fontSize: isJson ? '0.75rem' : '0.875rem',
          fontFamily: isJson ? 'monospace' : 'inherit',
          padding: '0.375rem 0.5rem',
          border: '1px solid #93c5fd',
          borderRadius: '0.25rem',
          resize: 'vertical',
          lineHeight: 1.5,
          outline: 'none',
        }}
        aria-label="Edit block content"
        placeholder={isJson ? 'JSON block definition…' : 'Block content…'}
      />
      <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
        {isJson ? 'Edit raw JSON' : 'Ctrl/⌘+Enter to save, Esc to cancel'}
      </div>
      <EditorActions onSave={handleSave} onCancel={onCancel} />
    </div>
  );
}

function EditorActions({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <div style={{ display: 'flex', gap: '0.375rem' }}>
      <button
        type="button"
        onClick={onSave}
        style={{ fontSize: '0.75rem', padding: '0.2rem 0.625rem', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}
      >
        Save
      </button>
      <button
        type="button"
        onClick={onCancel}
        style={{ fontSize: '0.75rem', padding: '0.2rem 0.625rem', backgroundColor: 'white', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '0.25rem', cursor: 'pointer' }}
      >
        Cancel
      </button>
    </div>
  );
}

// ── Block toolbar ─────────────────────────────────────────────────────────────

interface BlockToolbarProps {
  blockIndex: number;
  totalBlocks: number;
  commentCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleComments: () => void;
}

function BlockToolbar({
  blockIndex,
  totalBlocks,
  commentCount,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onToggleComments,
}: BlockToolbarProps) {
  const btn: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '1.5rem',
    height: '1.5rem',
    fontSize: '0.7rem',
    border: '1px solid #e2e8f0',
    borderRadius: '0.25rem',
    backgroundColor: 'white',
    cursor: 'pointer',
    color: '#475569',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flexShrink: 0 }}>
      <button type="button" onClick={onEdit} style={btn} title="Edit block" aria-label="Edit block">✏️</button>
      <button type="button" onClick={onMoveUp} disabled={blockIndex === 0} style={{ ...btn, opacity: blockIndex === 0 ? 0.3 : 1 }} title="Move up" aria-label="Move block up">↑</button>
      <button type="button" onClick={onMoveDown} disabled={blockIndex === totalBlocks - 1} style={{ ...btn, opacity: blockIndex === totalBlocks - 1 ? 0.3 : 1 }} title="Move down" aria-label="Move block down">↓</button>
      <button type="button" onClick={onToggleComments} style={{ ...btn, position: 'relative' }} title="Comments" aria-label="Toggle comments">
        💬
        {commentCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            width: '0.9rem', height: '0.9rem', borderRadius: '50%',
            backgroundColor: '#4f46e5', color: 'white',
            fontSize: '0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {commentCount}
          </span>
        )}
      </button>
      <button type="button" onClick={onDelete} style={{ ...btn, color: '#ef4444', borderColor: '#fca5a5' }} title="Delete block" aria-label="Delete block">🗑</button>
    </div>
  );
}

// ── Insert block button ────────────────────────────────────────────────────────

function InsertBlockButton({ onInsert }: { onInsert: (block: DocumentBlock) => void }) {
  const [open, setOpen] = useState(false);

  const insertTypes: Array<{ label: string; block: DocumentBlock }> = [
    { label: '¶ Paragraph', block: { type: 'paragraph', text: 'New paragraph…' } },
    { label: 'H Heading', block: { type: 'heading', level: 3, text: 'New Heading' } },
    { label: '• List', block: { type: 'list', items: ['Item 1', 'Item 2'], ordered: false } },
    { label: '</> Code', block: { type: 'code', code: '// code here', language: 'typescript' } },
    { label: '⚠ Callout', block: { type: 'callout', variant: 'info', text: 'Note…' } },
    { label: '— Divider', block: { type: 'divider' } },
  ];

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Insert new block"
        style={{
          width: '100%',
          fontSize: '0.72rem',
          padding: '0.25rem',
          border: '1px dashed #c7d2fe',
          borderRadius: '0.25rem',
          backgroundColor: 'transparent',
          color: '#6366f1',
          cursor: 'pointer',
        }}
      >
        + Insert block
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: 0,
          right: 0,
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '0.375rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          padding: '0.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.25rem',
          zIndex: 10,
        }}>
          {insertTypes.map(({ label, block }) => (
            <button
              key={label}
              type="button"
              onClick={() => { onInsert(block); setOpen(false); }}
              style={{
                fontSize: '0.7rem',
                padding: '0.25rem 0.5rem',
                border: '1px solid #e2e8f0',
                borderRadius: '0.25rem',
                backgroundColor: '#f8fafc',
                cursor: 'pointer',
                color: '#334155',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Comment thread ────────────────────────────────────────────────────────────

function CommentThread({
  comment,
  onResolve,
  editable,
}: {
  comment: import('@hari/core').BlockComment;
  onResolve: () => void;
  editable: boolean;
}) {
  return (
    <div style={{
      fontSize: '0.75rem',
      backgroundColor: comment.resolved ? '#f8fafc' : 'white',
      border: `1px solid ${comment.resolved ? '#e2e8f0' : '#c7d2fe'}`,
      borderRadius: '0.25rem',
      padding: '0.375rem 0.5rem',
      opacity: comment.resolved ? 0.65 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.2rem' }}>
        <div style={{
          width: '1rem', height: '1rem', borderRadius: '50%',
          backgroundColor: comment.authorColor,
          flexShrink: 0,
        }} />
        <span style={{ fontWeight: 600, color: '#334155' }}>{comment.authorName}</span>
        <span style={{ color: '#94a3b8', marginLeft: 'auto', fontSize: '0.65rem' }}>
          {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        {!comment.resolved && editable && (
          <button
            type="button"
            onClick={onResolve}
            title="Resolve comment"
            aria-label="Resolve comment"
            style={{ fontSize: '0.65rem', color: '#16a34a', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
          >
            ✓ Resolve
          </button>
        )}
        {comment.resolved && (
          <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Resolved</span>
        )}
      </div>
      <p style={{ margin: 0, color: '#475569' }}>{comment.text}</p>
    </div>
  );
}

// ── Collaborator avatar ───────────────────────────────────────────────────────

function CollabAvatar({
  info,
  size = 24,
  style: extraStyle,
}: {
  info: CollaboratorPresenceInfo;
  size?: number;
  style?: React.CSSProperties;
}) {
  const initials = info.authorName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      title={`${info.authorName} (${info.authorId})`}
      aria-label={`Collaborator: ${info.authorName}`}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: info.authorColor,
        border: '2px solid white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.38,
        fontWeight: 700,
        color: 'white',
        flexShrink: 0,
        ...extraStyle,
      }}
    >
      {initials}
    </div>
  );
}

// Re-export transport factory for convenience
export { createBroadcastTransport };
