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

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DocumentDataSchema } from '@hari/core';
import type { DocumentBlock, DocumentSection, DocumentData, TableRowAction } from '@hari/core';

// ── Shimmer keyframe (injected once at module init) ─────────────────────────────────

let _shimmerInjected = false;
function ensureShimmerStyle() {
  if (_shimmerInjected || typeof document === 'undefined') return;
  _shimmerInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes hari-shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;
  document.head.appendChild(style);
}

// ── Block error boundary ───────────────────────────────────────────────────────

interface BlockErrorBoundaryState { hasError: boolean; message: string }

class BlockErrorBoundary extends React.Component<
  { blockType: string; children: React.ReactNode },
  BlockErrorBoundaryState
> {
  constructor(props: { blockType: string; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          margin: '0.5rem 0', padding: '0.5rem 0.75rem',
          backgroundColor: '#fef2f2', border: '1px solid #fca5a5',
          borderRadius: '0.375rem', fontSize: '0.72rem', color: '#991b1b',
        }}>
          Block render error [{this.props.blockType}]: {this.state.message}
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Public props ─────────────────────────────────────────────────────────────

export interface DocumentRendererProps {
  /** Raw data from IntentPayload.data — validated internally. */
  data: unknown;
  density?: 'executive' | 'operator' | 'expert';
  onExplain?: (elementId: string) => void;
  /** Control whether per-paragraph/section confidence indicators are shown. */
  showConfidence?: boolean;
  /** Show an auto-generated table of contents from section titles. */
  showToc?: boolean;
  /**
   * When provided, an "Export .md" button appears in the document header.
   * Called with the full Markdown representation of the document.
   */
  onExportMarkdown?: (markdown: string) => void;
  /**
   * When true, a "Print / Save as PDF" button appears in the document header.
   * Uses the browser's native window.print() — consumers should include a
   * print-specific stylesheet to control the printed output.
   */
  showPdfExport?: boolean;
  /** Show a search input that filters sections containing the query. */
  showSearch?: boolean;
  /**
   * Callback for table row action buttons.
   * Receives the action identifier, the zero-based row index, and the full row data.
   */
  onRowAction?: (action: string, rowIndex: number, row: Record<string, unknown>) => void;
}

// ── Markdown export ───────────────────────────────────────────────────────────

function blockToMarkdown(block: DocumentBlock): string {
  switch (block.type) {
    case 'heading': {
      const hashes = '#'.repeat(block.level ?? 2);
      return `${hashes} ${block.text}\n`;
    }
    case 'paragraph':
      return `${block.text}\n`;
    case 'list': {
      const items = block.items.map((item, i) =>
        block.ordered ? `${i + 1}. ${item}` : `- ${item}`
      );
      return items.join('\n') + '\n';
    }
    case 'code':
      return `\`\`\`${block.language ?? ''}\n${block.code}\n\`\`\`\n`;
    case 'callout':
      return `> **${block.variant.toUpperCase()}**: ${block.text}\n`;
    case 'metric':
      return `**${block.label}**: ${block.value}${block.unit ? ' ' + block.unit : ''}${block.trend ? ` (${block.trend})` : ''}\n`;
    case 'divider':
      return '---\n';
    case 'table': {
      const header = `| ${block.headers.map((h) => h.label).join(' | ')} |`;
      const sep = `| ${block.headers.map(() => '---').join(' | ')} |`;
      const rows = block.rows.map(
        (row) => `| ${block.headers.map((h) => String(row[h.key] ?? '')).join(' | ')} |`,
      );
      return [header, sep, ...rows].join('\n') + '\n';
    }
    case 'image':
      return `![${block.alt ?? ''}](${block.src})${block.caption ? `\n*${block.caption}*` : ''}\n`;
    case 'quote':
      return `> ${block.text}${block.author ? `\n>\n> — ${block.author}` : ''}\n`;
    case 'dataviz':
      return `*[Chart: ${block.chartType} — ${block.title ?? 'untitled'}]*\n`;
    default:
      return '';
  }
}

function docToMarkdown(doc: DocumentData): string {
  const lines: string[] = [];
  lines.push(`# ${doc.title}\n`);
  if (doc.author || doc.publishedAt) {
    const meta: string[] = [];
    if (doc.author) meta.push(`By ${doc.author}`);
    if (doc.publishedAt) meta.push(new Date(doc.publishedAt).toLocaleDateString());
    lines.push(`*${meta.join(' · ')}*\n`);
  }
  if (doc.summary) lines.push(`> ${doc.summary}\n`);
  doc.sections.forEach((section) => {
    if (section.title) lines.push(`## ${section.title}\n`);
    section.blocks.forEach((block) => {
      const md = blockToMarkdown(block);
      if (md) lines.push(md);
    });
  });
  if (doc.sources && doc.sources.length > 0) {
    lines.push(`## Sources\n`);
    doc.sources.forEach((src) => lines.push(`- ${src}`));
    lines.push('');
  }
  return lines.join('\n');
}

// ── Search helpers ────────────────────────────────────────────────────────────

function sectionMatchesQuery(section: DocumentSection, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (section.title?.toLowerCase().includes(q)) return true;
  return section.blocks.some((block) => {
    switch (block.type) {
      case 'heading':    return block.text.toLowerCase().includes(q);
      case 'paragraph':  return block.text.toLowerCase().includes(q);
      case 'list':       return block.items.some((i) => i.toLowerCase().includes(q));
      case 'code':       return block.code.toLowerCase().includes(q);
      case 'callout':    return block.text.toLowerCase().includes(q);
      case 'quote':      return block.text.toLowerCase().includes(q);
      case 'table':
        return block.headers.some((h) => h.label.toLowerCase().includes(q))
          || block.rows.some((r) =>
              Object.values(r).some((c) => String(c).toLowerCase().includes(q)));
      default: return false;
    }
  });
}

// ── Callout palette ───────────────────────────────────────────────────────────

type CalloutVariant = 'info' | 'warning' | 'insight' | 'critical';
type CalloutStyle = { bg: string; border: string; icon: string; label: string; labelColor: string; textColor: string };

const CALLOUT_STYLES: Record<CalloutVariant, CalloutStyle> = {
  info:     { bg: '#eff6ff', border: '#93c5fd', icon: 'ℹ',  label: 'Note',     labelColor: '#1d4ed8', textColor: '#1e3a5f' },
  warning:  { bg: '#fffbeb', border: '#fcd34d', icon: '⚠',  label: 'Warning',  labelColor: '#92400e', textColor: '#3b2600' },
  insight:  { bg: '#f0fdf4', border: '#86efac', icon: '✦',  label: 'Insight',  labelColor: '#166534', textColor: '#14532d' },
  critical: { bg: '#fef2f2', border: '#fca5a5', icon: '✕',  label: 'Critical', labelColor: '#991b1b', textColor: '#7f1d1d' },
};
const CALLOUT_STYLES_DARK: Record<CalloutVariant, CalloutStyle> = {
  info:     { bg: '#1e3a5f', border: '#3b82f6', icon: 'ℹ',  label: 'Note',     labelColor: '#93c5fd', textColor: '#bfdbfe' },
  warning:  { bg: '#3b2600', border: '#f59e0b', icon: '⚠',  label: 'Warning',  labelColor: '#fcd34d', textColor: '#fde68a' },
  insight:  { bg: '#142a1a', border: '#22c55e', icon: '✦',  label: 'Insight',  labelColor: '#86efac', textColor: '#bbf7d0' },
  critical: { bg: '#3b1114', border: '#ef4444', icon: '✕',  label: 'Critical', labelColor: '#fca5a5', textColor: '#fecaca' },
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
  onRowAction?: (action: string, rowIndex: number, row: Record<string, unknown>) => void,
): React.ReactNode {
  let inner: React.ReactNode;
  switch (block.type) {
    case 'heading':
      inner = <HeadingBlock level={block.level} text={block.text} />;
      break;

    case 'paragraph':
      inner = (
        <ParagraphBlock
          text={block.text}
          confidence={block.confidence}
          showConfidence={showConfidence}
        />
      );
      break;

    case 'list':
      inner = <ListBlock items={block.items} ordered={block.ordered} />;
      break;

    case 'code':
      inner = <CodeBlock code={block.code} language={block.language} />;
      break;

    case 'callout':
      inner = (
        <CalloutBlock
          variant={block.variant}
          title={block.title}
          text={block.text}
        />
      );
      break;

    case 'metric':
      inner = (
        <MetricBlock
          label={block.label}
          value={block.value}
          trend={block.trend}
          delta={block.delta}
          unit={block.unit}
        />
      );
      break;

    case 'divider':
      return (
        <DividerBlock key={key} />
      );

    case 'table':
      inner = (
        <TableBlock
          headers={block.headers}
          rows={block.rows}
          caption={block.caption}
          rowActions={block.rowActions}
          onRowAction={onRowAction}
        />
      );
      break;

    case 'image':
      inner = <ImageBlock src={block.src} alt={block.alt} caption={block.caption} width={block.width} />;
      break;

    case 'quote':
      inner = <QuoteBlock text={block.text} author={block.author} source={block.source} />;
      break;

    case 'dataviz':
      inner = <DataVizBlock chartType={block.chartType} title={block.title} data={block.data} config={block.config} />;
      break;

    case 'embed':
      inner = <EmbedBlock url={block.url} fallbackText={block.fallbackText} height={block.height} />;
      break;

    default:
      return null;
  }

  return (
    <BlockErrorBoundary key={key} blockType={(block as DocumentBlock).type}>
      {inner}
    </BlockErrorBoundary>
  );
}

// ── Dark mode palette ─────────────────────────────────────────────────────────

function useDarkPalette() {
  const dark = usePrefersDark();
  return {
    dark,
    bg:           dark ? '#0f172a' : '#ffffff',
    bgSubtle:     dark ? '#1e293b' : '#f8fafc',
    bgMuted:      dark ? '#334155' : '#f1f5f9',
    border:       dark ? '#334155' : '#e2e8f0',
    borderStrong: dark ? '#475569' : '#cbd5e1',
    textPrimary:  dark ? '#f1f5f9' : '#1e293b',
    textBody:     dark ? '#cbd5e1' : '#374151',
    textSecondary:dark ? '#94a3b8' : '#475569',
    textMuted:    dark ? '#64748b' : '#94a3b8',
    accent:       '#6366f1',
  } as const;
}

// ── Block components ───────────────────────────────────────────────────────────

function DividerBlock() {
  const p = useDarkPalette();
  return (
    <hr style={{ border: 'none', borderTop: `1px solid ${p.border}`, margin: '0.5rem 0' }} />
  );
}

function HeadingBlock({ level, text }: { level: number; text: string }) {
  const p = useDarkPalette();
  const sizes: Record<number, string> = {
    1: '1.25rem', 2: '1.125rem', 3: '1rem', 4: '0.9rem', 5: '0.85rem', 6: '0.8rem',
  };
  return (
    <div style={{
      fontSize: sizes[level] ?? '1rem',
      fontWeight: level <= 2 ? 700 : 600,
      color: p.textPrimary,
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
  const p = useDarkPalette();
  const lowConf = confidence !== undefined && confidence < 0.70;
  return (
    <div style={{
      margin: '0.25rem 0',
      fontSize: '0.8rem',
      color: p.textBody,
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
    </div>
  );
}

function ListBlock({ items, ordered }: { items: string[]; ordered: boolean }) {
  const p = useDarkPalette();
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag style={{ margin: '0.25rem 0', paddingLeft: '1.5rem' }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: '0.8rem', color: p.textBody, lineHeight: '1.65', marginBottom: '0.2rem' }}>
          {item}
        </li>
      ))}
    </Tag>
  );
}

// ── Syntax highlighting ───────────────────────────────────────────────────────

type SyntaxTokenType = 'keyword' | 'string' | 'number' | 'comment' | 'plain';

interface SyntaxToken {
  type: SyntaxTokenType;
  value: string;
}

const KW_TS = ['abstract', 'any', 'as', 'async', 'await', 'boolean', 'break', 'case', 'catch', 'class', 'const', 'continue', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'from', 'function', 'if', 'implements', 'import', 'in', 'instanceof', 'interface', 'keyof', 'let', 'never', 'new', 'null', 'number', 'object', 'of', 'private', 'protected', 'public', 'readonly', 'return', 'static', 'string', 'super', 'switch', 'this', 'throw', 'true', 'try', 'type', 'typeof', 'undefined', 'var', 'void', 'while'];
const KW_PY = ['and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'False', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'None', 'nonlocal', 'not', 'or', 'pass', 'print', 'raise', 'return', 'True', 'try', 'while', 'with', 'yield'];
const KW_BASH = ['case', 'do', 'done', 'echo', 'elif', 'else', 'esac', 'exit', 'export', 'fi', 'for', 'function', 'if', 'in', 'local', 'return', 'then', 'until', 'while'];

/** Tokenize source code into syntax token spans for a given language. */
export function syntaxTokenize(code: string, language?: string): SyntaxToken[] {
  const lang = (language ?? '').toLowerCase();
  const isPy = lang === 'python' || lang === 'py';
  const isBash = lang === 'bash' || lang === 'sh' || lang === 'shell';
  const isJson = lang === 'json';
  const isTs = !isPy && !isBash && !isJson;

  type PatternDef = { re: string; type: SyntaxTokenType };
  const patterns: PatternDef[] = [];

  // Comments (highest priority — swallow everything else)
  if (isPy || isBash) {
    patterns.push({ re: '#[^\\n]*', type: 'comment' });
  } else if (!isJson) {
    patterns.push({ re: '\\/\\/[^\\n]*', type: 'comment' });
    patterns.push({ re: '\\/\\*[\\s\\S]*?\\*\\/', type: 'comment' });
  }

  // Strings
  patterns.push({ re: '"(?:\\\\.|[^"\\\\])*"', type: 'string' });
  patterns.push({ re: "'(?:\\\\.|[^'\\\\])*'", type: 'string' });
  if (isTs) {
    patterns.push({ re: '`(?:\\\\.|[^`\\\\])*`', type: 'string' });
  }

  // Numbers
  patterns.push({ re: '\\b0x[\\da-fA-F]+\\b|\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b', type: 'number' });

  // Keywords
  const kwList = isPy ? KW_PY : isBash ? KW_BASH : isTs ? KW_TS : null;
  if (kwList) {
    patterns.push({ re: `\\b(?:${kwList.join('|')})\\b`, type: 'keyword' });
  }

  if (!patterns.length) return [{ type: 'plain', value: code }];

  const combined = new RegExp(patterns.map((p) => `(${p.re})`).join('|'), 'gm');
  const tokens: SyntaxToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  combined.lastIndex = 0;

  while ((match = combined.exec(code)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'plain', value: code.slice(lastIndex, match.index) });
    }
    const groupIdx = match.slice(1).findIndex((g) => g !== undefined);
    tokens.push({ type: patterns[groupIdx].type, value: match[0] });
    lastIndex = match.index + match[0].length;
    if (match[0].length === 0) combined.lastIndex++;
  }

  if (lastIndex < code.length) {
    tokens.push({ type: 'plain', value: code.slice(lastIndex) });
  }
  return tokens;
}

