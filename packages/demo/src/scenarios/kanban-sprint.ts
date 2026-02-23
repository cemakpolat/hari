import { v4 as uuid } from 'uuid';
import type { IntentPayloadInput } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// Kanban scenario: "Sprint 17 board — Platform Engineering"
//
// Demonstrates the kanban intent type with a 5-column sprint board showing
// tasks in different states. Includes WIP limits, priorities, assignees,
// tags, due dates, and metadata visible in expert density.
// ─────────────────────────────────────────────────────────────────────────────

export const kanbanSprintIntent: IntentPayloadInput = {
  version: '1.0.0',
  intentId: uuid(),
  type: 'kanban',
  domain: 'project',
  primaryGoal: 'Show the current sprint board for Platform Engineering Sprint 17',
  confidence: 0.97,
  density: 'operator',
  layoutHint: 'dashboard',

  data: {
    title: 'Sprint 17 — Platform Engineering (Feb 23 – Mar 6)',
    showCardCount: true,
    showWipLimits: true,
    columns: [
      // ── Backlog ───────────────────────────────────────────────────────────
      {
        id: 'backlog',
        title: 'Backlog',
        color: '#94a3b8',
        wipLimit: undefined,
        cards: [
          {
            id: 'GW-445',
            title: 'API Gateway: connection pool telemetry',
            description: 'Export pool saturation and wait-time metrics via OTEL so we can alert before exhaustion.',
            priority: 'medium',
            tags: ['observability', 'api-gateway'],
            assignee: 'Noah W.',
            metadata: { story_points: 3, jira: 'GW-445', sprint_added: 'Sprint 17' },
          },
          {
            id: 'INFRA-312',
            title: 'Terraform: upgrade AWS provider to v5',
            description: 'Breaking changes in v5 require resource import path fixes across 14 modules.',
            priority: 'low',
            tags: ['terraform', 'infra'],
            assignee: undefined,
            dueDate: '2026-03-06',
            metadata: { story_points: 5, jira: 'INFRA-312' },
          },
          {
            id: 'DX-201',
            title: 'Dev env: add M-series Mac support to bootstrap script',
            description: 'Several new hires have M3 Macs; Rosetta workarounds are causing daily friction.',
            priority: 'medium',
            tags: ['dx', 'tooling'],
            assignee: 'Kim N.',
            metadata: { story_points: 2, jira: 'DX-201', reporter: 'leo@example.com' },
          },
        ],
      },

      // ── In Progress ───────────────────────────────────────────────────────
      {
        id: 'in-progress',
        title: 'In Progress',
        color: '#4f46e5',
        wipLimit: 4,
        cards: [
          {
            id: 'GW-441',
            title: 'Deploy v1.20.1 — async queue memory-leak fix',
            description: 'Canary at 10% on US-EAST. Expanding to 50% after 1 h green. Resolves P1 from 2026-02-18.',
            priority: 'critical',
            tags: ['api-gateway', 'hotfix', 'canary'],
            assignee: 'Alice C.',
            dueDate: '2026-02-23',
            metadata: {
              story_points: 8,
              jira: 'GW-441',
              incident: 'INC-0412',
              canary_pct: '10%',
              canary_health: '✓ 0 errors / 17 min',
            },
            explainElementId: 'gw-441-explain',
          },
          {
            id: 'INFRA-298',
            title: 'Kubernetes 1.30 upgrade — staging cluster',
            description: 'In-place upgrade of staging. Production upgrade blocked on this.',
            priority: 'high',
            tags: ['kubernetes', 'infra'],
            assignee: 'Bob O.',
            dueDate: '2026-02-25',
            metadata: {
              story_points: 5,
              jira: 'INFRA-298',
              current_version: 'k8s 1.29',
              target_version: 'k8s 1.30',
              runbook: 'runbook://k8s-upgrade',
            },
          },
          {
            id: 'DX-195',
            title: 'CI pipeline: cache node_modules across branches',
            description: 'Median build time is 11 min. Layer-caching node_modules should cut it to ~4 min.',
            priority: 'medium',
            tags: ['ci', 'performance', 'dx'],
            assignee: 'Ivan P.',
            metadata: { story_points: 3, jira: 'DX-195', build_time_p50: '11 min' },
          },
          {
            id: 'SEC-089',
            title: 'Rotate all long-lived AWS access keys → IRSA',
            description: 'Migrate 6 remaining services from static IAM keys to IRSA. Compliance deadline: 2026-02-28.',
            priority: 'high',
            tags: ['security', 'iam', 'compliance'],
            assignee: 'Frank L.',
            dueDate: '2026-02-28',
            metadata: {
              story_points: 5,
              jira: 'SEC-089',
              services_remaining: 6,
              compliance_deadline: '2026-02-28',
            },
          },
        ],
      },

      // ── In Review ─────────────────────────────────────────────────────────
      {
        id: 'in-review',
        title: 'In Review',
        color: '#0ea5e9',
        wipLimit: 3,
        cards: [
          {
            id: 'DP-077',
            title: 'Kafka topic: per-tenant partitioning strategy',
            description: 'PR #2341 — changes partition key schema. Needs architecture sign-off before merge.',
            priority: 'high',
            tags: ['kafka', 'data-platform'],
            assignee: 'Maya T.',
            dueDate: '2026-02-24',
            metadata: { story_points: 5, jira: 'DP-077', pr: '2341', reviewer: 'alice@example.com' },
          },
          {
            id: 'INFRA-305',
            title: 'Grafana: on-call dashboard v2',
            description: 'Redesigned SRE overview: MTTR, error budget burn, active incidents, on-call schedule widget.',
            priority: 'medium',
            tags: ['observability', 'grafana'],
            assignee: 'Carol Y.',
            metadata: { story_points: 3, jira: 'INFRA-305', pr: '2289' },
          },
        ],
      },

      // ── Done ──────────────────────────────────────────────────────────────
      {
        id: 'done',
        title: 'Done',
        color: '#10b981',
        wipLimit: undefined,
        cards: [
          {
            id: 'GW-412',
            title: 'Gateway: mTLS between gateway and backends',
            description: 'Shipped in v1.19.0. All inter-service traffic is now mutually authenticated.',
            priority: 'high',
            tags: ['security', 'api-gateway'],
            assignee: 'Alice C.',
            metadata: { story_points: 8, jira: 'GW-412', shipped_in: 'v1.19.0' },
          },
          {
            id: 'DX-188',
            title: 'Internal docs platform: search revamp',
            description: 'Replaced Algolia with Typesense; latency p99 improved from 450 ms to 38 ms.',
            priority: 'medium',
            tags: ['dx', 'search'],
            assignee: 'Leo R.',
            metadata: {
              story_points: 5,
              jira: 'DX-188',
              latency_before: '450 ms (p99)',
              latency_after: '38 ms (p99)',
            },
          },
          {
            id: 'SEC-084',
            title: 'Enable AWS GuardDuty in all accounts',
            description: 'Activated in production, staging, and dev. First findings triaged.',
            priority: 'high',
            tags: ['security', 'aws'],
            assignee: 'Grace P.',
            metadata: { story_points: 3, jira: 'SEC-084', accounts: 3 },
          },
          {
            id: 'INFRA-291',
            title: 'Cert-manager: auto-renew wildcard TLS certs',
            description: 'Automated cert rotation for *.api.example.com — no more manual 4 AM renewals.',
            priority: 'medium',
            tags: ['infra', 'tls'],
            assignee: 'Eve K.',
            metadata: { story_points: 2, jira: 'INFRA-291' },
          },
        ],
      },

      // ── Blocked ───────────────────────────────────────────────────────────
      {
        id: 'blocked',
        title: 'Blocked',
        color: '#ef4444',
        wipLimit: 2,
        cards: [
          {
            id: 'DP-071',
            title: 'Snowflake: row-level security for GDPR',
            description: 'Blocked on Legal review of the row-filter policy. Review meeting scheduled 2026-02-26.',
            priority: 'high',
            tags: ['data-platform', 'gdpr', 'compliance'],
            assignee: 'Priya S.',
            dueDate: '2026-03-01',
            metadata: {
              story_points: 8,
              jira: 'DP-071',
              blocker: 'Legal review (meeting 2026-02-26)',
              compliance_deadline: '2026-03-31',
            },
            explainElementId: 'dp-071-explain',
          },
        ],
      },
    ],
  },

  explainability: {
    title: 'Why is this board shown?',
    summary: 'You asked about the current sprint status for Platform Engineering. The agent retrieved Sprint 17 data from the project tracker and rendered it as a kanban board.',
    confidence: 0.97,
    elements: {
      'gw-441-explain': {
        label: 'GW-441 is critical',
        reasoning: 'This card resolves the P1 incident from 2026-02-18 (INC-0412) that caused 47 min of elevated errors on US-EAST. It is the highest-priority item on the board and is currently in canary.',
        confidence: 0.99,
        sources: [{ label: 'Incident INC-0412', url: '#' }, { label: 'JIRA GW-441', url: '#' }],
      },
      'dp-071-explain': {
        label: 'DP-071 is blocked',
        reasoning: 'GDPR row-level security requires Legal sign-off before the filtering policy can go live in production. Without it the feature cannot be deployed, and the compliance deadline is 2026-03-31.',
        confidence: 0.95,
        sources: [{ label: 'JIRA DP-071', url: '#' }],
      },
    },
  },
};
