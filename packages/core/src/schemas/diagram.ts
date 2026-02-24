import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Diagram Schema
//
// The diagram intent type renders structured visualisations. Three sub-kinds
// are supported:
//
//   mermaid — raw Mermaid.js markup (flowchart, sequence, ER, Gantt, …)
//   graph   — nodes + edges network/dependency diagram (custom SVG renderer)
//   chart   — categorical data visualisation: bar, line, pie, area
//
// Density mapping:
//   executive — simplified view: title + primary diagram only, no metadata
//   operator  — all diagrams with legends and labels
//   expert    — full metadata, node/edge attributes, raw markup toggle
// ─────────────────────────────────────────────────────────────────────────────

// ── Mermaid ───────────────────────────────────────────────────────────────────

export const MermaidDiagramSchema = z.object({
  kind: z.literal('mermaid'),
  /** Raw Mermaid.js markup (e.g. "flowchart LR\n  A --> B") */
  markup: z.string(),
  /** Optional caption shown below the rendered diagram */
  caption: z.string().optional(),
  /** Diagram title shown above the render area */
  title: z.string().optional(),
  /** Unique identifier within the parent DiagramData */
  id: z.string().optional(),
});

export type MermaidDiagram = z.infer<typeof MermaidDiagramSchema>;

// ── Graph (nodes + edges) ─────────────────────────────────────────────────────

export const GraphNodeSchema = z.object({
  /** Unique node id (used by edges) */
  id: z.string(),
  /** Display label */
  label: z.string(),
  /**
   * Logical group for colour-coding.
   * E.g. "frontend", "backend", "database"
   */
  group: z.string().optional(),
  /** Shape hint for the renderer */
  shape: z.enum(['circle', 'square', 'diamond', 'hexagon']).default('circle'),
  /** CSS / hex colour override for this node */
  color: z.string().optional(),
  /** Badge or icon shown inside the node */
  icon: z.string().optional(),
  /** Key-value metadata shown in expert density */
  metadata: z.record(z.string(), z.unknown()).optional(),
  /** Links to an explainability entry in the parent IntentPayload */
  explainElementId: z.string().optional(),
});

export type GraphNode = z.infer<typeof GraphNodeSchema>;

export const GraphEdgeSchema = z.object({
  /** Source node id */
  source: z.string(),
  /** Target node id */
  target: z.string(),
  /** Edge label shown alongside the line */
  label: z.string().optional(),
  /** Relative weight (line thickness) */
  weight: z.number().min(0.1).max(10).default(1),
  /** Whether the edge is directed (arrowhead drawn on target end) */
  directed: z.boolean().default(true),
  /** Line style */
  style: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
  /** CSS / hex colour for the edge */
  color: z.string().optional(),
});

export type GraphEdge = z.infer<typeof GraphEdgeSchema>;

export const GraphDiagramSchema = z.object({
  kind: z.literal('graph'),
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  /** Optional caption */
  caption: z.string().optional(),
  /** Optional title */
  title: z.string().optional(),
  /**
   * Layout algorithm hint.
   * force    — spring-like automatic positioning
   * hierarchy — top-down directed layout
   * radial   — nodes arranged on concentric circles
   * @default 'force'
   */
  layout: z.enum(['force', 'hierarchy', 'radial']).default('force'),
  /** Unique identifier within the parent DiagramData */
  id: z.string().optional(),
});

export type GraphDiagram = z.infer<typeof GraphDiagramSchema>;

// ── Chart ─────────────────────────────────────────────────────────────────────

export const ChartSeriesSchema = z.object({
  /** Series name shown in the legend */
  name: z.string(),
  /** Data points, one per label */
  values: z.array(z.number()),
  /** CSS / hex colour for this series */
  color: z.string().optional(),
});

export type ChartSeries = z.infer<typeof ChartSeriesSchema>;

export const ChartDiagramSchema = z.object({
  kind: z.literal('chart'),
  /** Chart type */
  chartType: z.enum(['bar', 'line', 'pie', 'area']),
  /** Optional chart title */
  title: z.string().optional(),
  /**
   * Category labels (x-axis for bar/line/area; segment labels for pie).
   * Must align with each series' values array.
   */
  labels: z.array(z.string()),
  /** One or more data series */
  series: z.array(ChartSeriesSchema),
  /** Optional caption below the chart */
  caption: z.string().optional(),
  /** Unit appended to tooltip values (e.g. "%", "ms", "GB") */
  unit: z.string().optional(),
  /** Unique identifier within the parent DiagramData */
  id: z.string().optional(),
  /**
   * Whether the y-axis should start from 0.
   * @default true
   */
  yZeroBased: z.boolean().default(true),
});

export type ChartDiagram = z.infer<typeof ChartDiagramSchema>;

// ── Union ─────────────────────────────────────────────────────────────────────

export const DiagramPayloadSchema = z.discriminatedUnion('kind', [
  MermaidDiagramSchema,
  GraphDiagramSchema,
  ChartDiagramSchema,
]);

export type DiagramPayload = z.infer<typeof DiagramPayloadSchema>;

// ── Top-level DiagramData ─────────────────────────────────────────────────────

export const DiagramDataSchema = z.object({
  /** Optional section heading */
  title: z.string().optional(),
  /** Optional description rendered above the diagrams */
  description: z.string().optional(),
  /**
   * One or more diagrams to display.
   * In executive density only the first is shown.
   */
  diagrams: z.array(DiagramPayloadSchema).min(1),
});

export type DiagramData = z.infer<typeof DiagramDataSchema>;
