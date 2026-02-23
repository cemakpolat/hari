// ─────────────────────────────────────────────────────────────────────────────
// Schema tests — Timeline, Workflow, Kanban, Calendar, Tree
//
// Covers schema validation, default application, and boundary conditions for
// the five intent-type schemas added in v0.2.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';

import {
  TimelineEventSchema,
  TimelineDataSchema,
} from '../schemas/timeline';

import {
  WorkflowStepSchema,
  WorkflowDataSchema,
} from '../schemas/workflow';

import {
  KanbanCardSchema,
  KanbanColumnSchema,
  KanbanDataSchema,
} from '../schemas/kanban';

import {
  CalendarEventSchema,
  CalendarDataSchema,
} from '../schemas/calendar';

import {
  TreeNodeSchema,
  TreeDataSchema,
} from '../schemas/tree';

// ─────────────────────────────────────────────────────────────────────────────
// TimelineEventSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('TimelineEventSchema', () => {
  const MINIMAL: unknown = {
    id: 'ev-1',
    title: 'Deploy v1.0',
    timestamp: '2026-02-23T10:00:00',
  };

  it('parses a minimal event', () => {
    expect(TimelineEventSchema.safeParse(MINIMAL).success).toBe(true);
  });

  it('parses a full event', () => {
    const full = {
      ...MINIMAL,
      description: 'Production deploy',
      endTimestamp: '2026-02-23T10:15:00',
      category: 'deploy',
      status: 'completed',
      icon: '🚀',
      metadata: { version: 'v1.0.0', deployed_by: 'alice' },
      explainElementId: 'exp-1',
    };
    const result = TimelineEventSchema.safeParse(full);
    expect(result.success).toBe(true);
  });

  it('accepts all valid statuses', () => {
    const statuses = ['completed', 'in_progress', 'pending', 'cancelled', 'failed'];
    for (const status of statuses) {
      expect(TimelineEventSchema.safeParse({ ...MINIMAL, status }).success).toBe(true);
    }
  });

  it('rejects unknown status', () => {
    expect(TimelineEventSchema.safeParse({ ...MINIMAL, status: 'unknown' }).success).toBe(false);
  });

  it('rejects missing required fields', () => {
    expect(TimelineEventSchema.safeParse({ title: 'X', timestamp: '2026-01-01' }).success).toBe(false);
    expect(TimelineEventSchema.safeParse({ id: 'x', timestamp: '2026-01-01' }).success).toBe(false);
    expect(TimelineEventSchema.safeParse({ id: 'x', title: 'X' }).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TimelineDataSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('TimelineDataSchema', () => {
  const EVENT = { id: 'ev-1', title: 'Deploy', timestamp: '2026-02-23T10:00:00' };

  it('parses with defaults', () => {
    const result = TimelineDataSchema.parse({ events: [EVENT] });
    expect(result.direction).toBe('vertical');
    expect(result.showTimestamps).toBe(true);
    expect(result.executiveCap).toBe(5);
    expect(result.groupBy).toBeUndefined();
  });

  it('accepts all direction values', () => {
    expect(TimelineDataSchema.safeParse({ events: [], direction: 'vertical' }).success).toBe(true);
    expect(TimelineDataSchema.safeParse({ events: [], direction: 'horizontal' }).success).toBe(true);
  });

  it('rejects invalid direction', () => {
    expect(TimelineDataSchema.safeParse({ events: [], direction: 'diagonal' }).success).toBe(false);
  });

  it('accepts all groupBy values', () => {
    const valid = ['day', 'week', 'month', 'year', 'category'];
    for (const groupBy of valid) {
      expect(TimelineDataSchema.safeParse({ events: [], groupBy }).success).toBe(true);
    }
  });

  it('rejects invalid groupBy value', () => {
    expect(TimelineDataSchema.safeParse({ events: [], groupBy: 'decade' }).success).toBe(false);
  });

  it('rejects non-positive executiveCap', () => {
    expect(TimelineDataSchema.safeParse({ events: [], executiveCap: 0 }).success).toBe(false);
    expect(TimelineDataSchema.safeParse({ events: [], executiveCap: -1 }).success).toBe(false);
  });

  it('accepts an optional title', () => {
    const result = TimelineDataSchema.parse({ events: [], title: 'My Timeline' });
    expect(result.title).toBe('My Timeline');
  });

  it('accepts empty events array', () => {
    expect(TimelineDataSchema.safeParse({ events: [] }).success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WorkflowStepSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('WorkflowStepSchema', () => {
  const MINIMAL_STEP: unknown = {
    id: 'step-1',
    title: 'Introduction',
  };

  it('parses a minimal step with defaults', () => {
    const result = WorkflowStepSchema.parse(MINIMAL_STEP);
    expect(result.status).toBe('pending');
    expect(result.type).toBe('info');
    expect(result.fields).toEqual([]);
    expect(result.reviewItems).toEqual([]);
    expect(result.skippable).toBe(false);
  });

  it('accepts all valid step types', () => {
    for (const type of ['info', 'form', 'confirmation', 'review']) {
      expect(WorkflowStepSchema.safeParse({ ...MINIMAL_STEP, type }).success).toBe(true);
    }
  });

  it('accepts all valid step statuses', () => {
    for (const status of ['pending', 'in_progress', 'completed', 'skipped', 'failed']) {
      expect(WorkflowStepSchema.safeParse({ ...MINIMAL_STEP, status }).success).toBe(true);
    }
  });

  it('rejects unknown type', () => {
    expect(WorkflowStepSchema.safeParse({ ...MINIMAL_STEP, type: 'wizard' }).success).toBe(false);
  });

  it('parses review items', () => {
    const step = {
      ...MINIMAL_STEP,
      type: 'review',
      reviewItems: [{ label: 'Name', value: 'foo', highlight: true }],
    };
    const result = WorkflowStepSchema.parse(step);
    expect(result.reviewItems).toHaveLength(1);
    expect(result.reviewItems[0].highlight).toBe(true);
  });

  it('reviewItem highlight defaults to false', () => {
    const step = {
      ...MINIMAL_STEP,
      type: 'review',
      reviewItems: [{ label: 'X', value: 'Y' }],
    };
    const result = WorkflowStepSchema.parse(step);
    expect(result.reviewItems[0].highlight).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WorkflowDataSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('WorkflowDataSchema', () => {
  const STEP = { id: 's1', title: 'Step 1' };

  it('parses with defaults', () => {
    const result = WorkflowDataSchema.parse({ steps: [STEP] });
    expect(result.currentStepIndex).toBe(0);
    expect(result.allowSkipAhead).toBe(false);
    expect(result.finishLabel).toBe('Finish');
  });

  it('accepts an optional title', () => {
    const result = WorkflowDataSchema.parse({ steps: [], title: 'My Workflow' });
    expect(result.title).toBe('My Workflow');
  });

  it('rejects negative currentStepIndex', () => {
    expect(WorkflowDataSchema.safeParse({ steps: [], currentStepIndex: -1 }).success).toBe(false);
  });

  it('accepts custom finishLabel', () => {
    const result = WorkflowDataSchema.parse({ steps: [], finishLabel: 'Launch' });
    expect(result.finishLabel).toBe('Launch');
  });

  it('accepts empty steps array', () => {
    expect(WorkflowDataSchema.safeParse({ steps: [] }).success).toBe(true);
  });

  it('rejects missing steps', () => {
    expect(WorkflowDataSchema.safeParse({}).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// KanbanCardSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('KanbanCardSchema', () => {
  const MINIMAL: unknown = { id: 'card-1', title: 'Fix bug' };

  it('parses a minimal card with defaults', () => {
    const result = KanbanCardSchema.parse(MINIMAL);
    expect(result.tags).toEqual([]);
  });

  it('accepts all priority values', () => {
    for (const priority of ['critical', 'high', 'medium', 'low']) {
      expect(KanbanCardSchema.safeParse({ ...MINIMAL, priority }).success).toBe(true);
    }
  });

  it('rejects unknown priority', () => {
    expect(KanbanCardSchema.safeParse({ ...MINIMAL, priority: 'urgent' }).success).toBe(false);
  });

  it('parses all optional fields', () => {
    const full = {
      ...MINIMAL,
      description: 'Fix the login bug',
      priority: 'high',
      assignee: 'alice',
      dueDate: '2026-03-01',
      tags: ['bug', 'auth'],
      metadata: { jira: 'AUTH-12', story_points: 3 },
      explainElementId: 'exp-card-1',
    };
    const result = KanbanCardSchema.safeParse(full);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toHaveLength(2);
    }
  });

  it('rejects missing id', () => {
    expect(KanbanCardSchema.safeParse({ title: 'X' }).success).toBe(false);
  });

  it('rejects missing title', () => {
    expect(KanbanCardSchema.safeParse({ id: 'x' }).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// KanbanColumnSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('KanbanColumnSchema', () => {
  it('parses a minimal column', () => {
    const result = KanbanColumnSchema.safeParse({ id: 'col-1', title: 'Backlog', cards: [] });
    expect(result.success).toBe(true);
  });

  it('accepts optional wipLimit and color', () => {
    const result = KanbanColumnSchema.parse({ id: 'col-1', title: 'Doing', cards: [], wipLimit: 3, color: '#6366f1' });
    expect(result.wipLimit).toBe(3);
    expect(result.color).toBe('#6366f1');
  });

  it('rejects non-positive wipLimit', () => {
    expect(KanbanColumnSchema.safeParse({ id: 'c', title: 'T', cards: [], wipLimit: 0 }).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// KanbanDataSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('KanbanDataSchema', () => {
  it('parses with defaults', () => {
    const result = KanbanDataSchema.parse({ columns: [] });
    expect(result.showCardCount).toBe(true);
    expect(result.showWipLimits).toBe(true);
  });

  it('accepts optional board title', () => {
    const result = KanbanDataSchema.parse({ columns: [], title: 'Sprint 17' });
    expect(result.title).toBe('Sprint 17');
  });

  it('stores nested cards inside columns', () => {
    const data = {
      columns: [
        {
          id: 'todo',
          title: 'To Do',
          cards: [{ id: 'c1', title: 'Task 1' }],
        },
      ],
    };
    const result = KanbanDataSchema.parse(data);
    expect(result.columns[0].cards).toHaveLength(1);
  });

  it('rejects missing columns', () => {
    expect(KanbanDataSchema.safeParse({}).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CalendarEventSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('CalendarEventSchema', () => {
  const MINIMAL: unknown = {
    id: 'evt-1',
    title: 'Team standup',
    start: '2026-02-23T09:00:00',
    end: '2026-02-23T09:15:00',
  };

  it('parses a minimal event with defaults', () => {
    const result = CalendarEventSchema.parse(MINIMAL);
    expect(result.allDay).toBe(false);
    expect(result.status).toBe('confirmed');
    expect(result.attendees).toEqual([]);
  });

  it('parses an all-day event', () => {
    const ev = { ...MINIMAL, start: '2026-02-23', end: '2026-02-23', allDay: true };
    expect(CalendarEventSchema.safeParse(ev).success).toBe(true);
  });

  it('accepts all valid statuses', () => {
    for (const status of ['confirmed', 'tentative', 'cancelled']) {
      expect(CalendarEventSchema.safeParse({ ...MINIMAL, status }).success).toBe(true);
    }
  });

  it('rejects invalid status', () => {
    expect(CalendarEventSchema.safeParse({ ...MINIMAL, status: 'maybe' }).success).toBe(false);
  });

  it('parses all optional fields', () => {
    const full = {
      ...MINIMAL,
      description: 'Daily standup',
      allDay: false,
      category: 'meeting',
      color: '#0ea5e9',
      attendees: ['alice@example.com', 'bob@example.com'],
      location: 'Zoom',
      status: 'confirmed',
      recurrence: 'Every weekday',
      metadata: { jira: 'MTG-1' },
      explainElementId: 'exp-evt-1',
    };
    const result = CalendarEventSchema.safeParse(full);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.attendees).toHaveLength(2);
    }
  });

  it('rejects missing id, title, start, or end', () => {
    expect(CalendarEventSchema.safeParse({ title: 'X', start: '2026-01-01', end: '2026-01-01' }).success).toBe(false);
    expect(CalendarEventSchema.safeParse({ id: 'x', start: '2026-01-01', end: '2026-01-01' }).success).toBe(false);
    expect(CalendarEventSchema.safeParse({ id: 'x', title: 'X', end: '2026-01-01' }).success).toBe(false);
    expect(CalendarEventSchema.safeParse({ id: 'x', title: 'X', start: '2026-01-01' }).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CalendarDataSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('CalendarDataSchema', () => {
  it('parses with defaults', () => {
    const result = CalendarDataSchema.parse({ events: [] });
    expect(result.view).toBe('month');
    expect(result.weekStartsOn).toBe(1);
    expect(result.executiveCap).toBe(3);
    expect(result.focusDate).toBeUndefined();
  });

  it('accepts all view modes', () => {
    for (const view of ['month', 'week', 'agenda']) {
      expect(CalendarDataSchema.safeParse({ events: [], view }).success).toBe(true);
    }
  });

  it('rejects invalid view mode', () => {
    expect(CalendarDataSchema.safeParse({ events: [], view: 'day' }).success).toBe(false);
  });

  it('accepts weekStartsOn 0 and 1', () => {
    expect(CalendarDataSchema.safeParse({ events: [], weekStartsOn: 0 }).success).toBe(true);
    expect(CalendarDataSchema.safeParse({ events: [], weekStartsOn: 1 }).success).toBe(true);
  });

  it('rejects weekStartsOn outside 0-1', () => {
    expect(CalendarDataSchema.safeParse({ events: [], weekStartsOn: 2 }).success).toBe(false);
    expect(CalendarDataSchema.safeParse({ events: [], weekStartsOn: -1 }).success).toBe(false);
  });

  it('rejects non-positive executiveCap', () => {
    expect(CalendarDataSchema.safeParse({ events: [], executiveCap: 0 }).success).toBe(false);
  });

  it('accepts optional title and focusDate', () => {
    const result = CalendarDataSchema.parse({ events: [], title: 'My Calendar', focusDate: '2026-03-01' });
    expect(result.title).toBe('My Calendar');
    expect(result.focusDate).toBe('2026-03-01');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TreeNodeSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('TreeNodeSchema', () => {
  const MINIMAL: unknown = { id: 'node-1', label: 'Root' };

  it('parses a minimal node', () => {
    expect(TreeNodeSchema.safeParse(MINIMAL).success).toBe(true);
  });

  it('accepts all valid statuses', () => {
    for (const status of ['active', 'inactive', 'warning', 'error']) {
      expect(TreeNodeSchema.safeParse({ ...MINIMAL, status }).success).toBe(true);
    }
  });

  it('rejects invalid status', () => {
    expect(TreeNodeSchema.safeParse({ ...MINIMAL, status: 'unknown' }).success).toBe(false);
  });

  it('accepts string badge', () => {
    expect(TreeNodeSchema.safeParse({ ...MINIMAL, badge: 'lead' }).success).toBe(true);
  });

  it('accepts number badge', () => {
    expect(TreeNodeSchema.safeParse({ ...MINIMAL, badge: 42 }).success).toBe(true);
  });

  it('supports recursive children', () => {
    const nested = {
      id: 'root',
      label: 'Root',
      children: [
        {
          id: 'child-1',
          label: 'Child',
          children: [
            { id: 'grandchild-1', label: 'Grandchild' },
          ],
        },
      ],
    };
    expect(TreeNodeSchema.safeParse(nested).success).toBe(true);
  });

  it('rejects invalid href', () => {
    expect(TreeNodeSchema.safeParse({ ...MINIMAL, href: 'not-a-url' }).success).toBe(false);
  });

  it('accepts valid href URL', () => {
    expect(TreeNodeSchema.safeParse({ ...MINIMAL, href: 'https://example.com' }).success).toBe(true);
  });

  it('rejects missing id', () => {
    expect(TreeNodeSchema.safeParse({ label: 'X' }).success).toBe(false);
  });

  it('rejects missing label', () => {
    expect(TreeNodeSchema.safeParse({ id: 'x' }).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TreeDataSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('TreeDataSchema', () => {
  it('parses with defaults', () => {
    const result = TreeDataSchema.parse({ nodes: [] });
    expect(result.showLines).toBe(true);
    expect(result.searchable).toBe(true);
    expect(result.defaultExpandAll).toBe(false);
    expect(result.executiveDepth).toBe(2);
  });

  it('accepts optional title', () => {
    const result = TreeDataSchema.parse({ nodes: [], title: 'Org Chart' });
    expect(result.title).toBe('Org Chart');
  });

  it('accepts multiple root nodes', () => {
    const data = {
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
    };
    const result = TreeDataSchema.parse(data);
    expect(result.nodes).toHaveLength(2);
  });

  it('rejects non-positive executiveDepth', () => {
    expect(TreeDataSchema.safeParse({ nodes: [], executiveDepth: 0 }).success).toBe(false);
  });

  it('stores nested children in nodes', () => {
    const data = {
      nodes: [
        {
          id: 'root',
          label: 'Root',
          children: [{ id: 'child', label: 'Child' }],
        },
      ],
    };
    const result = TreeDataSchema.parse(data);
    expect(result.nodes[0].children).toHaveLength(1);
  });
});
