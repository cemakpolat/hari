import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Tree / Hierarchy Schema
//
// The tree intent type renders hierarchical data as an interactive tree view.
// Use it for org charts, file system navigation, taxonomy browsers, permission
// hierarchies, dependency graphs, or any nested parent-child structure.
//
// Density mapping:
//   executive — top 2 levels only, collapsed by default, badge counts
//   operator  — interactive expand/collapse, icons, labels, optional metadata
//   expert    — full depth, all metadata, path breadcrumb, search filter
// ─────────────────────────────────────────────────────────────────────────────

// TreeNode is recursive — z.lazy is required.
export type TreeNode = {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  badge?: string | number;
  color?: string;
  status?: 'active' | 'inactive' | 'warning' | 'error';
  href?: string;
  metadata?: Record<string, unknown>;
  explainElementId?: string;
  children?: TreeNode[];
  defaultExpanded?: boolean;
};

export const TreeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
  z.object({
    /** Unique node identifier */
    id: z.string(),
    /** Display label for the node */
    label: z.string(),
    /** Optional subtitle / description */
    description: z.string().optional(),
    /** Emoji or short symbol shown before the label */
    icon: z.string().optional(),
    /** Badge text / count shown after the label (e.g. "12", "new") */
    badge: z.union([z.string(), z.number()]).optional(),
    /** Accent colour for this node's icon/badge (CSS colour string) */
    color: z.string().optional(),
    /** Status indicator shown as a coloured dot */
    status: z.enum(['active', 'inactive', 'warning', 'error']).optional(),
    /** Optional URL — renders the label as a link */
    href: z.string().url().optional(),
    /** Extra key-value metadata shown in expert density */
    metadata: z.record(z.string(), z.unknown()).optional(),
    /** Links to an explainability entry in the parent IntentPayload */
    explainElementId: z.string().optional(),
    /** Child nodes (recursive) */
    children: z.array(z.lazy(() => TreeNodeSchema)).optional(),
    /** Whether this node starts expanded. Defaults to false except root. */
    defaultExpanded: z.boolean().optional(),
  })
);

export const TreeDataSchema = z.object({
  /** Optional heading rendered above the tree */
  title: z.string().optional(),
  /** Root nodes of the tree (multiple roots are rendered as siblings) */
  nodes: z.array(TreeNodeSchema),
  /**
   * Whether to show connecting lines between nodes.
   * @default true
   */
  showLines: z.boolean().default(true),
  /**
   * Whether to allow text search / filter.
   * @default true
   */
  searchable: z.boolean().default(true),
  /**
   * Whether all nodes start expanded by default.
   * Individual nodes can override via `defaultExpanded`.
   * @default false
   */
  defaultExpandAll: z.boolean().default(false),
  /**
   * Maximum depth rendered in executive density.
   * @default 2
   */
  executiveDepth: z.number().int().positive().default(2),
});

export type TreeData = z.infer<typeof TreeDataSchema>;
