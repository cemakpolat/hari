import React from 'react';
import { KanbanDataSchema, type KanbanCard, type KanbanPriority } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// KanbanRenderer — renders a task board with columns and cards.
// ─────────────────────────────────────────────────────────────────────────────

export interface KanbanRendererProps {
  data: unknown;
  density?: 'executive' | 'operator' | 'expert';
  onExplain?: (elementId: string) => void;
  /** Called when the user clicks a card. */
  onCardClick?: (cardId: string, columnId: string) => void;
}

// ── Priority styling ──────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<
  KanbanPriority,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  critical: { label: 'Critical', bg: '#fef2f2', text: '#991b1b', border: '#fca5a5', dot: '#ef4444' },
  high:     { label: 'High',     bg: '#fff7ed', text: '#9a3412', border: '#fdba74', dot: '#f97316' },
  medium:   { label: 'Medium',   bg: '#fefce8', text: '#713f12', border: '#fde047', dot: '#eab308' },
  low:      { label: 'Low',      bg: '#f0fdf4', text: '#166534', border: '#86efac', dot: '#22c55e' },
};

// ── Tag colours (deterministic) ───────────────────────────────────────────

const TAG_COLORS = [
  { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  { bg: '#faf5ff', text: '#7c3aed', border: '#ddd6fe' },
  { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
];

function tagColor(tag: string, index: number) {
  return TAG_COLORS[index % TAG_COLORS.length];
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDueDate(iso: string): { label: string; overdue: boolean } {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { label: iso, overdue: false };
  const now = new Date();
  const overdue = d < now;
  const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return { label, overdue };
}

// ── Card component ────────────────────────────────────────────────────────

interface CardProps {
  card: KanbanCard;
  density: 'executive' | 'operator' | 'expert';
  onCardClick?: (cardId: string) => void;
  onExplain?: (elementId: string) => void;
}

function KanbanCardView({ card, density, onCardClick, onExplain }: CardProps) {
  const pCfg = card.priority ? PRIORITY_CONFIG[card.priority] : null;
  const due = card.dueDate ? formatDueDate(card.dueDate) : null;

  return (
    <div
      onClick={() => onCardClick?.(card.id)}
      style={{
        padding: density === 'executive' ? '0.3rem 0.5rem' : '0.6rem 0.75rem',
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderLeft: pCfg ? `3px solid ${pCfg.dot}` : '1px solid #e2e8f0',
        borderRadius: '0.375rem',
        cursor: onCardClick ? 'pointer' : 'default',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={(e) => { if (onCardClick) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.25rem' }}>
        <span style={{
          fontSize: density === 'executive' ? '0.72rem' : '0.78rem',
          fontWeight: 600, color: '#1e293b', lineHeight: 1.35, flex: 1,
        }}>
          {card.title}
        </span>
        {card.explainElementId && onExplain && (
          <button
            onClick={(e) => { e.stopPropagation(); onExplain(card.explainElementId!); }}
            aria-label={`Explain: ${card.title}`}
            style={{
              background: 'none', border: '1px solid #e2e8f0', borderRadius: '0.2rem',
              padding: '0 0.25rem', fontSize: '0.55rem', color: '#94a3b8', cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Why?
          </button>
        )}
      </div>

      {/* Description (operator+) */}
      {density !== 'executive' && card.description && (
        <p style={{
          margin: '0.25rem 0 0', fontSize: '0.7rem', color: '#64748b',
          lineHeight: 1.45, display: '-webkit-box',
          WebkitLineClamp: density === 'operator' ? 2 : undefined,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {card.description}
        </p>
      )}

      {/* Badges row */}
      {density !== 'executive' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.4rem', alignItems: 'center' }}>
          {pCfg && (
            <span style={{
              fontSize: '0.58rem', fontWeight: 700, padding: '0.1rem 0.35rem',
              backgroundColor: pCfg.bg, color: pCfg.text,
              border: `1px solid ${pCfg.border}`, borderRadius: '0.25rem',
            }}>
              {pCfg.label}
            </span>
          )}
          {card.assignee && (
            <span style={{
              fontSize: '0.6rem', color: '#64748b', fontWeight: 500,
              padding: '0.1rem 0.35rem',
              backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.25rem',
            }}>
              {card.assignee}
            </span>
          )}
          {due && (
            <span style={{
              fontSize: '0.6rem', color: due.overdue ? '#dc2626' : '#64748b',
              fontWeight: due.overdue ? 700 : 500,
            }}>
              {due.overdue ? '⚠ ' : ''}{due.label}
            </span>
          )}
        </div>
      )}

      {/* Tags */}
      {density !== 'executive' && card.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.3rem' }}>
          {card.tags.map((tag, i) => {
            const c = tagColor(tag, i);
            return (
              <span key={tag} style={{
                fontSize: '0.55rem', fontWeight: 600,
                padding: '0.05rem 0.3rem',
                backgroundColor: c.bg, color: c.text,
                border: `1px solid ${c.border}`, borderRadius: '9999px',
              }}>
                {tag}
              </span>
            );
          })}
        </div>
      )}

      {/* Expert: metadata */}
      {density === 'expert' && card.metadata && Object.keys(card.metadata).length > 0 && (
        <dl style={{
          display: 'grid', gridTemplateColumns: 'auto 1fr',
          gap: '0.1rem 0.5rem', margin: '0.4rem 0 0',
          fontSize: '0.62rem',
        }}>
          {Object.entries(card.metadata).map(([k, v]) => (
            <React.Fragment key={k}>
              <dt style={{ color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{k}</dt>
              <dd style={{ margin: 0, color: '#475569', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                {typeof v === 'object' ? JSON.stringify(v) : String(v)}
              </dd>
            </React.Fragment>
          ))}
        </dl>
      )}
    </div>
  );
}

// ── Top-level component ───────────────────────────────────────────────────

export function KanbanRenderer({
  data,
  density = 'operator',
  onExplain,
  onCardClick,
}: KanbanRendererProps) {
  const result = KanbanDataSchema.safeParse(data);

  if (!result.success) {
    return (
      <div style={{ color: '#dc2626', fontSize: '0.8rem', padding: '1rem', fontFamily: 'monospace' }}>
        <strong>KanbanRenderer:</strong> invalid data shape.
        <pre style={{ marginTop: '0.5rem', fontSize: '0.7rem' }}>
          {JSON.stringify(result.error.flatten(), null, 2)}
        </pre>
      </div>
    );
  }

  const board = result.data;

  // ── Executive: summary grid (column title + card count) ────────────────

  if (density === 'executive') {
    return (
      <div>
        {board.title && (
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', marginBottom: '0.75rem' }}>
            {board.title}
          </div>
        )}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${board.columns.length}, 1fr)`,
          gap: '0.5rem',
        }}>
          {board.columns.map((col) => {
            const over = col.wipLimit != null && col.cards.length > col.wipLimit;
            return (
              <div key={col.id} style={{
                padding: '0.5rem 0.75rem',
                border: '1px solid #e2e8f0', borderRadius: '0.375rem',
                borderTop: col.color ? `3px solid ${col.color}` : '3px solid #e2e8f0',
                backgroundColor: '#f8fafc',
              }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>
                  {col.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: over ? '#ef4444' : '#0f172a' }}>
                    {col.cards.length}
                  </span>
                  {col.wipLimit != null && board.showWipLimits && (
                    <span style={{ fontSize: '0.62rem', color: over ? '#ef4444' : '#94a3b8' }}>
                      / {col.wipLimit}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Operator / Expert: full board ──────────────────────────────────────

  return (
    <div>
      {board.title && (
        <h3 style={{
          margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a',
          paddingBottom: '0.5rem', borderBottom: '2px solid #e2e8f0',
        }}>
          {board.title}
        </h3>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${board.columns.length}, minmax(160px, 1fr))`,
        gap: '0.75rem',
        overflowX: 'auto',
      }}>
        {board.columns.map((col) => {
          const over = col.wipLimit != null && col.cards.length > col.wipLimit;
          return (
            <div key={col.id} style={{
              display: 'flex', flexDirection: 'column',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0', borderRadius: '0.5rem',
              overflow: 'hidden',
              minWidth: 0,
            }}>
              {/* Column header */}
              <div style={{
                padding: '0.5rem 0.75rem',
                borderBottom: `3px solid ${col.color ?? '#e2e8f0'}`,
                backgroundColor: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b' }}>
                  {col.title}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  {board.showCardCount && (
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700,
                      color: over ? '#ef4444' : '#64748b',
                    }}>
                      {col.cards.length}
                      {col.wipLimit != null && board.showWipLimits && (
                        <span style={{ fontWeight: 400 }}>/{col.wipLimit}</span>
                      )}
                    </span>
                  )}
                  {over && (
                    <span title="WIP limit exceeded" style={{ fontSize: '0.7rem' }}>⚠</span>
                  )}
                </div>
              </div>

              {/* Cards */}
              <div style={{
                padding: '0.5rem',
                display: 'flex', flexDirection: 'column', gap: '0.4rem',
                flex: 1,
              }}>
                {col.cards.map((card) => (
                  <KanbanCardView
                    key={card.id}
                    card={card}
                    density={density}
                    onCardClick={onCardClick ? (id) => onCardClick(id, col.id) : undefined}
                    onExplain={onExplain}
                  />
                ))}
                {col.cards.length === 0 && (
                  <div style={{
                    textAlign: 'center', padding: '1rem 0',
                    fontSize: '0.7rem', color: '#cbd5e1', fontStyle: 'italic',
                  }}>
                    Empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
