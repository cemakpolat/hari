// ─────────────────────────────────────────────────────────────────────────────
// DocumentRenderer — Renders a 'document' intent type.
//
// Accepts the IntentPayload.data field (typed as DocumentData) and renders
// rich structured content: headings, paragraphs, lists, code, callouts, and
// KPI metrics.
//
// AI-confidence indicators:
//   - Section confidence < 0.7  → low-confidence badge on section header
//   - Paragraph confidence       → subtle left-border colour
//   - Confidence badges are hidden when the 'show-confidence' ambiguity is false
//     (consumers should pass showConfidence={false} in that case)
//
// Usage (via registry):
//   registry.register('reports', 'document', { default: () => DocumentWrapper });
//   where DocumentWrapper reads data.showConfidence from ambiguity controls.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { DocumentDataSchema } from '@hari/core';
import type { DocumentBlock, DocumentSection } from '@hari/core';

// ── Public props ─────────────────────────────────────────────────────────────

export interface DocumentRendererProps {
  /** Raw data from IntentPayload.data — validated internally. */
  data: unknown;
  density?: 'executive' | 'operator' | 'expert';
  onExplain?: (elementId: string) => void;
  /** Control whether per-paragraph/section confidence indicators are shown. */
  showConfidence?: boolean;
}

// ── Callout palette ───────────────────────────────────────────────────────────

const CALLOUT_STYLES: Record<
  'info' | 'warning' | 'insight' | 'critical',
  { bg: string; border: string; icon: string; label: string; labelColor: string }
> = {
  info:     { bg: '#eff6ff', border: '#93c5fd', icon: 'ℹ',  label: 'Note',     labelColor: '#1d4ed8' },
  warning:  { bg: '#fffbeb', border: '#fcd34d', icon: '⚠',  label: 'Warning',  labelColor: '#92400e' },
  insight:  { bg: '#f0fdf4', border: '#86efac', icon: '✦',  label: 'Insight',  labelColor: '#166534' },
  critical: { bg: '#fef2f2', border: '#fca5a5', icon: '✕',  label: 'Critical', labelColor: '#991b1b' },
};

// ── Confidence helpers ────────────────────────────────────────────────────────

function confidenceColor(c: number): string {
  if (c >= 0.85) return '#22c55e';
  if (c >= 0.70) return '#f59e0b';
  return '#ef4444';
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = confidenceColor(confidence);
  return (
    <span style={{
      fontSize: '0.6rem', fontWeight: 700, color, border: `1px solid ${color}`,
      borderRadius: '0.25rem', padding: '0.1rem 0.3rem', marginLeft: '0.5rem',
      verticalAlign: 'middle', opacity: 0.85,
    }}>
      {pct}% AI
    </span>
  );
}

// ── Trend indicator ───────────────────────────────────────────────────────────

function TrendArrow({ trend }: { trend?: 'up' | 'down' | 'stable' }) {
  if (!trend) return null;
  const cfg = {
    up:     { arrow: '↑', color: '#ef4444' }, // up is usually bad for error metrics
    down:   { arrow: '↓', color: '#22c55e' },
    stable: { arrow: '→', color: '#94a3b8' },
  };
  const { arrow, color } = cfg[trend];
  return <span style={{ color, fontWeight: 700, marginLeft: '0.25rem' }}>{arrow}</span>;
}

// ── Block renderers ───────────────────────────────────────────────────────────

function renderBlock(
  block: DocumentBlock,
  key: number,
  showConfidence: boolean,
): React.ReactNode {
  switch (block.type) {
    case 'heading':
      return (
        <HeadingBlock key={key} level={block.level} text={block.text} />
      );

    case 'paragraph':
      return (
        <ParagraphBlock
          key={key}
          text={block.text}
          confidence={block.confidence}
          showConfidence={showConfidence}
        />
      );

    case 'list':
      return <ListBlock key={key} items={block.items} ordered={block.ordered} />;

    case 'code':
      return <CodeBlock key={key} code={block.code} language={block.language} />;

    case 'callout':
      return (
        <CalloutBlock
          key={key}
          variant={block.variant}
          title={block.title}
          text={block.text}
        />
      );

    case 'metric':
      return (
        <MetricBlock
          key={key}
          label={block.label}
          value={block.value}
          trend={block.trend}
          delta={block.delta}
          unit={block.unit}
        />
      );

    case 'divider':
      return (
        <hr key={key} style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.5rem 0' }} />
      );

    case 'table':
      return <TableBlock key={key} headers={block.headers} rows={block.rows} caption={block.caption} />;

    case 'image':
      return <ImageBlock key={key} src={block.src} alt={block.alt} caption={block.caption} width={block.width} />;

    case 'quote':
      return <QuoteBlock key={key} text={block.text} author={block.author} source={block.source} />;

    case 'dataviz':
      return <DataVizBlock key={key} chartType={block.chartType} title={block.title} data={block.data} config={block.config} />;

    case 'embed':
      return <EmbedBlock key={key} url={block.url} fallbackText={block.fallbackText} height={block.height} />;
  }
}

