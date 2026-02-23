import { v4 as uuid } from 'uuid';
import type { IntentPayloadInput } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// Calendar scenario: "Engineering on-call & release schedule"
//
// Demonstrates the calendar intent type with a mix of all-day events
// (releases, sprints), timed events (team meetings, incidents) and
// recurring entries across multiple categories.
// ─────────────────────────────────────────────────────────────────────────────

// Anchor date: 2026-02-23  (today in the demo)
export const calendarOnCallIntent: IntentPayloadInput = {
  version: '1.0.0',
  intentId: uuid(),
  type: 'calendar',
  domain: 'engineering',
  primaryGoal: 'Show engineering on-call rotation and release milestones',
  confidence: 0.97,
  density: 'operator',
  layoutHint: 'timeline',

  data: {
    title: 'Engineering Schedule — Feb / Mar 2026',
    view: 'week',
    focusDate: '2026-02-23',
    weekStartsOn: 1,
    events: [
      // ── Releases ───────────────────────────────────────────────────────────
      {
        id: 'rel-v2-3',
        title: 'v2.3 Release',
        description: 'Feature release: new auth flow and API v3 launch.',
        start: '2026-02-24',
        end: '2026-02-24',
        allDay: true,
        category: 'release',
        color: '#10b981',
        status: 'confirmed',
        metadata: { tag: 'v2.3.0', jira: 'REL-210' },
      },
      {
        id: 'rel-v2-4-rc',
        title: 'v2.4 RC freeze',
        description: 'Code freeze for v2.4 release candidate.',
        start: '2026-03-06',
        end: '2026-03-06',
        allDay: true,
        category: 'release',
        color: '#10b981',
        status: 'tentative',
        metadata: { tag: 'v2.4.0-rc1', jira: 'REL-225' },
      },

      // ── Sprint events ───────────────────────────────────────────────────────
      {
        id: 'sprint-17',
        title: 'Sprint 17',
        description: 'Focus: performance, tech debt reduction.',
        start: '2026-02-23',
        end: '2026-03-06',
        allDay: true,
        category: 'sprint',
        color: '#6366f1',
        status: 'confirmed',
      },
      {
        id: 'sprint-18',
        title: 'Sprint 18',
        description: 'Focus: Calendar & Tree UI intent types, API v3.',
        start: '2026-03-09',
        end: '2026-03-20',
        allDay: true,
        category: 'sprint',
        color: '#6366f1',
        status: 'confirmed',
      },

      // ── On-call rotations ───────────────────────────────────────────────────
      {
        id: 'oncall-alice',
        title: 'On-call: Alice',
        start: '2026-02-23',
        end: '2026-02-27',
        allDay: true,
        category: 'oncall',
        color: '#f59e0b',
        status: 'confirmed',
        attendees: ['alice@example.com'],
      },
      {
        id: 'oncall-bob',
        title: 'On-call: Bob',
        start: '2026-02-28',
        end: '2026-03-06',
        allDay: true,
        category: 'oncall',
        color: '#f59e0b',
        status: 'confirmed',
        attendees: ['bob@example.com'],
      },

      // ── Recurring team meetings ─────────────────────────────────────────────
      {
        id: 'standup-mon-0223',
        title: 'Daily Standup',
        start: '2026-02-23T09:00:00',
        end: '2026-02-23T09:15:00',
        category: 'meeting',
        color: '#0ea5e9',
        status: 'confirmed',
        recurrence: 'Every weekday',
        attendees: ['alice@example.com', 'bob@example.com', 'carol@example.com'],
        location: 'Zoom',
      },
      {
        id: 'standup-tue-0224',
        title: 'Daily Standup',
        start: '2026-02-24T09:00:00',
        end: '2026-02-24T09:15:00',
        category: 'meeting',
        color: '#0ea5e9',
        status: 'confirmed',
        recurrence: 'Every weekday',
        attendees: ['alice@example.com', 'bob@example.com', 'carol@example.com'],
        location: 'Zoom',
      },
      {
        id: 'standup-wed-0225',
        title: 'Daily Standup',
        start: '2026-02-25T09:00:00',
        end: '2026-02-25T09:15:00',
        category: 'meeting',
        color: '#0ea5e9',
        status: 'confirmed',
        recurrence: 'Every weekday',
        attendees: ['alice@example.com', 'bob@example.com', 'carol@example.com'],
        location: 'Zoom',
      },
      {
        id: 'standup-thu-0226',
        title: 'Daily Standup',
        start: '2026-02-26T09:00:00',
        end: '2026-02-26T09:15:00',
        category: 'meeting',
        color: '#0ea5e9',
        status: 'confirmed',
        recurrence: 'Every weekday',
        attendees: ['alice@example.com', 'bob@example.com', 'carol@example.com'],
        location: 'Zoom',
      },
      {
        id: 'standup-fri-0227',
        title: 'Daily Standup',
        start: '2026-02-27T09:00:00',
        end: '2026-02-27T09:15:00',
        category: 'meeting',
        color: '#0ea5e9',
        status: 'confirmed',
        recurrence: 'Every weekday',
        attendees: ['alice@example.com', 'bob@example.com', 'carol@example.com'],
        location: 'Zoom',
      },

      // ── Planning & review ───────────────────────────────────────────────────
      {
        id: 'sprint-planning-17',
        title: 'Sprint 17 Planning',
        start: '2026-02-23T14:00:00',
        end: '2026-02-23T16:00:00',
        category: 'meeting',
        color: '#0ea5e9',
        status: 'confirmed',
        attendees: ['alice@example.com', 'bob@example.com', 'carol@example.com', 'dave@example.com'],
        location: 'Conf Room A',
        metadata: { jira: 'SPR-17', velocity: '42 pts' },
      },
      {
        id: 'retro-sprint-16',
        title: 'Sprint 16 Retrospective',
        start: '2026-02-25T15:30:00',
        end: '2026-02-25T16:30:00',
        category: 'meeting',
        color: '#8b5cf6',
        status: 'confirmed',
        attendees: ['alice@example.com', 'bob@example.com', 'carol@example.com'],
        location: 'Conf Room B',
      },
      {
        id: 'arch-review',
        title: 'Architecture Review',
        description: 'Review API v3 design doc before freeze.',
        start: '2026-02-27T10:00:00',
        end: '2026-02-27T11:30:00',
        category: 'meeting',
        color: '#0ea5e9',
        status: 'tentative',
        attendees: ['alice@example.com', 'carol@example.com', 'eve@example.com'],
        location: 'Google Meet',
      },

      // ── Incidents ───────────────────────────────────────────────────────────
      {
        id: 'incident-p1-0224',
        title: 'P1 Incident post-mortem',
        description: 'Review of DB connection pool exhaustion on 2026-02-21.',
        start: '2026-02-26T11:00:00',
        end: '2026-02-26T12:00:00',
        category: 'incident',
        color: '#ef4444',
        status: 'confirmed',
        attendees: ['alice@example.com', 'bob@example.com', 'sre@example.com'],
        location: 'Zoom',
        metadata: { severity: 'P1', duration: '47 min', root_cause: 'connection pool exhaustion' },
        explainElementId: 'incident-explain',
      },
    ],
  },

  explainability: {
    title: 'Why is this calendar shown?',
    summary: 'The agent identified that you asked about the current week\'s engineering schedule and on-call rotation.',
    confidence: 0.97,
    elements: {
      'incident-explain': {
        label: 'P1 Post-mortem',
        reasoning: 'A P1 incident occurred on 2026-02-21 (DB connection pool exhaustion affecting EU region for 47 min). The post-mortem is mandatory within 5 business days per SRE policy.',
        confidence: 0.99,
        sources: [{ label: 'Incident tracker', url: '#' }],
      },
    },
  },
};