// Token colours for dark / light themes
const TOKEN_DARK: Record<SyntaxTokenType, React.CSSProperties> = {
  keyword:  { color: '#c084fc' },
  string:   { color: '#86efac' },
  number:   { color: '#fdba74' },
  comment:  { color: '#64748b', fontStyle: 'italic' },
  plain:    { color: '#e2e8f0' },
};
const TOKEN_LIGHT: Record<SyntaxTokenType, React.CSSProperties> = {
  keyword:  { color: '#7c3aed' },
  string:   { color: '#166534' },
  number:   { color: '#c2410c' },
  comment:  { color: '#94a3b8', fontStyle: 'italic' },
  plain:    { color: '#1e293b' },
};

function usePrefersDark(): boolean {
  const mq = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;
  const [dark, setDark] = useState(mq?.matches ?? false);
  useEffect(() => {
    if (!mq) return;
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mq]);
  return dark;
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const prefersDark = usePrefersDark();
  const tokenColors = prefersDark ? TOKEN_DARK : TOKEN_LIGHT;
  const bgColor = prefersDark ? '#0f172a' : '#f8fafc';
  const borderColor = prefersDark ? '#1e293b' : '#e2e8f0';

  const tokens = useMemo(() => syntaxTokenize(code, language), [code, language]);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => { /* clipboard denied — no-op */ });
    }
  };

  return (
    <div style={{ margin: '0.5rem 0' }}>
      {/* Language tag */}
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
      {/* Code area with copy button */}
      <div style={{ position: 'relative' }}>
        <pre style={{
          margin: 0,
          padding: '0.75rem',
          paddingRight: '4.5rem', // space for copy button
          backgroundColor: bgColor,
          borderRadius: language ? '0 0.375rem 0.375rem 0.375rem' : '0.375rem',
          border: `1px solid ${borderColor}`,
          fontSize: '0.72rem',
          overflowX: 'auto',
          lineHeight: 1.6,
          whiteSpace: 'pre',
        }}>
          <code>
            {tokens.map((tok, i) => (
              <span key={i} style={tokenColors[tok.type]}>{tok.value}</span>
            ))}
          </code>
        </pre>
        <button
          onClick={handleCopy}
          aria-label={copied ? 'Code copied' : 'Copy code'}
          style={{
            position: 'absolute', top: '0.4rem', right: '0.4rem',
            padding: '0.2rem 0.5rem',
            fontSize: '0.6rem', fontWeight: 600,
            backgroundColor: copied ? '#166534' : '#1e293b',
            color: copied ? '#bbf7d0' : '#94a3b8',
            border: `1px solid ${copied ? '#166534' : '#334155'}`,
            borderRadius: '0.25rem',
            cursor: 'pointer',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

function CalloutBlock({
  variant, title, text,
}: {
  variant: CalloutVariant;
  title?: string;
  text: string;
}) {
  const { dark } = useDarkPalette();
  const style = dark ? CALLOUT_STYLES_DARK[variant] : CALLOUT_STYLES[variant];
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
        <p style={{ margin: 0, fontSize: '0.78rem', color: style.textColor, lineHeight: 1.6 }}>
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
  const p = useDarkPalette();
  return (
    <div style={{
      display: 'inline-flex',
      flexDirection: 'column',
      gap: '0.1rem',
      backgroundColor: p.bgSubtle,
      border: `1px solid ${p.border}`,
      borderRadius: '0.375rem',
      padding: '0.5rem 0.75rem',
      marginRight: '0.5rem',
      marginBottom: '0.5rem',
      minWidth: '120px',
    }}>
      <div style={{ fontSize: '0.62rem', color: p.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
        {unit && <span style={{ fontWeight: 400 }}> ({unit})</span>}
      </div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: p.textPrimary }}>
        {value}
        <TrendArrow trend={trend} />
      </div>
      {delta && (
        <div style={{ fontSize: '0.68rem', color: p.textMuted }}>{delta}</div>
      )}
    </div>
  );
}

function TableBlock({
  headers, rows, caption, rowActions, onRowAction,
}: {
  headers: Array<{ key: string; label: string; align?: 'left' | 'center' | 'right' }>;
  rows: Array<Record<string, unknown>>;
  caption?: string;
  rowActions?: TableRowAction[];
  onRowAction?: (action: string, rowIndex: number, row: Record<string, unknown>) => void;
}) {
  const p = useDarkPalette();
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filter, setFilter] = useState('');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const query = filter.toLowerCase().trim();
  const filteredRows = query
    ? rows.filter((row) =>
        headers.some((h) => String(row[h.key] ?? '').toLowerCase().includes(query))
      )
    : rows;

  // Track original indices so onRowAction receives the true row index
  const filteredWithIndex = filteredRows.map((row) => ({ row, origIdx: rows.indexOf(row) }));

  const sortedWithIndex = sortKey
    ? [...filteredWithIndex].sort((a, b) => {
        const av = a.row[sortKey];
        const bv = b.row[sortKey];
        const an = typeof av === 'number' ? av : parseFloat(String(av ?? ''));
        const bn = typeof bv === 'number' ? bv : parseFloat(String(bv ?? ''));
        if (!isNaN(an) && !isNaN(bn)) {
          return sortDir === 'asc' ? an - bn : bn - an;
        }
        const as = String(av ?? '').toLowerCase();
        const bs = String(bv ?? '').toLowerCase();
        return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
      })
    : filteredWithIndex;

  const hasActions = rowActions && rowActions.length > 0 && !!onRowAction;

  const rowActionVariantStyle = (variant: TableRowAction['variant']): React.CSSProperties => {
    if (variant === 'danger') return { backgroundColor: '#fef2f2', color: '#991b1b', borderColor: '#fca5a5' };
    if (variant === 'primary') return { backgroundColor: p.dark ? '#3730a3' : '#eff6ff', color: p.dark ? '#a5b4fc' : '#1d4ed8', borderColor: p.dark ? '#4f46e5' : '#93c5fd' };
    return { backgroundColor: p.bgMuted, color: p.textSecondary, borderColor: p.border };
  };

  return (
    <div style={{ margin: '0.75rem 0' }}>
      {rows.length > 4 && (
        <div style={{ marginBottom: '0.5rem' }}>
          <input
            type="search"
            placeholder="Filter rows…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter table rows"
            style={{
              width: '100%',
              padding: '0.35rem 0.625rem',
              fontSize: '0.75rem',
              border: `1px solid ${p.borderStrong}`,
              borderRadius: '0.375rem',
              outline: 'none',
              color: p.textBody,
              backgroundColor: p.bg,
            }}
          />
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.75rem',
          border: `1px solid ${p.border}`,
          borderRadius: '0.375rem',
        }}>
          <thead>
            <tr style={{ backgroundColor: p.bgSubtle, borderBottom: `2px solid ${p.border}` }}>
              {headers.map((h) => (
                <th
                  key={h.key}
                  onClick={() => handleSort(h.key)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    textAlign: h.align ?? 'left',
                    fontWeight: 600,
                    color: sortKey === h.key ? '#6366f1' : p.textSecondary,
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    cursor: 'pointer',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                  aria-sort={sortKey === h.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  {h.label}
                  {sortKey === h.key && (
                    <span style={{ marginLeft: '0.3rem', fontSize: '0.65rem' }}>
                      {sortDir === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </th>
              ))}
              {hasActions && (
                <th style={{
                  padding: '0.5rem 0.75rem',
                  fontWeight: 600,
                  color: p.textSecondary,
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                  textAlign: 'right',
                }}>
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedWithIndex.map(({ row, origIdx }, i) => (
              <tr key={origIdx} style={{ borderBottom: `1px solid ${p.border}`, backgroundColor: i % 2 === 0 ? p.bg : p.bgSubtle }}>
                {headers.map((h) => (
                  <td key={h.key} style={{
                    padding: '0.5rem 0.75rem',
                    textAlign: h.align ?? 'left',
                    color: p.textBody,
                  }}>
                    {String(row[h.key] ?? '')}
                  </td>
                ))}
                {hasActions && (
                  <td style={{ padding: '0.375rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                      {rowActions!.map((ra) => (
                        <button
                          key={ra.action}
                          type="button"
                          onClick={() => onRowAction!(ra.action, origIdx, row)}
                          aria-label={`${ra.label} row ${origIdx + 1}`}
                          style={{
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            border: '1px solid',
                            borderRadius: '0.25rem',
                            cursor: 'pointer',
                            lineHeight: 1.4,
                            transition: 'opacity 0.1s',
                            ...rowActionVariantStyle(ra.variant),
                          }}
                        >
                          {ra.icon && <span style={{ marginRight: '0.2rem' }}>{ra.icon}</span>}
                          {ra.label}
                        </button>
                      ))}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filter && sortedWithIndex.length === 0 && (
        <div style={{ fontSize: '0.75rem', color: p.textMuted, textAlign: 'center', padding: '0.75rem 0' }}>
          No rows match "{filter}"
        </div>
      )}
      {caption && (
        <div style={{ fontSize: '0.7rem', color: p.textSecondary, marginTop: '0.375rem', textAlign: 'center', fontStyle: 'italic' }}>
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
  const p = useDarkPalette();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<Element | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Save the focused element when the lightbox opens; restore it when it closes.
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      closeBtnRef.current?.focus();
    } else if (triggerRef.current) {
      (triggerRef.current as HTMLElement | null)?.focus?.();
      triggerRef.current = null;
    }
  }, [open]);

  return (
    <div style={{ margin: '0.75rem 0', textAlign: 'center' }}>
      <img
        src={src}
        alt={alt}
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); }
        }}
        style={{
          maxWidth: '100%',
          width: width ?? 'auto',
          borderRadius: '0.5rem',
          border: `1px solid ${p.border}`,
          cursor: 'zoom-in',
          transition: 'opacity 0.15s',
        }}
        title="Click to expand"
        aria-label={`${alt} — click or press Enter to expand`}
      />
      {caption && (
        <div style={{ fontSize: '0.7rem', color: p.textMuted, marginTop: '0.375rem', fontStyle: 'italic' }}>
          {caption}
        </div>
      )}

      {/* Lightbox overlay */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90vw', maxHeight: '90vh',
              borderRadius: '0.5rem',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
              cursor: 'default',
            }}
          />
          <button
            ref={closeBtnRef}
            onClick={() => setOpen(false)}
            aria-label="Close lightbox"
            style={{
              position: 'absolute', top: '1rem', right: '1.25rem',
              background: 'none', border: 'none',
              color: 'white', fontSize: '1.5rem', cursor: 'pointer',
              lineHeight: 1, opacity: 0.8,
            }}
          >
            ✕
          </button>
          {caption && (
            <div style={{
              position: 'absolute', bottom: '1.25rem', left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)',
              fontStyle: 'italic', textAlign: 'center',
              maxWidth: '80vw',
            }}>
              {caption}
            </div>
          )}
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
  const p = useDarkPalette();
  return (
    <blockquote style={{
      margin: '0.75rem 0',
      padding: '0.75rem 1rem',
      borderLeft: '4px solid #6366f1',
      backgroundColor: p.bgSubtle,
      fontStyle: 'italic',
      color: p.textSecondary,
      fontSize: '0.85rem',
      lineHeight: 1.65,
    }}>
      <p style={{ margin: '0 0 0.5rem 0' }}>{text}</p>
      {(author || source) && (
        <footer style={{ fontSize: '0.75rem', color: p.textMuted, fontStyle: 'normal' }}>
          {author && <span>— {author}</span>}
          {author && source && <span>, </span>}
          {source && <cite>{source}</cite>}
        </footer>
      )}
    </blockquote>
  );
}

// ── SVG chart primitives ──────────────────────────────────────────────────────

const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7'];

/** Inline SVG tooltip shown above a hovered data point. */
function SvgTooltip({
  x, y, label, value, width,
}: { x: number; y: number; label: string; value: number; width: number }) {
  const tw = 90;
  const th = 28;
  // clamp so tooltip stays within the SVG bounds
  const tx = Math.min(Math.max(x - tw / 2, 4), width - tw - 4);
  const ty = Math.max(y - th - 6, 4);
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect x={tx} y={ty} width={tw} height={th} rx={4} fill="rgba(15,23,42,0.88)" />
      <text x={tx + tw / 2} y={ty + 10} textAnchor="middle" fontSize={8} fill="#94a3b8" fontWeight={400}>
        {label.slice(0, 14)}
      </text>
      <text x={tx + tw / 2} y={ty + 22} textAnchor="middle" fontSize={10} fill="white" fontWeight={700}>
        {formatted}
      </text>
    </g>
  );
}

function SparklineChart({ data }: { data: Array<{ y: number }> }) {
  const { dark } = useDarkPalette();
  const values = data.map(d => d.y);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'flex-end', gap: '1px', height: '24px' }}>
      {values.map((v, i) => {
        const h = ((v - min) / range) * 20 + 4;
        return (
          <div key={i} style={{
            width: '3px', height: `${h}px`,
            backgroundColor: dark ? '#818cf8' : '#6366f1', borderRadius: '1px',
          }} />
        );
      })}
    </div>
  );
}

function BarChart({
  data, width = 480, height = 200,
}: {
  data: Array<{ x: string | number; y: number; label?: string }>;
  width?: number;
  height?: number;
}) {
  const { dark } = useDarkPalette();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const pad = { top: 28, right: 16, bottom: 40, left: 48 };
  const iw = width - pad.left - pad.right;
  const ih = height - pad.top - pad.bottom;
  const maxY = Math.max(...data.map(d => d.y), 0);
  const barW = Math.max(4, iw / data.length - 4);

  const yTicks = 4;
  const tickStep = maxY / yTicks || 1;
  const gridColor = dark ? '#334155' : '#e2e8f0';
  const axisColor = dark ? '#475569' : '#cbd5e1';
  const labelColor = dark ? '#64748b' : '#94a3b8';
  const xLabelColor = dark ? '#94a3b8' : '#64748b';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', maxWidth: width, display: 'block', cursor: 'crosshair' }}
      onMouseLeave={() => setHoveredIdx(null)}
    >
      {/* Y grid lines + labels */}
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const val = tickStep * i;
        const y = pad.top + ih - (val / (maxY || 1)) * ih;
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={pad.left + iw} y2={y}
              stroke={gridColor} strokeWidth={i === 0 ? 1.5 : 0.75} />
            <text x={pad.left - 6} y={y + 4} textAnchor="end"
              fontSize={9} fill={labelColor}>
              {val % 1 === 0 ? val : val.toFixed(1)}
            </text>
          </g>
        );
      })}
      {/* Bars */}
      {data.map((d, i) => {
        const barH = maxY > 0 ? (d.y / maxY) * ih : 0;
        const bx = pad.left + i * (iw / data.length) + (iw / data.length - barW) / 2;
        const by = pad.top + ih - barH;
        const isHov = hoveredIdx === i;
        return (
          <g key={i}>
            <rect
              x={bx} y={by} width={barW} height={barH}
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              rx={2}
              opacity={isHov ? 1 : 0.82}
              onMouseEnter={() => setHoveredIdx(i)}
              style={{ cursor: 'pointer', transition: 'opacity 0.1s' }}
            />
            {/* Value label above bar when hovered */}
            {isHov && barH > 0 && (
              <text x={bx + barW / 2} y={by - 4} textAnchor="middle"
                fontSize={9} fill={CHART_COLORS[i % CHART_COLORS.length]} fontWeight={700}>
                {Number.isInteger(d.y) ? d.y : d.y.toFixed(2)}
              </text>
            )}
            <text x={bx + barW / 2} y={pad.top + ih + 14} textAnchor="middle"
              fontSize={9} fill={xLabelColor}>
              {String(d.label ?? d.x).slice(0, 10)}
            </text>
          </g>
        );
      })}
      {/* Axes */}
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + ih} stroke={axisColor} strokeWidth={1.5} />
      <line x1={pad.left} y1={pad.top + ih} x2={pad.left + iw} y2={pad.top + ih} stroke={axisColor} strokeWidth={1.5} />
      {/* Tooltip */}
      {hoveredIdx !== null && (() => {
        const d = data[hoveredIdx];
        const bx = pad.left + hoveredIdx * (iw / data.length) + (iw / data.length) / 2;
        const barH = maxY > 0 ? (d.y / maxY) * ih : 0;
        const by = pad.top + ih - barH;
        return <SvgTooltip x={bx} y={by} label={String(d.label ?? d.x)} value={d.y} width={width} />;
      })()}
    </svg>
  );
}

