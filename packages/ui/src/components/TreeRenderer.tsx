import React, { useMemo, useState, useCallback } from 'react';
import { TreeDataSchema, type TreeNode } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// TreeRenderer
//
// Renders hierarchical data as an interactive expand/collapse tree.
// Supports density-aware presentation:
//   executive — top N levels only (collapsed, badge counts only)
//   operator  — interactive expand/collapse with icons, labels, status dots
//   expert    — full depth, metadata, path breadcrumb, search/filter
// ─────────────────────────────────────────────────────────────────────────────

export interface TreeRendererProps {
  data: unknown;
  density?: 'executive' | 'operator' | 'expert';
  onExplain?: (elementId: string) => void;
}

// ── Status dot colours ─────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active:   '#22c55e',
  inactive: '#9ca3af',
  warning:  '#f59e0b',
  error:    '#ef4444',
};

// ── Utility: count all descendants ────────────────────────────────────────────

function countDescendants(node: TreeNode): number {
  if (!node.children || node.children.length === 0) return 0;
  return node.children.reduce((acc, c) => acc + 1 + countDescendants(c), 0);
}

// ── Utility: search — does a node or any descendant match the query? ──────────

function nodeMatchesSearch(node: TreeNode, query: string): boolean {
  const q = query.toLowerCase();
  if (node.label.toLowerCase().includes(q)) return true;
  if (node.description?.toLowerCase().includes(q)) return true;
  if (node.children?.some((c) => nodeMatchesSearch(c, query))) return true;
  return false;
}

// ── Utility: collect path to a node id ────────────────────────────────────────

function findPath(nodes: TreeNode[], targetId: string, path: string[] = []): string[] | null {
  for (const node of nodes) {
    const newPath = [...path, node.label];
    if (node.id === targetId) return newPath;
    if (node.children) {
      const found = findPath(node.children, targetId, newPath);
      if (found) return found;
    }
  }
  return null;
}

// ── Single tree node row ───────────────────────────────────────────────────────

interface TreeNodeRowProps {
  node: TreeNode;
  depth: number;
  maxDepth: number | null;         // null = no limit
  density: 'executive' | 'operator' | 'expert';
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  searchQuery: string;
  onExplain?: (id: string) => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
}

