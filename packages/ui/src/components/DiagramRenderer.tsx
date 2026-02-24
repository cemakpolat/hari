import React, { useEffect, useRef, useMemo, useState } from 'react';
import { DiagramDataSchema } from '@hari/core';
import type {
  DiagramPayload,
  MermaidDiagram,
  GraphDiagram,
  GraphNode,
  ChartDiagram,
  ChartSeries,
} from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// DiagramRenderer
//
// Renders three diagram sub-kinds from DiagramData:
//
//   mermaid — dynamically loads mermaid.js from CDN and renders markup inside
//             a shadow container. Falls back to a syntax-highlighted code block
//             when the CDN load fails or JS is disabled.
//
//   graph   — SVG-based node/edge renderer with automatic circular layout,
//             group colour-coding, and directed arrowhead markers.
//
//   chart   — SVG-based bar, line, area, and pie chart renderer with axis
//             labels, legend, and tooltip-style value annotations.
//
// Density behaviour:
//   executive — first diagram only, no caption/metadata
//   operator  — all diagrams with legends and labels
//   expert    — all diagrams + raw markup toggle (for mermaid) + full metadata
// ─────────────────────────────────────────────────────────────────────────────

export interface DiagramRendererProps {
  data: unknown;
  density?: 'executive' | 'operator' | 'expert';
  onExplain?: (elementId: string) => void;
}

// ── Colour palette ─────────────────────────────────────────────────────────────

const PALETTE = [
  '#6366f1', // indigo
  '#0ea5e9', // sky
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#06b6d4', // cyan
];

function paletteColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const CARD_STYLE: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '0.75rem',
  padding: '1.25rem',
  marginBottom: '1rem',
};

const TITLE_STYLE: React.CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 600,
  color: '#1e293b',
  marginBottom: '0.75rem',
};

const CAPTION_STYLE: React.CSSProperties = {
  fontSize: '0.78rem',
  color: '#64748b',
  marginTop: '0.5rem',
  fontStyle: 'italic',
  textAlign: 'center',
};

// ─────────────────────────────────────────────────────────────────────────────
// Mermaid renderer
// ─────────────────────────────────────────────────────────────────────────────

function useMermaidLoad(): 'idle' | 'loading' | 'ready' | 'error' {
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const triedRef = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).mermaid) { setState('ready'); return; }
    if (triedRef.current) return;
    triedRef.current = true;
    setState('loading');
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
    script.async = true;
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).mermaid.initialize({ startOnLoad: false, theme: 'neutral' });
      setState('ready');
    };
    script.onerror = () => setState('error');
    document.head.appendChild(script);
  }, []);

  return state;
}

let _mermaidRenderCount = 0;