function LineChart({
  data, width = 480, height = 200, filled = false,
}: {
  data: Array<{ x: string | number; y: number; label?: string }>;
  width?: number;
  height?: number;
  filled?: boolean;
}) {
  const { dark } = useDarkPalette();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const pad = { top: 28, right: 16, bottom: 40, left: 48 };
  const iw = width - pad.left - pad.right;
  const ih = height - pad.top - pad.bottom;
  const maxY = Math.max(...data.map(d => d.y), 0);
  const minY = Math.min(...data.map(d => d.y), 0);
  const rangeY = maxY - minY || 1;

  const pxFn = (i: number) => pad.left + (i / (data.length - 1 || 1)) * iw;
  const pyFn = (v: number) => pad.top + ih - ((v - minY) / rangeY) * ih;

  const pointsStr = data.map((d, i) => `${pxFn(i)},${pyFn(d.y)}`).join(' ');
  const areaPath = data.length > 1
    ? `M${pxFn(0)},${pyFn(data[0].y)} ` +
      data.slice(1).map((d, i) => `L${pxFn(i + 1)},${pyFn(d.y)}`).join(' ') +
      ` L${pxFn(data.length - 1)},${pad.top + ih} L${pxFn(0)},${pad.top + ih} Z`
    : '';

  const yTicks = 4;
  const tickStep = rangeY / yTicks;
  const lineColor = dark ? '#818cf8' : '#6366f1';
  const gridColor = dark ? '#334155' : '#e2e8f0';
  const axisColor = dark ? '#475569' : '#cbd5e1';
  const labelColor = dark ? '#64748b' : '#94a3b8';
  const xLabelColor = dark ? '#94a3b8' : '#64748b';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', maxWidth: width, display: 'block', cursor: 'crosshair' }}
      onMouseLeave={() => setHoveredIdx(null)}
    >
      {/* Y grid */}
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const val = minY + tickStep * i;
        const y = pyFn(val);
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={pad.left + iw} y2={y}
              stroke={gridColor} strokeWidth={i === 0 ? 1.5 : 0.75} />
            <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize={9} fill={labelColor}>
              {val % 1 === 0 ? Math.round(val) : val.toFixed(1)}
            </text>
          </g>
        );
      })}
      {/* X labels */}
      {data.map((d, i) => (
        <text key={i} x={pxFn(i)} y={pad.top + ih + 14} textAnchor="middle" fontSize={9} fill={xLabelColor}>
          {String(d.label ?? d.x).slice(0, 8)}
        </text>
      ))}
      {/* Area fill */}
      {filled && data.length > 1 && (
        <path d={areaPath} fill={lineColor} opacity={0.12} />
      )}
      {/* Line */}
      {data.length > 1 && (
        <polyline points={pointsStr} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" />
      )}
      {/* Invisible wider hit targets for hover */}
      {data.map((d, i) => (
        <circle
          key={`hit-${i}`}
          cx={pxFn(i)} cy={pyFn(d.y)} r={10}
          fill="transparent"
          onMouseEnter={() => setHoveredIdx(i)}
          style={{ cursor: 'pointer' }}
        />
      ))}
      {/* Visible data points */}
      {data.map((d, i) => {
        const isHov = hoveredIdx === i;
        return (
          <circle
            key={i}
            cx={pxFn(i)} cy={pyFn(d.y)}
            r={isHov ? 5 : 3}
            fill={lineColor}
            stroke={dark ? '#0f172a' : 'white'}
            strokeWidth={isHov ? 2 : 0}
            style={{ transition: 'r 0.1s' }}
          />
        );
      })}
      {/* Axes */}
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + ih} stroke={axisColor} strokeWidth={1.5} />
      <line x1={pad.left} y1={pad.top + ih} x2={pad.left + iw} y2={pad.top + ih} stroke={axisColor} strokeWidth={1.5} />
      {/* Tooltip */}
      {hoveredIdx !== null && (() => {
        const d = data[hoveredIdx];
        return <SvgTooltip x={pxFn(hoveredIdx)} y={pyFn(d.y)} label={String(d.label ?? d.x)} value={d.y} width={width} />;
      })()}
    </svg>
  );
}

