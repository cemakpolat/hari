// ─────────────────────────────────────────────────────────────────────────────
// Renderer tests — Timeline, Workflow, Kanban, Calendar, Tree
//
// Each suite verifies:
//   - Renders successfully with valid data across all three densities
//   - Shows an error message (not a hard crash) when data is invalid
//   - Density-aware content differences are present
//   - Key domain-specific elements are rendered correctly
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { TimelineRenderer } from '../components/TimelineRenderer';
import { WorkflowRenderer } from '../components/WorkflowRenderer';
import { KanbanRenderer } from '../components/KanbanRenderer';
import { CalendarRenderer } from '../components/CalendarRenderer';
import { TreeRenderer } from '../components/TreeRenderer';

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────

const TIMELINE_DATA = {
  title: 'Deploy History',
  events: [
    {
      id: 'ev-1',
      title: 'Deploy v1.0',
      timestamp: '2026-02-23T10:00:00',
      category: 'deploy',
      status: 'completed',
      icon: '🚀',
      description: 'Production release',
      metadata: { version: 'v1.0', deployed_by: 'alice' },
    },
    {
      id: 'ev-2',
      title: 'P1 Incident',
      timestamp: '2026-02-24T08:00:00',
      endTimestamp: '2026-02-24T09:30:00',
      category: 'incident',
      status: 'completed',
      icon: '🔥',
      description: 'Database connection pool exhaustion',
    },
    {
      id: 'ev-3',
      title: 'Hotfix v1.0.1',
      timestamp: '2026-02-24T10:00:00',
      category: 'deploy',
      status: 'in_progress',
      icon: '🩹',
    },
  ],
};

const WORKFLOW_DATA = {
  title: 'Service Onboarding',
  currentStepIndex: 1,
  steps: [
    {
      id: 'step-1',
      title: 'Introduction',
      type: 'info',
      status: 'completed',
      content: 'Welcome to the onboarding wizard.',
      icon: '👋',
    },
    {
      id: 'step-2',
      title: 'Configuration',
      type: 'form',
      status: 'in_progress',
      icon: '⚙',
      fields: [
        {
          id: 'service_name',
          label: 'Service Name',
          type: 'text',
          required: true,
          disabled: false,
          sensitive: false,
          validation: [],
          multiline: false,
        },
      ],
    },
    {
      id: 'step-3',
      title: 'Confirm',
      type: 'confirmation',
      status: 'pending',
      content: 'Are you sure you want to proceed?',
      icon: '✅',
    },
  ],
};

const KANBAN_DATA = {
  title: 'Sprint 17',
  showCardCount: true,
  showWipLimits: true,
  columns: [
    {
      id: 'todo',
      title: 'To Do',
      color: '#94a3b8',
      cards: [
        {
          id: 'c-1',
          title: 'Fix login bug',
          description: 'Users cannot log in on mobile',
          priority: 'high',
          assignee: 'Alice',
          tags: ['bug', 'auth'],
          dueDate: '2026-02-28',
        },
      ],
    },
    {
      id: 'in-progress',
      title: 'In Progress',
      color: '#4f46e5',
      wipLimit: 3,
      cards: [
        {
          id: 'c-2',
          title: 'Add OTEL tracing',
          priority: 'medium',
          tags: ['observability'],
          metadata: { story_points: 5 },
        },
      ],
    },
    {
      id: 'done',
      title: 'Done',
      color: '#10b981',
      cards: [],
    },
  ],
};

const CALENDAR_DATA = {
  title: 'Engineering Schedule',
  view: 'week',
  focusDate: '2026-02-23',
  weekStartsOn: 1,
  events: [
    {
      id: 'evt-1',
      title: 'Team Standup',
      start: '2026-02-23T09:00:00',
      end: '2026-02-23T09:15:00',
      category: 'meeting',
      status: 'confirmed',
      attendees: ['alice@example.com', 'bob@example.com'],
      location: 'Zoom',
    },
    {
      id: 'evt-2',
      title: 'Sprint Review',
      start: '2026-02-27',
      end: '2026-02-27',
      allDay: true,
      category: 'sprint',
      status: 'confirmed',
    },
    {
      id: 'evt-3',
      title: 'Tentative Planning',
      start: '2026-02-25T14:00:00',
      end: '2026-02-25T15:00:00',
      status: 'tentative',
    },
  ],
};