function MermaidBlock({
  diagram,
  density,
}: {
  diagram: MermaidDiagram;
  density: 'executive' | 'operator' | 'expert';
}) {
  const loadState = useMermaidLoad();
  const containerRef = useRef<HTMLDivElement>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const idRef = useRef(`mermaid-${++_mermaidRenderCount}`);

  useEffect(() => {
    if (loadState !== 'ready' || !containerRef.current) return;
    setRenderError(null);
    const id = idRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mermaid = (window as any).mermaid;
    mermaid
      .render(id, diagram.markup)
      .then(({ svg }: { svg: string }) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      })
      .catch((err: unknown) => {
        setRenderError(String(err));
      });
  }, [loadState, diagram.markup]);

  return (
    <div style={CARD_STYLE}>
      {diagram.title && <div style={TITLE_STYLE}>{diagram.title}</div>}

      {/* Loading / error state */}
      {loadState === 'loading' && (
        <div style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          Loading diagram renderer…
        </div>
      )}
      {(loadState === 'error' || renderError) && (
        <div style={{ color: '#dc2626', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
          {renderError ?? 'Failed to load mermaid renderer. Showing raw markup.'}
        </div>
      )}

      {/* Rendered mermaid diagram */}
      {loadState === 'ready' && !renderError && !showRaw && (
        <div
          ref={containerRef}
          style={{ overflowX: 'auto', borderRadius: '0.5rem', background: '#f8fafc', padding: '1rem' }}
        />
      )}

      {/* Raw markup (expert density or forced) */}
      {(showRaw || loadState === 'error' || renderError) && (
        <pre
          style={{
            background: '#1e293b',
            color: '#e2e8f0',
            borderRadius: '0.5rem',
            padding: '1rem',
            fontSize: '0.8rem',
            overflowX: 'auto',
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {diagram.markup}
        </pre>
      )}

      {/* Expert density toggle */}
      {density === 'expert' && loadState === 'ready' && !renderError && (
        <button
          onClick={() => setShowRaw((v) => !v)}
          style={{
            marginTop: '0.5rem',
            fontSize: '0.75rem',
            color: '#6366f1',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            textDecoration: 'underline',
          }}
        >
          {showRaw ? 'Show diagram' : 'Show markup'}
        </button>
      )}

      {diagram.caption && density !== 'executive' && (
        <div style={CAPTION_STYLE}>{diagram.caption}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph renderer (SVG, circular/hierarchical layout)
// ─────────────────────────────────────────────────────────────────────────────

interface Point { x: number; y: number; }

function computeLayout(
  nodes: GraphNode[],
  layout: GraphDiagram['layout'],
  width: number,
  height: number,
): Map<string, Point> {
  const map = new Map<string, Point>();
  const n = nodes.length;
  if (n === 0) return map;

  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(cx, cy) * 0.75;

  if (layout === 'hierarchy') {
    // Very simple top-down BFS hierarchy
    // Place root(s) at top, children below
    const levels: string[][] = [];
    const visited = new Set<string>();
    // First pass: nodes with no incoming consideration as roots
    const roots = nodes.map((n) => n.id);
    levels.push(roots.slice(0, Math.ceil(Math.sqrt(n))));
    let remaining = roots.filter((id) => !levels[0].includes(id));
    while (remaining.length > 0) {
      const chunk = remaining.splice(0, Math.ceil(Math.sqrt(n)));
      levels.push(chunk);
    }
    levels.forEach((level, li) => {
      const y = 60 + li * (height / (levels.length + 1));
      level.forEach((id, xi) => {
        if (visited.has(id)) return;
        visited.add(id);
        const x = (width / (level.length + 1)) * (xi + 1);
        map.set(id, { x, y });
      });
    });
  } else if (layout === 'radial') {
    // Radial: groups on inner rings, singletons on outer
    const groups = new Map<string, string[]>();
    nodes.forEach((nd) => {
      const g = nd.group ?? '__default';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(nd.id);
    });
    let gi = 0;
    const groupKeys = [...groups.keys()];
    groupKeys.forEach((gk) => {
      const members = groups.get(gk)!;
      const angleBase = (2 * Math.PI * gi) / groupKeys.length;
      const ringR = (gi === 0 && groupKeys.length === 1) ? 0 : r * (0.4 + 0.6 * (gi / groupKeys.length));
      members.forEach((id, mi) => {
        const a = angleBase + (2 * Math.PI * mi) / members.length;
        map.set(id, {
          x: cx + ringR * Math.cos(a),
          y: cy + ringR * Math.sin(a),
        });
      });
      gi++;
    });
  } else {
    // force / default: arrange on a circle for simplicity
    nodes.forEach((nd, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      map.set(nd.id, {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      });
    });
  }

  return map;
}

function GraphBlock({
  diagram,
  density,
  groupColorMap,
  onExplain,
}: {
  diagram: GraphDiagram;
  density: 'executive' | 'operator' | 'expert';
  groupColorMap: Map<string, string>;
  onExplain?: (id: string) => void;
}) {
  const W = 560;
  const H = density === 'executive' ? 260 : 380;
  const positions = useMemo(
    () => computeLayout(diagram.nodes, diagram.layout, W, H),
    [diagram.nodes, diagram.layout],
  );

  const [hovered, setHovered] = useState<string | null>(null);

  function nodeColor(nd: GraphNode): string {
    if (nd.color) return nd.color;
    if (nd.group) {
      if (!groupColorMap.has(nd.group)) {
        groupColorMap.set(nd.group, paletteColor(groupColorMap.size));
      }
      return groupColorMap.get(nd.group)!;
    }
    return '#6366f1';
  }

  const MARKER_ID = `arrow-${diagram.id ?? 'graph'}`;

  return (
    <div style={CARD_STYLE}>
      {diagram.title && <div style={TITLE_STYLE}>{diagram.title}</div>}
      <div style={{ overflowX: 'auto' }}>
        <svg
          width="100%"
          viewBox={`0 0 ${W} ${H}`}
          style={{ display: 'block', maxWidth: W }}
        >
          <defs>
            <marker id={MARKER_ID} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
            </marker>
          </defs>

          {/* Edges */}
          {diagram.edges.map((edge, ei) => {
            const src = positions.get(edge.source);
            const tgt = positions.get(edge.target);
            if (!src || !tgt) return null;
            const color = edge.color ?? '#94a3b8';
            const strokeW = edge.weight ?? 1;
            const dashArray =
              edge.style === 'dashed' ? '6 3' : edge.style === 'dotted' ? '2 3' : undefined;

            // Offset so line ends at node boundary (r=20)
            const dx = tgt.x - src.x;
            const dy = tgt.y - src.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const nodeR = 22;
            const x2 = tgt.x - (dx / dist) * nodeR;
            const y2 = tgt.y - (dy / dist) * nodeR;

            const midX = (src.x + x2) / 2;
            const midY = (src.y + y2) / 2;

            return (
              <g key={ei}>
                <line
                  x1={src.x} y1={src.y} x2={x2} y2={y2}
                  stroke={color}
                  strokeWidth={strokeW}
                  strokeDasharray={dashArray}
                  markerEnd={edge.directed ? `url(#${MARKER_ID})` : undefined}
                  strokeLinecap="round"
                />
                {edge.label && density !== 'executive' && (
                  <text
                    x={midX} y={midY - 4}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#64748b"
                    style={{ pointerEvents: 'none' }}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {diagram.nodes.map((nd) => {
            const pos = positions.get(nd.id);
            if (!pos) return null;
            const color = nodeColor(nd);
            const isHov = hovered === nd.id;
            const r = 22;
            return (
              <g
                key={nd.id}
                transform={`translate(${pos.x},${pos.y})`}
                style={{ cursor: nd.explainElementId ? 'pointer' : 'default' }}
                onMouseEnter={() => setHovered(nd.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => {
                  if (nd.explainElementId && onExplain) onExplain(nd.explainElementId);
                }}
              >
                <circle
                  r={isHov ? r + 3 : r}
                  fill={color}
                  fillOpacity={0.15}
                  stroke={color}
                  strokeWidth={isHov ? 2.5 : 1.5}
                  style={{ transition: 'all 0.15s' }}
                />
                {nd.icon ? (
                  <text textAnchor="middle" dominantBaseline="central" fontSize="14" style={{ userSelect: 'none' }}>
                    {nd.icon}
                  </text>
                ) : null}
                <text
                  textAnchor="middle"
                  y={r + 13}
                  fontSize="10"
                  fill="#1e293b"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {nd.label.length > 14 ? nd.label.slice(0, 13) + '…' : nd.label}
                </text>

                {/* Expert: metadata tooltip on hover */}
                {density === 'expert' && isHov && nd.metadata && (
                  <g transform={`translate(${r + 5}, ${-r})`}>
                    <rect
                      x={0} y={0}
                      width={140} height={Object.keys(nd.metadata).length * 16 + 8}
                      rx={4} fill="#1e293b" fillOpacity={0.9}
                    />
                    {Object.entries(nd.metadata).map(([k, v], mi) => (
                      <text key={k} x={6} y={mi * 16 + 14} fontSize="9" fill="#e2e8f0">
                        {k}: {String(v)}
                      </text>
                    ))}
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Group legend */}
      {density !== 'executive' && groupColorMap.size > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
          {[...groupColorMap.entries()].map(([g, c]) => (
            <span
              key={g}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                fontSize: '0.75rem', color: '#475569',
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'inline-block' }} />
              {g}
            </span>
          ))}
        </div>
      )}

      {diagram.caption && density !== 'executive' && (
        <div style={CAPTION_STYLE}>{diagram.caption}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart renderer (bar, line, area, pie)
// ─────────────────────────────────────────────────────────────────────────────

function resolveColors(series: ChartSeries[]): string[] {
  return series.map((s, i) => s.color ?? paletteColor(i));
}

function BarChart({
  diagram,
  colors,
  density,
}: {
  diagram: ChartDiagram;
  colors: string[];
  density: 'executive' | 'operator' | 'expert';
}) {
  const W = 540;
  const H = density === 'executive' ? 180 : 260;
  const MARGIN = { top: 20, right: 20, bottom: density === 'executive' ? 40 : 60, left: 44 };
  const innerW = W - MARGIN.left - MARGIN.right;
  const innerH = H - MARGIN.top - MARGIN.bottom;

  const allValues = diagram.series.flatMap((s) => s.values);
  const maxVal = Math.max(...allValues, 0) * 1.1 || 1;
  const minVal = diagram.yZeroBased ? 0 : Math.min(...allValues) * 0.9;
  const valueRange = maxVal - minVal;

  const labels = diagram.labels;
  const seriesCount = diagram.series.length;
  const groupW = innerW / Math.max(labels.length, 1);
  const barW = Math.max(4, (groupW / (seriesCount + 1)) - 2);

  function yScale(v: number) {
    return innerH - ((v - minVal) / valueRange) * innerH;
  }

  const yTicks = 4;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    minVal + (valueRange * i) / yTicks,
  );

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
        {/* Y-axis ticks */}
        {tickValues.map((tv, i) => (
          <g key={i} transform={`translate(0,${yScale(tv)})`}>
            <line x1={0} x2={innerW} stroke="#e2e8f0" strokeDasharray="4 2" />
            <text x={-6} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="#94a3b8">
              {tv % 1 === 0 ? tv : tv.toFixed(1)}{diagram.unit ?? ''}
            </text>
          </g>
        ))}

        {/* Bars */}
        {labels.map((lbl, li) => {
          const groupX = li * groupW + groupW / 2;
          return (
            <g key={li}>
              {diagram.series.map((ser, si) => {
                const val = ser.values[li] ?? 0;
                const color = colors[si];
                const x = groupX - (seriesCount * barW) / 2 + si * barW;
                const y = yScale(Math.max(val, minVal));
                const barH = Math.max(1, innerH - yScale(Math.max(val, minVal)));
                return (
                  <g key={si}>
                    <rect x={x} y={y} width={barW - 1} height={barH} fill={color} fillOpacity={0.85} rx={2} />
                    {density === 'expert' && (
                      <text
                        x={x + (barW - 1) / 2} y={y - 3}
                        textAnchor="middle" fontSize="8" fill={color}
                      >
                        {val}{diagram.unit ?? ''}
                      </text>
                    )}
                  </g>
                );
              })}
              {density !== 'executive' && (
                <text
                  x={groupX} y={innerH + 14}
                  textAnchor="middle" fontSize="9" fill="#64748b"
                >
                  {lbl.length > 8 ? lbl.slice(0, 7) + '…' : lbl}
                </text>
              )}
            </g>
          );
        })}

        {/* Axes */}
        <line x1={0} y1={0} x2={0} y2={innerH} stroke="#cbd5e1" />
        <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#cbd5e1" />
      </g>
    </svg>
  );
}

function LineAreaChart({
  diagram,
  colors,
  density,
  area,
}: {
  diagram: ChartDiagram;
  colors: string[];
  density: 'executive' | 'operator' | 'expert';
  area: boolean;
}) {
  const W = 540;
  const H = density === 'executive' ? 180 : 260;
  const MARGIN = { top: 20, right: 20, bottom: density === 'executive' ? 36 : 56, left: 44 };
  const innerW = W - MARGIN.left - MARGIN.right;
  const innerH = H - MARGIN.top - MARGIN.bottom;

  const allValues = diagram.series.flatMap((s) => s.values);
  const maxVal = Math.max(...allValues, 0) * 1.1 || 1;
  const minVal = diagram.yZeroBased ? 0 : Math.min(...allValues) * 0.9;
  const vRange = maxVal - minVal;

  const labels = diagram.labels;
  const n = Math.max(labels.length - 1, 1);

  function xScale(i: number) { return (i / n) * innerW; }
  function yScale(v: number) { return innerH - ((v - minVal) / vRange) * innerH; }

  const yTicks = 4;
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) =>
    minVal + (vRange * i) / yTicks,
  );

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
        {/* Grid */}
        {tickVals.map((tv, i) => (
          <g key={i} transform={`translate(0,${yScale(tv)})`}>
            <line x1={0} x2={innerW} stroke="#e2e8f0" strokeDasharray="4 2" />
            <text x={-6} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="#94a3b8">
              {tv % 1 === 0 ? tv : tv.toFixed(1)}{diagram.unit ?? ''}
            </text>
          </g>
        ))}

        {/* Area fills */}
        {area && diagram.series.map((ser, si) => {
          const pts = ser.values.map((v, i) => `${xScale(i)},${yScale(v)}`).join(' ');
          const first = ser.values[0] ?? 0;
          const last = ser.values[ser.values.length - 1] ?? 0;
          const path = `M${xScale(0)},${innerH} L${xScale(0)},${yScale(first)} ${ser.values.map((v, i) => `L${xScale(i)},${yScale(v)}`).join(' ')} L${xScale(ser.values.length - 1)},${innerH} Z`;
          void pts;
          return (
            <path key={si} d={path} fill={colors[si]} fillOpacity={0.12} />
          );
          void last;
        })}

        {/* Lines */}
        {diagram.series.map((ser, si) => {
          const d = ser.values
            .map((v, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(v)}`)
            .join(' ');
          return (
            <g key={si}>
              <path d={d} fill="none" stroke={colors[si]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {/* Dots */}
              {ser.values.map((v, i) => (
                <circle key={i} cx={xScale(i)} cy={yScale(v)} r={3} fill={colors[si]} />
              ))}
            </g>
          );
        })}

        {/* X labels */}
        {density !== 'executive' && labels.map((lbl, i) => (
          <text key={i} x={xScale(i)} y={innerH + 14} textAnchor="middle" fontSize="9" fill="#64748b">
            {lbl.length > 8 ? lbl.slice(0, 7) + '…' : lbl}
          </text>
        ))}

        {/* Axes */}
        <line x1={0} y1={0} x2={0} y2={innerH} stroke="#cbd5e1" />
        <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#cbd5e1" />
      </g>
    </svg>
  );
}

function PieChart({
  diagram,
  colors,
  density,
}: {
  diagram: ChartDiagram;
  colors: string[];
  density: 'executive' | 'operator' | 'expert';
}) {
  const SIZE = density === 'executive' ? 160 : 220;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const r = SIZE / 2 - 16;

  // Use first series only for pie; multiple series → stacked donut not supported
  const series = diagram.series[0];
  if (!series) return null;
  const total = series.values.reduce((a, b) => a + b, 0) || 1;

  let cumAngle = -Math.PI / 2;

  function slice(value: number, color: string, label: string, i: number) {
    const angle = (value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + r * Math.cos(cumAngle);
    const y2 = cy + r * Math.sin(cumAngle);
    const large = angle > Math.PI ? 1 : 0;

    const midAngle = cumAngle - angle / 2;
    const lx = cx + (r + 16) * Math.cos(midAngle);
    const ly = cy + (r + 16) * Math.sin(midAngle);

    const pct = ((value / total) * 100).toFixed(1);

    return (
      <g key={i}>
        <path
          d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`}
          fill={color}
          fillOpacity={0.85}
          stroke="#fff"
          strokeWidth={1.5}
        />
        {density !== 'executive' && angle > 0.25 && (
          <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#1e293b">
            {density === 'expert' ? `${label}: ${pct}%` : `${pct}%`}
          </text>
        )}
      </g>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ display: 'block', flexShrink: 0 }}>
        {series.values.map((v, i) =>
          slice(v, colors[i] ?? paletteColor(i), diagram.labels[i] ?? `#${i + 1}`, i),
        )}
      </svg>
      {density !== 'executive' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {series.values.map((v, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#475569' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: colors[i] ?? paletteColor(i), display: 'inline-block', flexShrink: 0 }} />
              <span>{diagram.labels[i] ?? `Series ${i + 1}`}</span>
              <span style={{ color: '#94a3b8' }}>
                {v}{diagram.unit ?? ''} ({((v / total) * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChartBlock({
  diagram,
  density,
}: {
  diagram: ChartDiagram;
  density: 'executive' | 'operator' | 'expert';
}) {
  const colors = useMemo(() => resolveColors(diagram.series), [diagram.series]);

  return (
    <div style={CARD_STYLE}>
      {diagram.title && <div style={TITLE_STYLE}>{diagram.title}</div>}
      <div style={{ overflowX: 'auto' }}>
        {diagram.chartType === 'bar' && (
          <BarChart diagram={diagram} colors={colors} density={density} />
        )}
        {diagram.chartType === 'line' && (
          <LineAreaChart diagram={diagram} colors={colors} density={density} area={false} />
        )}
        {diagram.chartType === 'area' && (
          <LineAreaChart diagram={diagram} colors={colors} density={density} area={true} />
        )}
        {diagram.chartType === 'pie' && (
          <PieChart diagram={diagram} colors={colors} density={density} />
        )}
      </div>

      {/* Legend for bar/line/area with multiple series */}
      {diagram.chartType !== 'pie' && diagram.series.length > 1 && density !== 'executive' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>
          {diagram.series.map((s, si) => (
            <span key={si} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: '#475569' }}>
              <span style={{ width: 12, height: 4, borderRadius: 2, background: colors[si], display: 'inline-block' }} />
              {s.name}
            </span>
          ))}
        </div>
      )}

      {diagram.caption && density !== 'executive' && (
        <div style={CAPTION_STYLE}>{diagram.caption}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DiagramBlock dispatcher
// ─────────────────────────────────────────────────────────────────────────────

function DiagramBlock({
  payload,
  density,
  onExplain,
  groupColorMap,
}: {
  payload: DiagramPayload;
  density: 'executive' | 'operator' | 'expert';
  onExplain?: (id: string) => void;
  groupColorMap: Map<string, string>;
}) {
  if (payload.kind === 'mermaid') {
    return <MermaidBlock diagram={payload} density={density} />;
  }
  if (payload.kind === 'graph') {
    return <GraphBlock diagram={payload} density={density} groupColorMap={groupColorMap} onExplain={onExplain} />;
  }
  if (payload.kind === 'chart') {
    return <ChartBlock diagram={payload} density={density} />;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main DiagramRenderer
// ─────────────────────────────────────────────────────────────────────────────

export function DiagramRenderer({ data, density = 'operator', onExplain }: DiagramRendererProps) {
  const parsed = DiagramDataSchema.safeParse(data);

  if (!parsed.success) {
    return (
      <div style={{ padding: '1rem', color: '#dc2626', fontSize: '0.85rem', background: '#fef2f2', borderRadius: '0.5rem' }}>
        <strong>DiagramRenderer:</strong> Invalid data — {parsed.error.issues[0]?.message ?? 'unknown error'}
      </div>
    );
  }

  const diagramData = parsed.data;
  // In executive density, only the first diagram is shown
  const diagrams = density === 'executive' ? diagramData.diagrams.slice(0, 1) : diagramData.diagrams;

  // Shared group→colour map across all graph diagrams in this panel
  const groupColorMap = useMemo(() => new Map<string, string>(), []);

  return (
    <div style={{ width: '100%' }}>
      {/* Section heading */}
      {diagramData.title && (
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
          {diagramData.title}
        </div>
      )}
      {diagramData.description && density !== 'executive' && (
        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem', lineHeight: 1.5 }}>
          {diagramData.description}
        </div>
      )}

      {diagrams.map((payload, i) => (
        <DiagramBlock
          key={(payload as { id?: string }).id ?? i}
          payload={payload}
          density={density}
          onExplain={onExplain}
          groupColorMap={groupColorMap}
        />
      ))}
    </div>
  );
}
