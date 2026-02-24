// ─────────────────────────────────────────────────────────────────────────────
// Accessibility tests — WCAG 2.2 AA coverage for all renderers
//
// Checks:
//   - Interactive elements have accessible names (aria-label / title / text)
//   - Animated elements carry the css class needed for prefers-reduced-motion
//   - Clickable non-button elements expose role + keyboard handlers
//   - ARIA landmark/widget attributes are present and coherent
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ChatRenderer } from '../components/ChatRenderer';
import { KanbanRenderer } from '../components/KanbanRenderer';
import { TimelineRenderer } from '../components/TimelineRenderer';
import { TreeRenderer } from '../components/TreeRenderer';
import { CalendarRenderer } from '../components/CalendarRenderer';
import { WorkflowRenderer } from '../components/WorkflowRenderer';
import { DocumentRenderer } from '../components/DocumentRenderer';
import { FormRenderer } from '../components/FormRenderer';
import type { FormSection } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const CHAT_DATA = {
  title: 'Support chat',
  messages: [
    {
      id: 'm1',
      role: 'agent' as const,
      content: 'Hello!',
      timestamp: 1740394800000, // 2026-02-24T10:00:00 UTC in ms
      status: 'sent' as const,
      explainElementId: 'el-m1',
      attachments: [],
    },
    {
      id: 'm2',
      role: 'user' as const,
      content: 'Hi there',
      timestamp: 1740394860000, // 2026-02-24T10:01:00 UTC in ms
      status: 'streaming' as const,
      attachments: [],
    },
  ],
  streamingMessageId: 'm2',
  inputPlaceholder: 'Type a message…',
  allowAttachments: true,
  showInput: true,
};

const KANBAN_DATA = {
  title: 'Sprint board',
  columns: [
    {
      id: 'todo',
      title: 'To Do',
      cards: [
        {
          id: 'c1',
          title: 'Fix bug',
          explainElementId: 'el-c1',
        },
      ],
    },
  ],
};

const TIMELINE_DATA = {
  title: 'Deploy History',
  events: [
    {
      id: 'ev1',
      title: 'Deploy v1',
      timestamp: '2026-02-24T10:00:00',
      status: 'completed' as const,
      explainElementId: 'el-ev1',
    },
  ],
};

const TREE_DATA = {
  title: 'File Tree',
  nodes: [
    {
      id: 'root',
      label: 'src',
      children: [
        { id: 'child1', label: 'index.ts', explainElementId: 'el-child1' },
      ],
    },
  ],
};

const CALENDAR_DATA = {
  title: 'My Calendar',
  view: 'week' as const,
  events: [
    {
      id: 'evt1',
      title: 'Team standup',
      start: '2026-02-24T09:00:00',
      end: '2026-02-24T09:30:00',
      allDay: false,
      explainElementId: 'el-evt1',
    },
  ],
};

const WORKFLOW_DATA = {
  title: 'Onboarding',
  steps: [
    {
      id: 'step1',
      title: 'Profile',
      status: 'in_progress' as const,
      type: 'info' as const,
      content: 'Fill in your details.',
    },
    {
      id: 'step2',
      title: 'Verification',
      status: 'pending' as const,
      type: 'info' as const,
      content: 'Verify your email.',
    },
  ],
  currentStepIndex: 0,
  allowSkipAhead: false,
};

const DOCUMENT_DATA = {
  title: 'Report',
  sections: [
    {
      id: 's1',
      title: 'Summary',
      collapsible: true,
      defaultCollapsed: false,
      blocks: [{ type: 'paragraph' as const, text: 'All good.' }],
    },
  ],
};

// FormRenderer takes direct props (sections + formId), not a data object.
// Fixtures are declared inline in the FormRenderer suite below.

// ─────────────────────────────────────────────────────────────────────────────
// ChatRenderer
// ─────────────────────────────────────────────────────────────────────────────