function HeadingBlock({ level, text }: { level: number; text: string }) {
  const sizes: Record<number, string> = {
    1: '1.25rem', 2: '1.125rem', 3: '1rem', 4: '0.9rem', 5: '0.85rem', 6: '0.8rem',
  };
  return (
    <div style={{
      fontSize: sizes[level] ?? '1rem',
      fontWeight: level <= 2 ? 700 : 600,
      color: '#1e293b',
      marginTop: level <= 2 ? '1rem' : '0.5rem',
      marginBottom: '0.25rem',
    }}>
      {text}
    </div>
  );
}

function ParagraphBlock({
  text, confidence, showConfidence,
}: {
  text: string; confidence?: number; showConfidence: boolean;
}) {
  const lowConf = confidence !== undefined && confidence < 0.70;
  return (
    <p style={{
      margin: '0.25rem 0',
      fontSize: '0.8rem',
      color: '#374151',
      lineHeight: '1.65',
      borderLeft: confidence !== undefined && showConfidence
        ? `3px solid ${confidenceColor(confidence)}`
        : undefined,
      paddingLeft: confidence !== undefined && showConfidence ? '0.625rem' : undefined,
      opacity: lowConf ? 0.85 : 1,
    }}>
      {text}
      {confidence !== undefined && showConfidence && (
        <ConfidenceBadge confidence={confidence} />
      )}
    </p>
  );
}