function TreeNodeRow({
  node,
  depth,
  maxDepth,
  density,
  expandedIds,
  toggleExpand,
  searchQuery,
  onExplain,
  onSelect,
  selectedId,
}: TreeNodeRowProps) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const isLeaf = !hasChildren;
  const atMaxDepth = maxDepth !== null && depth >= maxDepth;
  const canExpand = hasChildren && !atMaxDepth;
  const descendantCount = useMemo(() => countDescendants(node), [node]);

  // In search mode, skip nodes that don't match
  if (searchQuery && !nodeMatchesSearch(node, searchQuery)) return null;

  const indentPx = depth * (density === 'executive' ? 12 : 20);

  const isHighlighted = searchQuery && node.label.toLowerCase().includes(searchQuery.toLowerCase());

  return (
    <>
      <div
        role="treeitem"
        aria-expanded={canExpand ? isExpanded : undefined}
        aria-selected={isSelected}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          paddingLeft: `${indentPx + 4}px`,
          paddingRight: '0.5rem',
          paddingTop: '0.25rem',
          paddingBottom: '0.25rem',
          borderRadius: '0.375rem',
          cursor: canExpand ? 'pointer' : 'default',
          background: isSelected
            ? '#eff6ff'
            : isHighlighted
            ? '#fef9c3'
            : 'transparent',
          border: isSelected ? '1px solid #93c5fd' : '1px solid transparent',
          userSelect: 'none',
        }}
        onClick={() => {
          if (canExpand) toggleExpand(node.id);
          onSelect(node.id);
        }}
      >
        {/* Expand/collapse toggle */}
        <span style={{ width: '1rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.7rem', flexShrink: 0 }}>
          {canExpand
            ? isExpanded ? '▾' : '▸'
            : isLeaf || atMaxDepth
            ? '·'
            : ''}
        </span>

        {/* Status dot */}
        {node.status && (
          <span
            title={node.status}
            style={{
              width: '0.45rem',
              height: '0.45rem',
              borderRadius: '50%',
              background: STATUS_COLORS[node.status] ?? '#9ca3af',
              flexShrink: 0,
              display: 'inline-block',
            }}
            aria-label={`Status: ${node.status}`}
          />
        )}

        {/* Icon */}
        {node.icon && (
          <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>{node.icon}</span>
        )}

        {/* Label */}
        <span
          style={{
            fontSize: density === 'executive' ? '0.8rem' : '0.875rem',
            fontWeight: depth === 0 ? 600 : 400,
            color: node.color ?? '#111827',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {node.href ? (
            <a href={node.href} style={{ color: 'inherit', textDecoration: 'underline dotted' }} target="_blank" rel="noopener noreferrer">
              {node.label}
            </a>
          ) : (
            node.label
          )}
        </span>

        {/* Badge */}
        {node.badge !== undefined && (
          <span style={{
            fontSize: '0.65rem',
            fontWeight: 600,
            background: node.color ? node.color + '22' : '#e5e7eb',
            color: node.color ?? '#374151',
            borderRadius: '99px',
            padding: '0 0.4rem',
            flexShrink: 0,
          }}>
            {node.badge}
          </span>
        )}

        {/* Descendant count badge (executive only, when collapsed) */}
        {density === 'executive' && hasChildren && !isExpanded && descendantCount > 0 && (
          <span style={{ fontSize: '0.6rem', color: '#9ca3af', flexShrink: 0 }}>
            ({descendantCount})
          </span>
        )}

        {/* Explain button */}
        {density === 'expert' && node.explainElementId && (
          <button
            onClick={(e) => { e.stopPropagation(); onExplain?.(node.explainElementId!); }}
            title="Explain"
            style={{ fontSize: '0.65rem', background: 'none', border: '1px solid #d1d5db', borderRadius: '3px', padding: '0 4px', cursor: 'pointer', color: '#6b7280', flexShrink: 0 }}
          >
            ?
          </button>
        )}
      </div>

      {/* Metadata row (expert density only) */}
      {density === 'expert' && isSelected && node.metadata && Object.keys(node.metadata).length > 0 && (
        <div style={{
          paddingLeft: `${indentPx + 36}px`,
          paddingBottom: '0.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.3rem',
        }}>
          {Object.entries(node.metadata).map(([k, v]) => (
            <span key={k} style={{ fontSize: '0.7rem', background: '#f1f5f9', color: '#475569', borderRadius: '3px', padding: '1px 6px' }}>
              {k}: {String(v)}
            </span>
          ))}
        </div>
      )}

      {/* Description row (operator + expert, when selected) */}
      {density !== 'executive' && isSelected && node.description && (
        <div style={{
          paddingLeft: `${indentPx + 36}px`,
          paddingBottom: '0.25rem',
          fontSize: '0.75rem',
          color: '#6b7280',
        }}>
          {node.description}
        </div>
      )}

      {/* Children */}
      {isExpanded && !atMaxDepth && node.children?.map((child) => (
        <TreeNodeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          maxDepth={maxDepth}
          density={density}
          expandedIds={expandedIds}
          toggleExpand={toggleExpand}
          searchQuery={searchQuery}
          onExplain={onExplain}
          onSelect={onSelect}
          selectedId={selectedId}
        />
      ))}
    </>
  );
}

// ── Initialise expanded ids from defaults ──────────────────────────────────────

function collectDefaultExpanded(nodes: TreeNode[], depth: number, maxDepth: number | null, defaultExpandAll: boolean): Set<string> {
  const ids = new Set<string>();

  function walk(node: TreeNode, d: number) {
    if (maxDepth !== null && d >= maxDepth) return;
    const shouldExpand = defaultExpandAll || node.defaultExpanded || d === 0;
    if (shouldExpand && (node.children?.length ?? 0) > 0) {
      ids.add(node.id);
    }
    node.children?.forEach((c) => walk(c, d + 1));
  }

  nodes.forEach((n) => walk(n, 0));
  return ids;
}

// ── Main renderer ─────────────────────────────────────────────────────────────