describe('ChatRenderer accessibility', () => {
  it('provides aria-label on "Why?" button', () => {
    render(
      <ChatRenderer data={CHAT_DATA} density="expert" onExplain={vi.fn()} />,
    );
    const btn = screen.getByRole('button', { name: 'Explain this message' });
    expect(btn).toBeDefined();
  });

  it('provides aria-label on Attach file button', () => {
    render(<ChatRenderer data={CHAT_DATA} density="operator" />);
    const btn = screen.getByRole('button', { name: 'Attach file' });
    expect(btn).toBeDefined();
  });

  it('provides aria-label on Send message button', () => {
    render(<ChatRenderer data={CHAT_DATA} density="operator" />);
    const btn = screen.getByRole('button', { name: 'Send message' });
    expect(btn).toBeDefined();
  });

  it('streaming cursor carries chat-cursor class for prefers-reduced-motion', () => {
    const { container } = render(
      <ChatRenderer data={CHAT_DATA} density="operator" />,
    );
    const cursor = container.querySelector('.chat-cursor');
    expect(cursor).not.toBeNull();
    expect(cursor?.getAttribute('aria-hidden')).toBe('true');
  });

  it('Message input has aria-label', () => {
    render(<ChatRenderer data={CHAT_DATA} density="operator" />);
    const input = screen.getByRole('textbox', { name: 'Message input' });
    expect(input).toBeDefined();
  });

  it('message list has aria-live="polite" for new message announcements', () => {
    const { container } = render(<ChatRenderer data={CHAT_DATA} density="operator" />);
    const live = container.querySelector('[aria-live="polite"][aria-label="Conversation messages"]');
    expect(live).not.toBeNull();
    expect(live?.getAttribute('aria-atomic')).toBe('false');
  });

  it('streaming status region has aria-live="assertive" with "Agent is typing" text', () => {
    const { container } = render(<ChatRenderer data={CHAT_DATA} density="operator" />);
    // CHAT_DATA has streamingMessageId set, so the region should say "Agent is typing"
    const liveRegion = container.querySelector('[aria-live="assertive"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion?.textContent?.trim()).toBe('Agent is typing');
  });

  it('streaming status region is empty when no message is streaming', () => {
    const noStreamData = { ...CHAT_DATA, streamingMessageId: undefined };
    const { container } = render(<ChatRenderer data={noStreamData} density="operator" />);
    const liveRegion = container.querySelector('[aria-live="assertive"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion?.textContent?.trim()).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// KanbanRenderer
// ─────────────────────────────────────────────────────────────────────────────

describe('KanbanRenderer accessibility', () => {
  it('provides aria-label on "Why?" button including card title', () => {
    render(
      <KanbanRenderer data={KANBAN_DATA} density="expert" onExplain={vi.fn()} />,
    );
    const btn = screen.getByRole('button', { name: 'Explain: Fix bug' });
    expect(btn).toBeDefined();
  });

  it('calls onExplain when Why? button is clicked', () => {
    const onExplain = vi.fn();
    render(
      <KanbanRenderer data={KANBAN_DATA} density="expert" onExplain={onExplain} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Explain: Fix bug' }));
    expect(onExplain).toHaveBeenCalledWith('el-c1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TimelineRenderer
// ─────────────────────────────────────────────────────────────────────────────

describe('TimelineRenderer accessibility', () => {
  it('provides aria-label on "Why?" button including event title', () => {
    render(
      <TimelineRenderer
        data={TIMELINE_DATA}
        density="expert"
        onExplain={vi.fn()}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Explain: Deploy v1' });
    expect(btn).toBeDefined();
  });

  it('calls onExplain when Why? is clicked', () => {
    const onExplain = vi.fn();
    render(
      <TimelineRenderer
        data={TIMELINE_DATA}
        density="expert"
        onExplain={onExplain}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Explain: Deploy v1' }));
    expect(onExplain).toHaveBeenCalledWith('el-ev1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TreeRenderer
// ─────────────────────────────────────────────────────────────────────────────

describe('TreeRenderer accessibility', () => {
  it('Expand all button has aria-label', () => {
    render(<TreeRenderer data={TREE_DATA} density="operator" />);
    const btn = screen.getByRole('button', { name: 'Expand all nodes' });
    expect(btn).toBeDefined();
  });

  it('Collapse all button has aria-label', () => {
    render(<TreeRenderer data={TREE_DATA} density="operator" />);
    const btn = screen.getByRole('button', { name: 'Collapse all nodes' });
    expect(btn).toBeDefined();
  });

  it('Explain button has aria-label with node label', () => {
    render(
      <TreeRenderer data={TREE_DATA} density="expert" onExplain={vi.fn()} />,
    );
    // Root nodes are expanded by default; child 'index.ts' is already visible
    const btn = screen.getByRole('button', { name: 'Explain: index.ts' });
    expect(btn).toBeDefined();
  });

  it('tree root has role=tree with aria-label', () => {
    const { container } = render(<TreeRenderer data={TREE_DATA} density="operator" />);
    const tree = container.querySelector('[role="tree"]');
    expect(tree).not.toBeNull();
    expect(tree?.getAttribute('aria-label')).toBe('File Tree');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CalendarRenderer
// ─────────────────────────────────────────────────────────────────────────────

describe('CalendarRenderer accessibility', () => {
  it('navigation buttons have aria-labels', () => {
    render(<CalendarRenderer data={CALENDAR_DATA} density="operator" />);
    expect(screen.getByRole('button', { name: 'Previous week' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Next week' })).toBeDefined();
  });

  it('clickable event has role=button and aria-label', () => {
    const { container } = render(
      <CalendarRenderer data={CALENDAR_DATA} density="operator" onExplain={vi.fn()} />,
    );
    const eventBtn = container.querySelector('[role="button"][aria-label="Explain: Team standup"]');
    expect(eventBtn).not.toBeNull();
  });

  it('clickable event has tabIndex=0 for keyboard navigation', () => {
    const { container } = render(
      <CalendarRenderer data={CALENDAR_DATA} density="operator" onExplain={vi.fn()} />,
    );
    const eventBtn = container.querySelector('[role="button"][tabindex="0"]');
    expect(eventBtn).not.toBeNull();
  });

  it('activates onExplain via keyboard Enter on event', () => {
    const onExplain = vi.fn();
    const { container } = render(
      <CalendarRenderer data={CALENDAR_DATA} density="operator" onExplain={onExplain} />,
    );
    const eventBtn = container.querySelector('[role="button"][aria-label="Explain: Team standup"]') as HTMLElement;
    expect(eventBtn).not.toBeNull();
    fireEvent.keyDown(eventBtn, { key: 'Enter' });
    expect(onExplain).toHaveBeenCalledWith('el-evt1');
  });

  it('activates onExplain via keyboard Space on event', () => {
    const onExplain = vi.fn();
    const { container } = render(
      <CalendarRenderer data={CALENDAR_DATA} density="operator" onExplain={onExplain} />,
    );
    const eventBtn = container.querySelector('[role="button"][aria-label="Explain: Team standup"]') as HTMLElement;
    fireEvent.keyDown(eventBtn, { key: ' ' });
    expect(onExplain).toHaveBeenCalledWith('el-evt1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WorkflowRenderer
// ─────────────────────────────────────────────────────────────────────────────

describe('WorkflowRenderer accessibility', () => {
  it('step navigation buttons have aria-labels', () => {
    render(<WorkflowRenderer data={WORKFLOW_DATA} density="operator" />);
    expect(
      screen.getByRole('button', { name: 'Go to step 1: Profile' }),
    ).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Go to step 2: Verification' }),
    ).toBeDefined();
  });

  it('active step button has aria-current=step', () => {
    render(<WorkflowRenderer data={WORKFLOW_DATA} density="operator" />);
    const activeBtn = screen.getByRole('button', { name: 'Go to step 1: Profile' });
    expect(activeBtn.getAttribute('aria-current')).toBe('step');
  });

  it('inactive step button has no aria-current', () => {
    render(<WorkflowRenderer data={WORKFLOW_DATA} density="operator" />);
    const inactiveBtn = screen.getByRole('button', { name: 'Go to step 2: Verification' });
    expect(inactiveBtn.getAttribute('aria-current')).toBeNull();
  });

  it('has a aria-live="polite" region announcing the current step', () => {
    const { container } = render(<WorkflowRenderer data={WORKFLOW_DATA} density="operator" />);
    const liveRegion = container.querySelector('[aria-live="polite"][aria-atomic="true"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion?.textContent?.trim()).toBe('Step 1 of 2: Profile');
  });

  it('live region updates with new step title when navigating', () => {
    const { container } = render(
      <WorkflowRenderer data={{ ...WORKFLOW_DATA, allowSkipAhead: true }} density="operator" />,
    );
    // Navigate to step 2 via its sidebar button
    fireEvent.click(screen.getByRole('button', { name: 'Go to step 2: Verification' }));
    const liveRegion = container.querySelector('[aria-live="polite"][aria-atomic="true"]');
    expect(liveRegion?.textContent?.trim()).toBe('Step 2 of 2: Verification');
  });

  it('executive density also has aria-live step announcement', () => {
    const { container } = render(<WorkflowRenderer data={WORKFLOW_DATA} density="executive" />);
    const liveRegion = container.querySelector('[aria-live="polite"][aria-atomic="true"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion?.textContent?.trim()).toBe('Step 1 of 2: Profile');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DocumentRenderer
// ─────────────────────────────────────────────────────────────────────────────

describe('DocumentRenderer accessibility', () => {
  it('collapse/expand button has aria-label', () => {
    render(<DocumentRenderer data={DOCUMENT_DATA} density="operator" />);
    // Section starts expanded; button should say "Collapse"
    const btn = screen.getByRole('button', { name: 'Collapse Summary' });
    expect(btn).toBeDefined();
  });

  it('Export .md button has aria-label', () => {
    render(
      <DocumentRenderer
        data={DOCUMENT_DATA}
        density="operator"
        onExportMarkdown={vi.fn()}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Export document as Markdown' });
    expect(btn).toBeDefined();
  });

  it('Print/PDF button has aria-label', () => {
    render(
      <DocumentRenderer
        data={DOCUMENT_DATA}
        density="operator"
        showPdfExport={true}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Print or save as PDF' });
    expect(btn).toBeDefined();
  });

  it('collapsible h3 responds to keyboard Enter', () => {
    render(<DocumentRenderer data={DOCUMENT_DATA} density="operator" />);
    const heading = screen.getByText('Summary');
    // Section content visible initially
    expect(screen.getByText('All good.')).toBeDefined();
    // Press Enter on heading to collapse
    fireEvent.keyDown(heading, { key: 'Enter' });
    // Content should now be hidden (not in DOM)
    expect(screen.queryByText('All good.')).toBeNull();
  });

  it('collapsible h3 responds to keyboard Space', () => {
    render(<DocumentRenderer data={DOCUMENT_DATA} density="operator" />);
    const heading = screen.getByText('Summary');
    fireEvent.keyDown(heading, { key: ' ' });
    expect(screen.queryByText('All good.')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FormRenderer
// ─────────────────────────────────────────────────────────────────────────────

describe('FormRenderer accessibility', () => {
  const nameSection: FormSection = {
    id: 'sec1',
    title: 'Info',
    fields: [{ id: 'name', label: 'Name', type: 'text', required: true, disabled: false, sensitive: false, validation: [], multiline: false }],
    collapsible: false,
    defaultCollapsed: false,
    columns: 1,
  };

  it('renders label for text field', () => {
    render(<FormRenderer formId="a11y-test" sections={[nameSection]} />);
    expect(screen.getByLabelText(/name/i)).toBeDefined();
  });

  it('wizard Next button has aria-label', () => {
    const emptySection: FormSection = { id: 'sec2', title: 'Extra', fields: [], collapsible: false, defaultCollapsed: false, columns: 1 };
    render(
      <FormRenderer
        formId="wizard-test"
        sections={[nameSection, emptySection]}
        steps={[
          { id: 'step1', title: 'Step 1', sectionIds: ['sec1'] },
          { id: 'step2', title: 'Step 2', sectionIds: ['sec2'] },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Go to next step' })).toBeDefined();
  });

  it('wizard Back button has aria-label after advancing', () => {
    // Use non-required fields so validation doesn't block "Next"
    const optSection: FormSection = {
      id: 'opt1', title: 'Step A',
      fields: [{ id: 'note', label: 'Note', type: 'text', required: false, disabled: false, sensitive: false, validation: [], multiline: false }],
      collapsible: false, defaultCollapsed: false, columns: 1,
    };
    const emptySection: FormSection = { id: 'sec2', title: 'Step B', fields: [], collapsible: false, defaultCollapsed: false, columns: 1 };
    render(
      <FormRenderer
        formId="wizard-back-test"
        sections={[optSection, emptySection]}
        steps={[
          { id: 'step1', title: 'Step 1', sectionIds: ['opt1'] },
          { id: 'step2', title: 'Step 2', sectionIds: ['sec2'] },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Go to next step' }));
    expect(screen.getByRole('button', { name: 'Go to previous step' })).toBeDefined();
  });

  it('draft Restore button has aria-label', () => {
    // Seed a draft in localStorage before mounting
    localStorage.setItem('hari-form-draft-draft-test', JSON.stringify({ name: 'Alice' }));
    render(
      <FormRenderer
        formId="draft-test"
        sections={[nameSection]}
        autoSave={true}
      />,
    );
    expect(screen.getByRole('button', { name: 'Restore saved draft' })).toBeDefined();
    localStorage.removeItem('hari-form-draft-draft-test');
  });

  it('draft Discard button has aria-label', () => {
    localStorage.setItem('hari-form-draft-draft-discard', JSON.stringify({ name: 'Bob' }));
    render(
      <FormRenderer
        formId="draft-discard"
        sections={[nameSection]}
        autoSave={true}
      />,
    );
    expect(screen.getByRole('button', { name: 'Discard saved draft' })).toBeDefined();
    localStorage.removeItem('hari-form-draft-draft-discard');
  });
});