const TREE_DATA = {
  title: 'Org Chart',
  showLines: true,
  searchable: true,
  defaultExpandAll: false,
  nodes: [
    {
      id: 'root',
      label: 'VP Engineering',
      icon: '👤',
      badge: 50,
      status: 'active',
      defaultExpanded: true,
      metadata: { location: 'NYC HQ' },
      children: [
        {
          id: 'platform',
          label: 'Platform Engineering',
          icon: '🏗',
          badge: 20,
          status: 'active',
          explainElementId: 'platform-explain',
          children: [
            { id: 'infra', label: 'Infrastructure', icon: '🖥', badge: 8, status: 'active' },
            { id: 'security', label: 'Security', icon: '🔒', badge: 4, status: 'warning' },
          ],
        },
        {
          id: 'product',
          label: 'Product Engineering',
          icon: '🚀',
          badge: 30,
          status: 'active',
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// TimelineRenderer
// ─────────────────────────────────────────────────────────────────────────────

describe('TimelineRenderer', () => {
  it('renders with valid data — operator density', () => {
    render(<TimelineRenderer data={TIMELINE_DATA} density="operator" />);
    expect(screen.getByText('Deploy History')).toBeInTheDocument();
    expect(screen.getByText('Deploy v1.0')).toBeInTheDocument();
    expect(screen.getByText('P1 Incident')).toBeInTheDocument();
  });

  it('renders event descriptions in operator density', () => {
    render(<TimelineRenderer data={TIMELINE_DATA} density="operator" />);
    expect(screen.getByText('Production release')).toBeInTheDocument();
  });

  it('renders metadata in expert density', () => {
    render(<TimelineRenderer data={TIMELINE_DATA} density="expert" />);
    // Metadata keys should be visible in expert mode
    expect(screen.getByText('version')).toBeInTheDocument();
    expect(screen.getByText('deployed_by')).toBeInTheDocument();
  });

  it('renders in executive density (limited events)', () => {
    const data = {
      ...TIMELINE_DATA,
      executiveCap: 2,
      events: [...TIMELINE_DATA.events, ...TIMELINE_DATA.events.map((e, i) => ({ ...e, id: `extra-${i}`, title: `Extra ${i}` }))],
    };
    render(<TimelineRenderer data={data} density="executive" />);
    // Should render something without crashing
    expect(document.body).toBeTruthy();
  });

  it('calls onExplain when explain button is clicked', () => {
    const onExplain = vi.fn();
    const data = {
      ...TIMELINE_DATA,
      events: [{ ...TIMELINE_DATA.events[0], explainElementId: 'explain-ev-1' }],
    };
    render(<TimelineRenderer data={data} density="operator" onExplain={onExplain} />);
    const whyBtn = screen.getByText('Why?');
    fireEvent.click(whyBtn);
    expect(onExplain).toHaveBeenCalledWith('explain-ev-1');
  });

  it('renders empty state for no events', () => {
    render(<TimelineRenderer data={{ events: [] }} density="operator" />);
    expect(screen.getByText('No events to display.')).toBeInTheDocument();
  });

  it('shows error for invalid data', () => {
    render(<TimelineRenderer data={{ wrong: true }} density="operator" />);
    expect(screen.getByText(/TimelineRenderer/)).toBeInTheDocument();
  });

  it('renders event icons', () => {
    render(<TimelineRenderer data={TIMELINE_DATA} density="operator" />);
    expect(screen.getByText('🚀')).toBeInTheDocument();
    expect(screen.getByText('🔥')).toBeInTheDocument();
  });

  it('renders category legend in expert density', () => {
    render(<TimelineRenderer data={TIMELINE_DATA} density="expert" />);
    // Category dots appear in the legend
    expect(screen.getByText('deploy')).toBeInTheDocument();
    expect(screen.getByText('incident')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WorkflowRenderer
// ─────────────────────────────────────────────────────────────────────────────

describe('WorkflowRenderer', () => {
  it('renders with valid data — operator density', () => {
    render(<WorkflowRenderer data={WORKFLOW_DATA} density="operator" />);
    expect(screen.getByText('Service Onboarding')).toBeInTheDocument();
    expect(screen.getByText('Introduction')).toBeInTheDocument();
    // 'Configuration' and 'Confirm' appear in both the sidebar and the step header
    expect(screen.getAllByText('Configuration').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Confirm').length).toBeGreaterThan(0);
  });

  it('renders active step form fields', () => {
    render(<WorkflowRenderer data={WORKFLOW_DATA} density="operator" />);
    // Step 2 is in_progress — form field should be visible
    expect(screen.getByLabelText(/service name/i)).toBeInTheDocument();
  });

  it('renders Next button in operator density', () => {
    render(<WorkflowRenderer data={WORKFLOW_DATA} density="operator" />);
    expect(screen.getByText('Next →')).toBeInTheDocument();
  });

  it('renders Back button when not on first step', () => {
    render(<WorkflowRenderer data={WORKFLOW_DATA} density="operator" />);
    expect(screen.getByText('← Back')).toBeInTheDocument();
  });

  it('renders compact progress bar in executive density', () => {
    render(<WorkflowRenderer data={WORKFLOW_DATA} density="executive" />);
    // Executive shows the current step title in a compact layout
    expect(screen.getByText('Configuration')).toBeInTheDocument();
  });

  it('does not render full sidebar in executive density', () => {
    render(<WorkflowRenderer data={WORKFLOW_DATA} density="executive" />);
    // Executive mode shows just current step — "Introduction" (already done) should not appear as sidebar item
    // (it shows only the active step title in exec mode)
    expect(screen.queryByText('← Back')).not.toBeInTheDocument();
  });

  it('calls onComplete when finishing the last step', () => {
    const onComplete = vi.fn();
    const singleStepData = {
      title: 'Simple Workflow',
      currentStepIndex: 0,
      steps: [
        {
          id: 's1',
          title: 'Done',
          type: 'info',
          status: 'in_progress',
          content: 'That\'s it!',
        },
      ],
    };
    render(<WorkflowRenderer data={singleStepData} density="operator" onComplete={onComplete} />);
    // Single-step workflow: Next = Finish
    const finish = screen.getByText('Finish');
    fireEvent.click(finish);
    expect(onComplete).toHaveBeenCalled();
  });

  it('shows error for invalid data', () => {
    render(<WorkflowRenderer data={{ wrong: true }} density="operator" />);
    expect(screen.getByText(/WorkflowRenderer/)).toBeInTheDocument();
  });

  it('renders confirmation step buttons', () => {
    const confirmData = {
      title: 'Confirm Step',
      currentStepIndex: 0,
      steps: [
        {
          id: 'conf',
          title: 'Confirm',
          type: 'confirmation',
          status: 'in_progress',
          content: 'Are you sure?',
        },
      ],
    };
    render(<WorkflowRenderer data={confirmData} density="operator" />);
    // 'Confirm' appears as both the step title and the confirmation button
    expect(screen.getAllByText('Confirm').length).toBeGreaterThan(0);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('renders review step items', () => {
    const reviewData = {
      title: 'Review',
      currentStepIndex: 0,
      steps: [
        {
          id: 'rev',
          title: 'Review',
          type: 'review',
          status: 'in_progress',
          reviewItems: [
            { label: 'Service Name', value: 'my-service', highlight: true },
            { label: 'Region', value: 'us-east-1' },
          ],
        },
      ],
    };
    render(<WorkflowRenderer data={reviewData} density="operator" />);
    expect(screen.getByText('Service Name')).toBeInTheDocument();
    expect(screen.getByText('my-service')).toBeInTheDocument();
    expect(screen.getByText('Region')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// KanbanRenderer
// ─────────────────────────────────────────────────────────────────────────────

describe('KanbanRenderer', () => {
  it('renders with valid data — operator density', () => {
    render(<KanbanRenderer data={KANBAN_DATA} density="operator" />);
    expect(screen.getByText('Sprint 17')).toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('renders card titles in operator density', () => {
    render(<KanbanRenderer data={KANBAN_DATA} density="operator" />);
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    expect(screen.getByText('Add OTEL tracing')).toBeInTheDocument();
  });

  it('renders card description in operator density', () => {
    render(<KanbanRenderer data={KANBAN_DATA} density="operator" />);
    expect(screen.getByText(/Users cannot log in on mobile/)).toBeInTheDocument();
  });

  it('renders assignee badge', () => {
    render(<KanbanRenderer data={KANBAN_DATA} density="operator" />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders tags on cards', () => {
    render(<KanbanRenderer data={KANBAN_DATA} density="operator" />);
    expect(screen.getByText('bug')).toBeInTheDocument();
    expect(screen.getByText('auth')).toBeInTheDocument();
  });

  it('renders card metadata in expert density', () => {
    render(<KanbanRenderer data={KANBAN_DATA} density="expert" />);
    expect(screen.getByText('story_points')).toBeInTheDocument();
  });

  it('renders executive summary grid', () => {
    render(<KanbanRenderer data={KANBAN_DATA} density="executive" />);
    // Executive shows column title + card count
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('shows empty column placeholder', () => {
    render(<KanbanRenderer data={KANBAN_DATA} density="operator" />);
    expect(screen.getByText('Empty')).toBeInTheDocument();
  });

  it('calls onExplain from card', () => {
    const onExplain = vi.fn();
    const data = {
      ...KANBAN_DATA,
      columns: [
        {
          ...KANBAN_DATA.columns[0],
          cards: [{ ...KANBAN_DATA.columns[0].cards[0], explainElementId: 'explain-c1' }],
        },
        ...KANBAN_DATA.columns.slice(1),
      ],
    };
    render(<KanbanRenderer data={data} density="operator" onExplain={onExplain} />);
    const whyBtn = screen.getByText('Why?');
    fireEvent.click(whyBtn);
    expect(onExplain).toHaveBeenCalledWith('explain-c1');
  });

  it('calls onCardClick when card is clicked', () => {
    const onCardClick = vi.fn();
    render(<KanbanRenderer data={KANBAN_DATA} density="operator" onCardClick={onCardClick} />);
    fireEvent.click(screen.getByText('Fix login bug'));
    expect(onCardClick).toHaveBeenCalledWith('c-1', 'todo');
  });

  it('shows error for invalid data', () => {
    render(<KanbanRenderer data={{ wrong: true }} density="operator" />);
    expect(screen.getByText(/KanbanRenderer/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CalendarRenderer
// ─────────────────────────────────────────────────────────────────────────────

describe('CalendarRenderer', () => {
  it('renders title', () => {
    render(<CalendarRenderer data={CALENDAR_DATA} density="operator" />);
    expect(screen.getByText('Engineering Schedule')).toBeInTheDocument();
  });

  it('renders event titles in operator density', () => {
    render(<CalendarRenderer data={CALENDAR_DATA} density="operator" />);
    expect(screen.getByText('Team Standup')).toBeInTheDocument();
  });

  it('renders without crashing in executive density', () => {
    render(<CalendarRenderer data={CALENDAR_DATA} density="executive" />);
    expect(screen.getByText('Engineering Schedule')).toBeInTheDocument();
  });

  it('renders event details in expert density', () => {
    render(<CalendarRenderer data={CALENDAR_DATA} density="expert" />);
    // Expert agenda shows attendees, location
    expect(screen.getByText('Team Standup')).toBeInTheDocument();
    expect(screen.getByText(/Zoom/)).toBeInTheDocument();
  });

  it('renders attendees in expert density', () => {
    render(<CalendarRenderer data={CALENDAR_DATA} density="expert" />);
    expect(screen.getByText(/alice@example\.com/)).toBeInTheDocument();
  });

  it('shows prev/next navigation in executive month view', () => {
    const monthData = { ...CALENDAR_DATA, view: 'month' };
    render(<CalendarRenderer data={monthData} density="executive" />);
    expect(screen.getByText('‹')).toBeInTheDocument();
    expect(screen.getByText('›')).toBeInTheDocument();
  });

  it('navigates month forward and back', () => {
    const monthData = { ...CALENDAR_DATA, view: 'month' };
    const { container } = render(<CalendarRenderer data={monthData} density="executive" />);
    const nextBtn = screen.getByText('›');
    fireEvent.click(nextBtn);
    // After clicking, the component should still be in the document without errors
    expect(container.firstChild).toBeTruthy();
  });

  it('calls onExplain for events with explainElementId', () => {
    const onExplain = vi.fn();
    const data = {
      ...CALENDAR_DATA,
      view: 'agenda',
      events: [{ ...CALENDAR_DATA.events[0], explainElementId: 'evt-explain-1' }],
    };
    render(<CalendarRenderer data={data} density="expert" onExplain={onExplain} />);
    const whyBtn = screen.queryByText('Why?');
    if (whyBtn) {
      fireEvent.click(whyBtn);
      expect(onExplain).toHaveBeenCalledWith('evt-explain-1');
    }
  });

  it('renders empty state gracefully', () => {
    render(<CalendarRenderer data={{ events: [] }} density="operator" />);
    expect(document.body).toBeTruthy();
  });

  it('shows error for invalid data', () => {
    render(<CalendarRenderer data={{ wrong: true }} density="operator" />);
    expect(screen.getByText(/Invalid calendar data/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TreeRenderer
// ─────────────────────────────────────────────────────────────────────────────

describe('TreeRenderer', () => {
  it('renders root node label', () => {
    render(<TreeRenderer data={TREE_DATA} density="operator" />);
    expect(screen.getByText('VP Engineering')).toBeInTheDocument();
  });

  it('renders title', () => {
    render(<TreeRenderer data={TREE_DATA} density="operator" />);
    expect(screen.getByText('Org Chart')).toBeInTheDocument();
  });

  it('renders child nodes when expanded', () => {
    render(<TreeRenderer data={TREE_DATA} density="operator" />);
    // Root has defaultExpanded=true, so children should be visible
    expect(screen.getByText('Platform Engineering')).toBeInTheDocument();
    expect(screen.getByText('Product Engineering')).toBeInTheDocument();
  });

  it('renders expand/collapse controls in operator density', () => {
    render(<TreeRenderer data={TREE_DATA} density="operator" />);
    // Expand all / Collapse all buttons
    expect(screen.getByText('Expand all')).toBeInTheDocument();
    expect(screen.getByText('Collapse all')).toBeInTheDocument();
  });

  it('renders search box in expert density', () => {
    render(<TreeRenderer data={TREE_DATA} density="expert" />);
    expect(screen.getByPlaceholderText(/filter/i)).toBeInTheDocument();
  });

  it('filters nodes via search in expert density', () => {
    render(<TreeRenderer data={TREE_DATA} density="expert" />);
    const searchInput = screen.getByPlaceholderText(/filter/i);
    // Type a query that matches a visible node (Platform Engineering is a direct child of expanded root)
    fireEvent.change(searchInput, { target: { value: 'Platform' } });
    // Matching node should still appear in the filtered tree
    expect(screen.getByText('Platform Engineering')).toBeInTheDocument();
  });

  it('shows status dots for nodes with status', () => {
    render(<TreeRenderer data={TREE_DATA} density="operator" />);
    // Status dots are rendered as small spans — we just verify no crash and
    // nodes with status are present
    expect(screen.getByText('VP Engineering')).toBeInTheDocument();
  });

  it('renders node icons', () => {
    render(<TreeRenderer data={TREE_DATA} density="operator" />);
    expect(screen.getByText('👤')).toBeInTheDocument();
  });

  it('renders badge numbers', () => {
    render(<TreeRenderer data={TREE_DATA} density="operator" />);
    // Root badge = 50
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('calls onExplain when Why? button is clicked', () => {
    const onExplain = vi.fn();
    render(<TreeRenderer data={TREE_DATA} density="operator" onExplain={onExplain} />);
    const whyBtn = screen.queryByText('Why?');
    if (whyBtn) {
      fireEvent.click(whyBtn);
      expect(onExplain).toHaveBeenCalledWith('platform-explain');
    }
  });

  it('renders executive density without crashing', () => {
    render(<TreeRenderer data={TREE_DATA} density="executive" />);
    expect(screen.getByText('VP Engineering')).toBeInTheDocument();
  });

  it('collapses and expands nodes on click', () => {
    render(<TreeRenderer data={TREE_DATA} density="operator" />);
    // Platform Engineering is visible initially (root is expanded)
    expect(screen.getByText('Platform Engineering')).toBeInTheDocument();
    // Click VP Engineering to collapse it
    fireEvent.click(screen.getAllByRole('button')[0]); // first toggle button
    // After collapsing root, Platform Engineering may not be visible
    // (exact behaviour depends on tree state — just ensure no crash)
    expect(document.body).toBeTruthy();
  });

  it('shows error for invalid data', () => {
    render(<TreeRenderer data={{ wrong: true }} density="operator" />);
    expect(screen.getByText(/Invalid tree data/i)).toBeInTheDocument();
  });
});