function ListBlock({ items, ordered }: { items: string[]; ordered: boolean }) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag style={{ margin: '0.25rem 0', paddingLeft: '1.5rem' }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: '0.8rem', color: '#374151', lineHeight: '1.65', marginBottom: '0.2rem' }}>
          {item}
        </li>
      ))}
    </Tag>
  );
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  return (
    <div style={{ margin: '0.5rem 0' }}>
      {language && (
        <div style={{
          fontSize: '0.62rem', fontWeight: 600, color: '#6366f1',
          backgroundColor: '#f1f5f9', borderRadius: '0.375rem 0.375rem 0 0',
          padding: '0.2rem 0.75rem', border: '1px solid #e2e8f0', borderBottom: 'none',
          display: 'inline-block',
        }}>
          {language}
        </div>
      )}
      <pre style={{
        margin: 0,
        padding: '0.75rem',
        backgroundColor: '#0f172a',
        borderRadius: language ? '0 0.375rem 0.375rem 0.375rem' : '0.375rem',
        border: '1px solid #1e293b',
        fontSize: '0.72rem',
        color: '#e2e8f0',
        overflowX: 'auto',
        lineHeight: 1.6,
        whiteSpace: 'pre',
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function CalloutBlock({
  variant, title, text,
}: {
  variant: 'info' | 'warning' | 'insight' | 'critical';
  title?: string;
  text: string;
}) {
  const style = CALLOUT_STYLES[variant];
  return (
    <div style={{
      margin: '0.5rem 0',
      padding: '0.625rem 0.875rem',
      backgroundColor: style.bg,
      border: `1px solid ${style.border}`,
      borderLeft: `3px solid ${style.border}`,
      borderRadius: '0.375rem',
    }}>
      <div style={{
        fontSize: '0.68rem',
        fontWeight: 700,
        color: style.labelColor,
        marginBottom: title || text ? '0.25rem' : 0,
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
      }}>
        <span>{style.icon}</span>
        <span>{title ?? style.label}</span>
      </div>
      {text && (
        <p style={{ margin: 0, fontSize: '0.78rem', color: '#374151', lineHeight: 1.6 }}>
          {text}
        </p>
      )}
    </div>
  );
}

function MetricBlock({
  label, value, trend, delta, unit,
}: {
  label: string; value: string; trend?: 'up' | 'down' | 'stable'; delta?: string; unit?: string;
}) {
  return (
    <div style={{
      display: 'inline-flex',
      flexDirection: 'column',
      gap: '0.1rem',
      backgroundColor: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '0.375rem',
      padding: '0.5rem 0.75rem',
      marginRight: '0.5rem',
      marginBottom: '0.5rem',
      minWidth: '120px',
    }}>
      <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
        {unit && <span style={{ fontWeight: 400 }}> ({unit})</span>}
      </div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
        {value}
        <TrendArrow trend={trend} />
      </div>
      {delta && (
        <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{delta}</div>
      )}
    </div>
  );
}

function TableBlock({
  headers, rows, caption,
}: {
  headers: Array<{ key: string; label: string; align?: 'left' | 'center' | 'right' }>;
  rows: Array<Record<string, unknown>>;
  caption?: string;
}) {
  return (
    <div style={{ margin: '0.75rem 0', overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '0.75rem',
        border: '1px solid #e2e8f0',
        borderRadius: '0.375rem',
      }}>
        <thead>
          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
            {headers.map((h) => (
              <th key={h.key} style={{
                padding: '0.5rem 0.75rem',
                textAlign: h.align ?? 'left',
                fontWeight: 600,
                color: '#475569',
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
              {headers.map((h) => (
                <td key={h.key} style={{
                  padding: '0.5rem 0.75rem',
                  textAlign: h.align ?? 'left',
                  color: '#374151',
                }}>
                  {String(row[h.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {caption && (
        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.375rem', textAlign: 'center', fontStyle: 'italic' }}>
          {caption}
        </div>
      )}
    </div>
  );
}

function ImageBlock({
  src, alt, caption, width,
}: {
  src: string;
  alt: string;
  caption?: string;
  width?: number | string;
}) {
  return (
    <div style={{ margin: '0.75rem 0', textAlign: 'center' }}>
      <img
        src={src}
        alt={alt}
        style={{
          maxWidth: '100%',
          width: width ?? 'auto',
          borderRadius: '0.5rem',
          border: '1px solid #e2e8f0',
        }}
      />
      {caption && (
        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.375rem', fontStyle: 'italic' }}>
          {caption}
        </div>
      )}
    </div>
  );
}

function QuoteBlock({
  text, author, source,
}: {
  text: string;
  author?: string;
  source?: string;
}) {
  return (
    <blockquote style={{
      margin: '0.75rem 0',
      padding: '0.75rem 1rem',
      borderLeft: '4px solid #6366f1',
      backgroundColor: '#f8fafc',
      fontStyle: 'italic',
      color: '#475569',
      fontSize: '0.85rem',
      lineHeight: 1.65,
    }}>
      <p style={{ margin: '0 0 0.5rem 0' }}>{text}</p>
      {(author || source) && (
        <footer style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'normal' }}>
          {author && <span>— {author}</span>}
          {author && source && <span>, </span>}
          {source && <cite>{source}</cite>}
        </footer>
      )}
    </blockquote>
  );
}

function DataVizBlock({
  chartType, title, data, config,
}: {
  chartType: 'line' | 'bar' | 'pie' | 'scatter' | 'area' | 'sparkline';
  title?: string;
  data: Array<{ x: string | number; y: number; label?: string }>;
  config?: Record<string, unknown>;
}) {
  // Simple sparkline implementation for now
  if (chartType === 'sparkline') {
    const values = data.map(d => d.y);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    return (
      <div style={{ margin: '0.5rem 0', display: 'inline-flex', alignItems: 'flex-end', gap: '1px', height: '24px' }}>
        {values.map((v, i) => {
          const height = ((v - min) / range) * 20 + 4;
          return (
            <div key={i} style={{
              width: '3px',
              height: `${height}px`,
              backgroundColor: '#6366f1',
              borderRadius: '1px',
            }} />
          );
        })}
      </div>
    );
  }

  // Placeholder for other chart types
  return (
    <div style={{
      margin: '0.75rem 0',
      padding: '1rem',
      backgroundColor: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '0.5rem',
      textAlign: 'center',
    }}>
      {title && <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.8rem' }}>{title}</div>}
      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
        [{chartType} chart with {data.length} data points]
      </div>
      <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.25rem' }}>
        Charting library integration required
      </div>
    </div>
  );
}

function EmbedBlock({
  url, fallbackText, height,
}: {
  url: string;
  fallbackText?: string;
  height?: number | string;
}) {
  return (
    <div style={{ margin: '0.75rem 0' }}>
      <iframe
        src={url}
        style={{
          width: '100%',
          height: height ?? 400,
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
        }}
        title="Embedded content"
      />
      {fallbackText && (
        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.375rem', textAlign: 'center' }}>
          {fallbackText}
        </div>
      )}
    </div>
  );
}

// ── Section renderer ──────────────────────────────────────────────────────────

function SectionBlock({
  section, showConfidence, onExplain, density,
}: {
  section: DocumentSection;
  showConfidence: boolean;
  onExplain?: (id: string) => void;
  density: 'executive' | 'operator' | 'expert';
}) {
  const lowConf = section.confidence !== undefined && section.confidence < 0.70;

  // In executive density, skip sections without titles (decorative dividers etc.)
  if (density === 'executive' && !section.title && section.blocks.every((b) => b.type === 'divider')) {
    return null;
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      {section.title && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          marginBottom: '0.5rem',
          borderBottom: '1px solid #f1f5f9',
          paddingBottom: '0.25rem',
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '0.875rem',
            fontWeight: 700,
            color: '#1e293b',
          }}>
            {section.title}
          </h3>
          {section.confidence !== undefined && showConfidence && (
            <ConfidenceBadge confidence={section.confidence} />
          )}
          {lowConf && showConfidence && (
            <span style={{ fontSize: '0.6rem', color: '#f59e0b', fontWeight: 700 }}>LOW CONFIDENCE</span>
          )}
          {section.explainElementId && onExplain && (
            <button
              onClick={() => onExplain(section.explainElementId!)}
              aria-label={`Explain ${section.title}`}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: '1px solid #e2e8f0',
                borderRadius: '0.25rem',
                padding: '0.125rem 0.375rem',
                fontSize: '0.62rem',
                color: '#6366f1',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Explain ↗
            </button>
          )}
        </div>
      )}
      <div>
        {section.blocks.map((block, i) => renderBlock(block, i, showConfidence))}
      </div>
    </div>
  );
}

// ── Top-level component ───────────────────────────────────────────────────────

export function DocumentRenderer({
  data,
  density = 'operator',
  onExplain,
  showConfidence = true,
}: DocumentRendererProps) {
  const result = DocumentDataSchema.safeParse(data);

  if (!result.success) {
    return (
      <div style={{ color: '#dc2626', fontSize: '0.8rem', padding: '1rem', fontFamily: 'monospace' }}>
        <strong>DocumentRenderer:</strong> invalid data shape.
        <pre style={{ marginTop: '0.5rem', fontSize: '0.7rem' }}>
          {JSON.stringify(result.error.flatten(), null, 2)}
        </pre>
      </div>
    );
  }

  const doc = result.data;

  // In executive density show only summary + exec-summary section.
  const visibleSections =
    density === 'executive'
      ? doc.sections.filter((s) => s.id === 'exec-summary' || !s.title)
      : doc.sections;

  return (
    <div>
      {/* Document header */}
      <div style={{
        marginBottom: '1rem',
        paddingBottom: '0.75rem',
        borderBottom: '2px solid #e2e8f0',
      }}>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
          {doc.title}
        </h2>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.68rem', color: '#64748b', flexWrap: 'wrap' }}>
          {doc.author && <span>By {doc.author}</span>}
          {doc.publishedAt && (
            <span>{new Date(doc.publishedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
          )}
          {doc.revision && <span>Rev {doc.revision}</span>}
        </div>
      </div>

      {/* Executive summary prose (if provided and not already a section) */}
      {doc.summary && density !== 'expert' && (
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          fontSize: '0.8rem',
          color: '#374151',
          lineHeight: 1.65,
          fontStyle: 'italic',
        }}>
          {doc.summary}
        </div>
      )}

      {/* Sections */}
      {visibleSections.map((section) => (
        <SectionBlock
          key={section.id}
          section={section}
          showConfidence={showConfidence}
          onExplain={onExplain}
          density={density}
        />
      ))}
    </div>
  );
}