function PieChart({
  data, size = 200,
}: {
  data: Array<{ x: string | number; y: number; label?: string }>;
  size?: number;
}) {
  const { dark } = useDarkPalette();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  const total = data.reduce((s, d) => s + d.y, 0) || 1;

  let startAngle = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const angle = (d.y / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const path = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`;
    const midAngle = startAngle + angle / 2;
    const result = { path, color: CHART_COLORS[i % CHART_COLORS.length], midAngle, d };
    startAngle = endAngle;
    return result;
  });

  const legendY = size + 4;
  const legendTextColor = dark ? '#94a3b8' : '#475569';
  return (
    <svg
      viewBox={`0 0 ${size} ${legendY + data.length * 16}`}
      style={{ width: '100%', maxWidth: size + 80, display: 'block', margin: '0 auto' }}
      onMouseLeave={() => setHoveredIdx(null)}
    >
      {slices.map((s, i) => {
        const isHov = hoveredIdx === i;
        // offset hovered slice outward for visual pop
        const offsetX = isHov ? Math.cos(s.midAngle) * 6 : 0;
        const offsetY = isHov ? Math.sin(s.midAngle) * 6 : 0;
        return (
          <path
            key={i}
            d={s.path}
            fill={s.color}
            opacity={isHov ? 1 : 0.85}
            stroke={dark ? '#0f172a' : 'white'}
            strokeWidth={1.5}
            transform={`translate(${offsetX},${offsetY})`}
            onMouseEnter={() => setHoveredIdx(i)}
            style={{ cursor: 'pointer', transition: 'transform 0.15s, opacity 0.1s' }}
          />
        );
      })}
      {/* Tooltip for hovered slice */}
      {hoveredIdx !== null && (() => {
        const s = slices[hoveredIdx];
        const tx = cx + Math.cos(s.midAngle) * (r * 0.6);
        const ty = cy + Math.sin(s.midAngle) * (r * 0.6);
        const pct = ((s.d.y / total) * 100).toFixed(0);
        return (
          <g style={{ pointerEvents: 'none' }}>
            <text x={tx} y={ty - 4} textAnchor="middle" fontSize={9} fill="white" fontWeight={700}>
              {pct}%
            </text>
            <text x={tx} y={ty + 8} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.8)">
              {String(s.d.label ?? s.d.x).slice(0, 12)}
            </text>
          </g>
        );
      })()}
      {/* Legend */}
      {slices.map((s, i) => (
        <g key={i} transform={`translate(${cx - r},${legendY + i * 16})`}
          onMouseEnter={() => setHoveredIdx(i)}
          onMouseLeave={() => setHoveredIdx(null)}
          style={{ cursor: 'pointer' }}>
          <rect width={10} height={10} fill={s.color} rx={2} opacity={hoveredIdx === i ? 1 : 0.85} />
          <text x={14} y={9} fontSize={9} fill={legendTextColor}>
            {String(s.d.label ?? s.d.x).slice(0, 20)} ({((s.d.y / total) * 100).toFixed(0)}%)
          </text>
        </g>
      ))}
    </svg>
  );
}

function ScatterChart({
  data, width = 480, height = 200,
}: {
  data: Array<{ x: string | number; y: number; label?: string }>;
  width?: number;
  height?: number;
}) {
  const { dark } = useDarkPalette();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const pad = { top: 28, right: 16, bottom: 40, left: 48 };
  const iw = width - pad.left - pad.right;
  const ih = height - pad.top - pad.bottom;

  const xs = data.map(d => Number(d.x));
  const ys = data.map(d => d.y);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 1);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 1);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const pxFn = (v: number) => pad.left + ((v - minX) / rangeX) * iw;
  const pyFn = (v: number) => pad.top + ih - ((v - minY) / rangeY) * ih;

  const yTicks = 4;
  const xTicks = 4;
  const gridColor = dark ? '#334155' : '#e2e8f0';
  const axisColor = dark ? '#475569' : '#cbd5e1';
  const labelColor = dark ? '#64748b' : '#94a3b8';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', maxWidth: width, display: 'block', cursor: 'crosshair' }}
      onMouseLeave={() => setHoveredIdx(null)}
    >
      {/* Y grid + labels */}
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const val = minY + (rangeY / yTicks) * i;
        const y = pyFn(val);
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={pad.left + iw} y2={y}
              stroke={gridColor} strokeWidth={i === 0 ? 1.5 : 0.75} />
            <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize={9} fill={labelColor}>
              {val % 1 === 0 ? Math.round(val) : val.toFixed(1)}
            </text>
          </g>
        );
      })}
      {/* X grid + labels */}
      {Array.from({ length: xTicks + 1 }, (_, i) => {
        const val = minX + (rangeX / xTicks) * i;
        const x = pxFn(val);
        return (
          <g key={i}>
            <line x1={x} y1={pad.top} x2={x} y2={pad.top + ih}
              stroke={gridColor} strokeWidth={0.75} />
            <text x={x} y={pad.top + ih + 14} textAnchor="middle" fontSize={9} fill={labelColor}>
              {val % 1 === 0 ? Math.round(val) : val.toFixed(1)}
            </text>
          </g>
        );
      })}
      {/* Data points */}
      {data.map((d, i) => {
        const isHov = hoveredIdx === i;
        return (
          <circle
            key={i}
            cx={pxFn(Number(d.x))}
            cy={pyFn(d.y)}
            r={isHov ? 7 : 5}
            fill={CHART_COLORS[i % CHART_COLORS.length]}
            opacity={isHov ? 1 : 0.8}
            onMouseEnter={() => setHoveredIdx(i)}
            style={{ cursor: 'pointer', transition: 'r 0.1s' }}
          />
        );
      })}
      {/* Axes */}
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + ih} stroke={axisColor} strokeWidth={1.5} />
      <line x1={pad.left} y1={pad.top + ih} x2={pad.left + iw} y2={pad.top + ih} stroke={axisColor} strokeWidth={1.5} />
      {/* Tooltip */}
      {hoveredIdx !== null && (() => {
        const d = data[hoveredIdx];
        return <SvgTooltip x={pxFn(Number(d.x))} y={pyFn(d.y)} label={String(d.label ?? d.x)} value={d.y} width={width} />;
      })()}
    </svg>
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
  const p = useDarkPalette();
  if (chartType === 'sparkline') {
    return (
      <div style={{ margin: '0.5rem 0' }}>
        <SparklineChart data={data} />
      </div>
    );
  }

  const w = typeof config?.width === 'number' ? config.width : 480;
  const h = typeof config?.height === 'number' ? config.height : 200;

  let chart: React.ReactNode;
  if (chartType === 'bar') {
    chart = <BarChart data={data} width={w} height={h} />;
  } else if (chartType === 'line') {
    chart = <LineChart data={data} width={w} height={h} />;
  } else if (chartType === 'area') {
    chart = <LineChart data={data} width={w} height={h} filled />;
  } else if (chartType === 'pie') {
    chart = <PieChart data={data} size={Math.min(w, h)} />;
  } else {
    chart = <ScatterChart data={data} width={w} height={h} />;
  }

  return (
    <div style={{
      margin: '0.75rem 0',
      padding: '0.75rem 1rem',
      backgroundColor: p.bgSubtle,
      border: `1px solid ${p.border}`,
      borderRadius: '0.5rem',
    }}>
      {title && (
        <div style={{ fontWeight: 600, marginBottom: '0.625rem', fontSize: '0.8rem', color: p.textPrimary }}>
          {title}
        </div>
      )}
      {chart}
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
  const p = useDarkPalette();
  return (
    <div style={{ margin: '0.75rem 0' }}>
      <iframe
        src={url}
        style={{
          width: '100%',
          height: height ?? 400,
          border: `1px solid ${p.border}`,
          borderRadius: '0.5rem',
        }}
        title="Embedded content"
      />
      {fallbackText && (
        <div style={{ fontSize: '0.7rem', color: p.textMuted, marginTop: '0.375rem', textAlign: 'center' }}>
          {fallbackText}
        </div>
      )}
    </div>
  );
}

// ── Section renderer ──────────────────────────────────────────────────────────

function SectionBlock({
  section, showConfidence, onExplain, density, onRowAction,
}: {
  section: DocumentSection;
  showConfidence: boolean;
  onExplain?: (id: string) => void;
  density: 'executive' | 'operator' | 'expert';
  onRowAction?: (action: string, rowIndex: number, row: Record<string, unknown>) => void;
}) {
  const p = useDarkPalette();
  const [collapsed, setCollapsed] = useState(section.defaultCollapsed ?? false);
  const lowConf = section.confidence !== undefined && section.confidence < 0.70;
  const isCollapsible = section.collapsible && !!section.title;

  // In executive density, skip sections without titles (decorative dividers etc.)
  if (density === 'executive' && !section.title && section.blocks.every((b) => b.type === 'divider')) {
    return null;
  }

  return (
    <div id={`section-${section.id}`} style={{ marginBottom: '1rem' }}>
      {section.title && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          marginBottom: collapsed ? 0 : '0.5rem',
          borderBottom: `1px solid ${p.border}`,
          paddingBottom: '0.25rem',
        }}>
          {isCollapsible && (
            <button
              onClick={() => setCollapsed((c) => !c)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? `Expand ${section.title}` : `Collapse ${section.title}`}
              style={{
                background: 'none', border: 'none', padding: 0,
                cursor: 'pointer', fontSize: '0.7rem', color: p.textMuted,
                lineHeight: 1, flexShrink: 0,
              }}
            >
              {collapsed ? '▶' : '▼'}
            </button>
          )}
          <h3
            onClick={isCollapsible ? () => setCollapsed((c) => !c) : undefined}
            onKeyDown={isCollapsible ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed((c) => !c); } } : undefined}
            style={{
              margin: 0,
              fontSize: '0.875rem',
              fontWeight: 700,
              color: p.textPrimary,
              cursor: isCollapsible ? 'pointer' : 'default',
              userSelect: 'none',
            }}
          >
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
                border: `1px solid ${p.border}`,
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
      {!collapsed && (
        <div>
          {section.blocks.map((block, i) => renderBlock(block, i, showConfidence, onRowAction))}
        </div>
      )}
    </div>
  );
}

// ── Lazy section loading ───────────────────────────────────────────────────────

/** Activate lazy section loading when the document has more than this many sections. */
const LAZY_SECTIONS_THRESHOLD = 5;

/** Number of sections always rendered immediately (above-the-fold content). */
const EAGER_SECTIONS = 3;

function LazySectionLoader({
  eager,
  children,
  estimatedHeight = 120,
}: {
  eager: boolean;
  children: React.ReactNode;
  estimatedHeight?: number;
}) {
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(eager);

  React.useEffect(() => {
    ensureShimmerStyle();
    if (eager || mounted) return;
    if (typeof IntersectionObserver === 'undefined') {
      setMounted(true);
      return;
    }
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin: '500px', threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eager, mounted]);

  if (mounted) return <>{children}</>;

  return (
    <div
      ref={sentinelRef}
      aria-hidden="true"
      style={{
        minHeight: estimatedHeight,
        marginBottom: '1rem',
        borderRadius: '0.5rem',
        background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
        backgroundSize: '200% 100%',
        animation: 'hari-shimmer 1.4s infinite',
      }}
    />
  );
}

// ── Top-level component ───────────────────────────────────────────────────────

export function DocumentRenderer({
  data,
  density = 'operator',
  onExplain,
  showConfidence = true,
  showToc = false,
  onExportMarkdown,
  showPdfExport = false,
  showSearch = false,
  onRowAction,
}: DocumentRendererProps) {
  const p = useDarkPalette();
  const [searchQuery, setSearchQuery] = useState('');
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
  const densitySections =
    density === 'executive'
      ? doc.sections.filter((s) => s.id === 'exec-summary' || !s.title)
      : doc.sections;

  // Filter by search query (if showSearch is enabled)
  const visibleSections = useMemo(() => {
    if (!showSearch || !searchQuery.trim()) return densitySections;
    return densitySections.filter((s) => sectionMatchesQuery(s, searchQuery.trim()));
  }, [densitySections, showSearch, searchQuery]);

  const tocSections = visibleSections.filter((s) => !!s.title);

  return (
    <div style={{ color: p.textBody }}>
      {/* Document header */}
      <div style={{
        marginBottom: '1rem',
        paddingBottom: '0.75rem',
        borderBottom: `2px solid ${p.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
          <h2 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: 800, color: p.textPrimary }}>
            {doc.title}
          </h2>
          {doc.refreshable && (
            <span style={{
              fontSize: '0.6rem', fontWeight: 700,
              backgroundColor: p.dark ? '#14532d' : '#dcfce7',
              color: p.dark ? '#86efac' : '#166534',
              border: `1px solid ${p.dark ? '#22c55e' : '#86efac'}`,
              borderRadius: '9999px',
              padding: '0.15rem 0.5rem', whiteSpace: 'nowrap',
            }}>
              ⟳ LIVE{doc.refreshInterval ? ` · ${doc.refreshInterval}s` : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.68rem', color: p.textMuted, flexWrap: 'wrap' }}>
          {doc.author && <span>By {doc.author}</span>}
          {doc.publishedAt && (
            <span>{new Date(doc.publishedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
          )}
          {doc.revision && <span>Rev {doc.revision}</span>}
        </div>
        {doc.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.375rem' }}>
            {doc.tags.map((tag) => (
              <span key={tag} style={{
                fontSize: '0.6rem', fontWeight: 600,
                backgroundColor: p.dark ? '#1e3a5f' : '#eff6ff',
                color: p.dark ? '#93c5fd' : '#1d4ed8',
                border: `1px solid ${p.dark ? '#3b82f6' : '#bfdbfe'}`,
                borderRadius: '0.25rem',
                padding: '0.1rem 0.35rem',
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}
        {/* Export buttons */}
        {(onExportMarkdown || showPdfExport) && (
          <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            {onExportMarkdown && (
              <button
                onClick={() => onExportMarkdown(docToMarkdown(doc))}
                aria-label="Export document as Markdown"
                style={{
                  padding: '0.2rem 0.6rem',
                  fontSize: '0.65rem', fontWeight: 600,
                  backgroundColor: p.bgSubtle, color: p.textSecondary,
                  border: `1px solid ${p.borderStrong}`, borderRadius: '0.375rem',
                  cursor: 'pointer',
                }}
              >
                ↓ Export .md
              </button>
            )}
            {showPdfExport && (
              <button
                onClick={() => window.print()}
                aria-label="Print or save as PDF"
                style={{
                  padding: '0.2rem 0.6rem',
                  fontSize: '0.65rem', fontWeight: 600,
                  backgroundColor: p.bgSubtle, color: p.textSecondary,
                  border: `1px solid ${p.borderStrong}`, borderRadius: '0.375rem',
                  cursor: 'pointer',
                }}
              >
                ⎙ Print / PDF
              </button>
            )}
          </div>
        )}
      </div>

      {/* Search */}
      {showSearch && (
        <div style={{ marginBottom: '1rem', position: 'relative' }}>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sections…"
            aria-label="Search document"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '0.4rem 0.75rem 0.4rem 1.75rem',
              fontSize: '0.78rem', color: p.textPrimary,
              border: `1px solid ${p.borderStrong}`, borderRadius: '0.5rem',
              outline: 'none', backgroundColor: p.bgSubtle,
            }}
          />
          <span style={{
            position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)',
            fontSize: '0.75rem', color: p.textMuted, pointerEvents: 'none',
          }}>🔍</span>
          {searchQuery && (
            <span style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.65rem', color: p.textMuted }}>
              {visibleSections.length} result{visibleSections.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Table of Contents */}
      {showToc && tocSections.length > 1 && (
        <nav aria-label="Table of contents" style={{
          marginBottom: '1.25rem',
          padding: '0.75rem 1rem',
          backgroundColor: p.bgSubtle,
          border: `1px solid ${p.border}`,
          borderRadius: '0.5rem',
          fontSize: '0.75rem',
        }}>
          <div style={{ fontWeight: 700, color: p.textSecondary, marginBottom: '0.375rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Contents
          </div>
          <ol style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8 }}>
            {tocSections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#section-${s.id}`}
                  style={{ color: '#6366f1', textDecoration: 'none', fontSize: '0.75rem' }}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* Executive summary prose (if provided and not already a section) */}
      {doc.summary && density !== 'expert' && (
        <div style={{
          backgroundColor: p.bgSubtle,
          border: `1px solid ${p.border}`,
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          fontSize: '0.8rem',
          color: p.textBody,
          lineHeight: 1.65,
          fontStyle: 'italic',
        }}>
          {doc.summary}
        </div>
      )}

      {/* Sections — lazily mounted for long documents */}
      {visibleSections.map((section, index) => {
        const useLazy = visibleSections.length > LAZY_SECTIONS_THRESHOLD;
        const eager = !useLazy || index < EAGER_SECTIONS;
        const estimatedHeight = Math.max(80, section.blocks.length * 40);
        return (
          <LazySectionLoader key={section.id} eager={eager} estimatedHeight={estimatedHeight}>
            <SectionBlock
              section={section}
              showConfidence={showConfidence}
              onExplain={onExplain}
              density={density}
              onRowAction={onRowAction}
            />
          </LazySectionLoader>
        );
      })}

      {/* Document footer: sources */}
      {doc.sources && doc.sources.length > 0 && (
        <div style={{
          marginTop: '1.5rem',
          paddingTop: '0.75rem',
          borderTop: `1px solid ${p.border}`,
          fontSize: '0.68rem',
          color: p.textMuted,
        }}>
          <span style={{ fontWeight: 600, color: p.textSecondary }}>Sources: </span>
          {doc.sources.map((src, i) => (
            <span key={i}>
              {src.startsWith('http') ? (
                <a href={src} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1' }}>{src}</a>
              ) : (
                src
              )}
              {i < doc.sources!.length - 1 && ' · '}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
