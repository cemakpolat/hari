// ─────────────────────────────────────────────────────────────────────────────
// Schema tests — Timeline, Workflow, Kanban, Calendar, Tree, Chat,
//                and Playground payload validation
//
// Covers schema validation, default application, and boundary conditions for
// the six intent-type schemas added in v0.2–v0.3, plus IntentPayloadSchema
// round-trips used by the PayloadPlayground developer tool (FUTURE_TASKS §10b).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';

import {
  TimelineEventSchema,
  TimelineDataSchema,
} from '../schemas/timeline';

import {
  ChatMessageSchema,
  ChatAttachmentSchema,
  ChatDataSchema,
} from '../schemas/chat';

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

// ─────────────────────────────────────────────────────────────────────────────
// ChatAttachmentSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('ChatAttachmentSchema', () => {
  it('parses a minimal attachment', () => {
    const result = ChatAttachmentSchema.safeParse({ id: 'att-1', name: 'file.pdf', type: 'application/pdf' });
    expect(result.success).toBe(true);
  });

  it('parses all optional fields', () => {
    const result = ChatAttachmentSchema.safeParse({
      id: 'att-1',
      name: 'screenshot.png',
      type: 'image/png',
      size: '256 KB',
      url: 'https://example.com/screenshot.png',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing id, name, or type', () => {
    expect(ChatAttachmentSchema.safeParse({ name: 'x', type: 'text/plain' }).success).toBe(false);
    expect(ChatAttachmentSchema.safeParse({ id: 'x', type: 'text/plain' }).success).toBe(false);
    expect(ChatAttachmentSchema.safeParse({ id: 'x', name: 'x' }).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ChatMessageSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('ChatMessageSchema', () => {
  const MINIMAL: unknown = {
    id: 'msg-1',
    role: 'user',
    content: 'Hello!',
    timestamp: 1740394800000,
  };

  it('parses a minimal message with defaults', () => {
    const result = ChatMessageSchema.parse(MINIMAL);
    expect(result.status).toBe('sent');
    expect(result.attachments).toEqual([]);
  });

  it('accepts all valid roles', () => {
    for (const role of ['user', 'agent', 'system']) {
      expect(ChatMessageSchema.safeParse({ ...MINIMAL, role }).success).toBe(true);
    }
  });

  it('rejects invalid role', () => {
    expect(ChatMessageSchema.safeParse({ ...MINIMAL, role: 'bot' }).success).toBe(false);
  });

  it('accepts all valid statuses', () => {
    for (const status of ['sent', 'streaming', 'error']) {
      expect(ChatMessageSchema.safeParse({ ...MINIMAL, status }).success).toBe(true);
    }
  });

  it('rejects invalid status', () => {
    expect(ChatMessageSchema.safeParse({ ...MINIMAL, status: 'pending' }).success).toBe(false);
  });

  it('parses all optional fields', () => {
    const full = {
      ...MINIMAL,
      status: 'sent',
      attachments: [{ id: 'att-1', name: 'file.pdf', type: 'application/pdf' }],
      metadata: { model: 'claude-sonnet-4-6' },
      explainElementId: 'exp-1',
    };
    const result = ChatMessageSchema.safeParse(full);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.attachments).toHaveLength(1);
      expect(result.data.metadata?.model).toBe('claude-sonnet-4-6');
    }
  });

  it('rejects missing id, role, content, or timestamp', () => {
    expect(ChatMessageSchema.safeParse({ role: 'user', content: 'x', timestamp: 0 }).success).toBe(false);
    expect(ChatMessageSchema.safeParse({ id: 'x', content: 'x', timestamp: 0 }).success).toBe(false);
    expect(ChatMessageSchema.safeParse({ id: 'x', role: 'user', timestamp: 0 }).success).toBe(false);
    expect(ChatMessageSchema.safeParse({ id: 'x', role: 'user', content: 'x' }).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ChatDataSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('ChatDataSchema', () => {
  it('parses with defaults', () => {
    const result = ChatDataSchema.parse({ messages: [] });
    expect(result.inputPlaceholder).toBe('Type a message…');
    expect(result.allowAttachments).toBe(false);
    expect(result.readOnly).toBe(false);
    expect(result.streamingMessageId).toBeUndefined();
  });

  it('requires messages array', () => {
    expect(ChatDataSchema.safeParse({}).success).toBe(false);
  });

  it('parses messages with all roles', () => {
    const data = {
      messages: [
        { id: 'm1', role: 'system', content: 'Session started', timestamp: 1000 },
        { id: 'm2', role: 'agent', content: 'Hello', timestamp: 2000 },
        { id: 'm3', role: 'user', content: 'Hi', timestamp: 3000 },
      ],
    };
    const result = ChatDataSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.messages).toHaveLength(3);
    }
  });

  it('parses optional fields', () => {
    const data = {
      messages: [],
      title: 'Support Chat',
      streamingMessageId: 'msg-5',
      inputPlaceholder: 'Ask me anything…',
      allowAttachments: true,
      readOnly: true,
    };
    const result = ChatDataSchema.parse(data);
    expect(result.title).toBe('Support Chat');
    expect(result.streamingMessageId).toBe('msg-5');
    expect(result.allowAttachments).toBe(true);
    expect(result.readOnly).toBe(true);
  });

  it('accepts empty messages array', () => {
    expect(ChatDataSchema.safeParse({ messages: [] }).success).toBe(true);
  });

  it('rejects non-array messages', () => {
    expect(ChatDataSchema.safeParse({ messages: 'not-an-array' }).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// IntentPayloadSchema — Playground validation
//
// These tests mirror the validation logic in PayloadPlayground (§10b).
// They confirm that realistic multi-intent-type payloads round-trip correctly
// through IntentPayloadSchema.safeParse, which is the playground's core path.
// ─────────────────────────────────────────────────────────────────────────────

import { IntentPayloadSchema } from '../schemas/intent';

// Stable test UUIDs for IntentPayloadSchema tests
const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const UUID_C = '33333333-3333-4333-8333-333333333333';
const UUID_D = '44444444-4444-4444-8444-444444444444';

const PG_BASE_TS = new Date('2026-02-24T10:00:00Z').getTime();

describe('IntentPayloadSchema — playground round-trip validation', () => {
  // ── Chat payload ──────────────────────────────────────────────────────────

  it('accepts a valid chat payload', () => {
    const payload = {
      version: '1.0.0',
      intentId: UUID_A,
      type: 'chat',
      domain: 'support',
      primaryGoal: 'Test chat',
      confidence: 0.9,
      data: {
        messages: [
          { id: 'm1', role: 'user', content: 'Hello', timestamp: PG_BASE_TS },
          { id: 'm2', role: 'agent', content: 'Hi!', timestamp: PG_BASE_TS + 1000 },
        ],
      },
    };
    expect(IntentPayloadSchema.safeParse(payload).success).toBe(true);
  });

  // ── Calendar payload ──────────────────────────────────────────────────────

  it('accepts a valid calendar payload', () => {
    const payload = {
      version: '1.0.0',
      intentId: UUID_B,
      type: 'calendar',
      domain: 'engineering',
      primaryGoal: 'Team schedule',
      confidence: 0.85,
      data: {
        events: [
          { id: 'e1', title: 'Standup', start: '2026-02-24T09:00:00', end: '2026-02-24T09:30:00' },
        ],
      },
    };
    expect(IntentPayloadSchema.safeParse(payload).success).toBe(true);
  });

  // ── Kanban payload ────────────────────────────────────────────────────────

  it('accepts a valid kanban payload', () => {
    const payload = {
      version: '1.0.0',
      intentId: UUID_C,
      type: 'kanban',
      domain: 'project',
      primaryGoal: 'Sprint board',
      confidence: 0.9,
      data: {
        columns: [
          { id: 'c1', title: 'To Do', cards: [{ id: 'k1', title: 'Task 1' }] },
        ],
      },
    };
    expect(IntentPayloadSchema.safeParse(payload).success).toBe(true);
  });

  // ── Missing required fields ───────────────────────────────────────────────

  it('rejects payload missing intentId', () => {
    const payload = {
      version: '1.0.0',
      type: 'chat',
      domain: 'support',
      primaryGoal: 'Test',
      confidence: 0.9,
      data: { messages: [] },
    };
    expect(IntentPayloadSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects payload with non-UUID intentId', () => {
    const payload = {
      version: '1.0.0',
      intentId: 'not-a-uuid',
      type: 'chat',
      domain: 'support',
      primaryGoal: 'Test',
      confidence: 0.9,
      data: { messages: [] },
    };
    expect(IntentPayloadSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects payload missing primaryGoal', () => {
    const payload = {
      version: '1.0.0',
      intentId: UUID_A,
      type: 'chat',
      domain: 'support',
      confidence: 0.9,
      data: { messages: [] },
    };
    expect(IntentPayloadSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects payload with confidence out of range', () => {
    const payload = {
      version: '1.0.0',
      intentId: UUID_A,
      type: 'chat',
      domain: 'support',
      primaryGoal: 'Test',
      confidence: 1.5,
      data: { messages: [] },
    };
    expect(IntentPayloadSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects payload with negative confidence', () => {
    const payload = {
      version: '1.0.0',
      intentId: UUID_A,
      type: 'chat',
      domain: 'support',
      primaryGoal: 'Test',
      confidence: -0.1,
      data: { messages: [] },
    };
    expect(IntentPayloadSchema.safeParse(payload).success).toBe(false);
  });

  // ── Optional fields and defaults ──────────────────────────────────────────

  it('applies default density when not provided', () => {
    const payload = {
      version: '1.0.0',
      intentId: UUID_D,
      type: 'chat',
      domain: 'support',
      primaryGoal: 'Default density test',
      confidence: 0.8,
      data: { messages: [] },
    };
    const result = IntentPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.density).toBe('operator');
    }
  });

  it('accepts all density values', () => {
    for (const density of ['executive', 'operator', 'expert']) {
      const payload = {
        version: '1.0.0', intentId: UUID_A, type: 'chat', domain: 'support',
        primaryGoal: 'Density test', confidence: 0.9, density, data: { messages: [] },
      };
      expect(IntentPayloadSchema.safeParse(payload).success).toBe(true);
    }
  });

  it('rejects unknown density value', () => {
    const payload = {
      version: '1.0.0', intentId: UUID_A, type: 'chat', domain: 'support',
      primaryGoal: 'Test', confidence: 0.9, density: 'ultra', data: { messages: [] },
    };
    expect(IntentPayloadSchema.safeParse(payload).success).toBe(false);
  });

  it('accepts payload with actions array', () => {
    const payload = {
      version: '1.0.0', intentId: UUID_A, type: 'chat', domain: 'support',
      primaryGoal: 'With actions', confidence: 0.9, data: { messages: [] },
      actions: [{ id: 'close', label: 'Close session', variant: 'secondary' }],
    };
    expect(IntentPayloadSchema.safeParse(payload).success).toBe(true);
  });
});