export function TreeRenderer({ data, density = 'operator', onExplain }: TreeRendererProps) {
  const parsed = useMemo(() => {
    const result = TreeDataSchema.safeParse(data);
    return result.success ? result.data : null;
  }, [data]);

  const maxDepth = density === 'executive' ? (parsed?.executiveDepth ?? 2) : null;

  const initialExpanded = useMemo(() => {
    if (!parsed) return new Set<string>();
    return collectDefaultExpanded(parsed.nodes, 0, maxDepth, parsed.defaultExpandAll);
  }, [parsed, maxDepth]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(initialExpanded);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (!parsed) return;
    const all = new Set<string>();
    function walk(node: TreeNode) {
      if ((node.children?.length ?? 0) > 0) all.add(node.id);
      node.children?.forEach(walk);
    }
    parsed.nodes.forEach(walk);
    setExpandedIds(all);
  }, [parsed]);

  const collapseAll = useCallback(() => setExpandedIds(new Set()), []);

  // Breadcrumb path to selected node
  const breadcrumb = useMemo(() => {
    if (!selectedId || !parsed) return null;
    return findPath(parsed.nodes, selectedId);
  }, [selectedId, parsed]);

  if (!parsed) {
    return (
      <div style={{ padding: '1rem', color: '#ef4444', fontSize: '0.875rem' }}>
        Invalid tree data.
      </div>
    );
  }

  const { title, nodes, showLines, searchable } = parsed;
  const showSearch = searchable && density === 'expert';
  const totalNodes = nodes.reduce((a, n) => a + 1 + countDescendants(n), 0);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        {title && (
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', margin: 0 }}>{title}</h2>
        )}
        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', marginLeft: 'auto' }}>
          {density !== 'executive' && (
            <>
              <button
                onClick={expandAll}
                style={{ fontSize: '0.7rem', background: 'none', border: '1px solid #d1d5db', borderRadius: '3px', padding: '2px 8px', cursor: 'pointer', color: '#374151' }}
              >
                Expand all
              </button>
              <button
                onClick={collapseAll}
                style={{ fontSize: '0.7rem', background: 'none', border: '1px solid #d1d5db', borderRadius: '3px', padding: '2px 8px', cursor: 'pointer', color: '#374151' }}
              >
                Collapse all
              </button>
            </>
          )}
          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{totalNodes} nodes</span>
        </div>
      </div>

      {/* Search bar (expert density) */}
      {showSearch && (
        <div style={{ marginBottom: '0.625rem' }}>
          <input
            type="search"
            placeholder="Filter nodes…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search tree nodes"
            style={{
              width: '100%',
              padding: '0.35rem 0.6rem',
              fontSize: '0.8rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {/* Breadcrumb (expert density, when node selected) */}
      {density === 'expert' && breadcrumb && breadcrumb.length > 1 && (
        <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginBottom: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.15rem', alignItems: 'center' }}>
          {breadcrumb.map((seg, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span>/</span>}
              <span style={{ color: i === breadcrumb.length - 1 ? '#374151' : '#9ca3af' }}>{seg}</span>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Tree */}
      <div
        role="tree"
        aria-label={title ?? 'Tree'}
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '0.5rem',
          padding: '0.375rem',
          background: '#fafafa',
          position: 'relative',
        }}
      >
        {/* Vertical connector lines */}
        {showLines && nodes.length > 0 && (
          <div style={{
            position: 'absolute',
            left: '1.1rem',
            top: '0.75rem',
            bottom: '0.75rem',
            width: '1px',
            background: '#e5e7eb',
            pointerEvents: 'none',
          }} />
        )}

        {nodes.map((node) => (
          <TreeNodeRow
            key={node.id}
            node={node}
            depth={0}
            maxDepth={maxDepth}
            density={density}
            expandedIds={expandedIds}
            toggleExpand={toggleExpand}
            searchQuery={searchQuery}
            onExplain={onExplain}
            onSelect={setSelectedId}
            selectedId={selectedId}
          />
        ))}

        {nodes.length === 0 && (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: '1.5rem', fontSize: '0.875rem' }}>
            No nodes to display.
          </div>
        )}
      </div>

      {/* Legend for status colours (expert density) */}
      {density === 'expert' && (
        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <span key={status} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', color: '#6b7280' }}>
              <span style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: color, display: 'inline-block' }} />
              {status}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
