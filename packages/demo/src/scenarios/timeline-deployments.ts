import { v4 as uuid } from 'uuid';
import type { IntentPayloadInput } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// Timeline scenario: "API Gateway deployment history"
//
// Demonstrates the timeline intent type with a deployment history showing
// completed releases, in-progress rollouts, incidents, and rollbacks.
// Grouped by week; colour-coded by category.
// ─────────────────────────────────────────────────────────────────────────────

export const timelineDeploymentsIntent: IntentPayloadInput = {
  version: '1.0.0',
  intentId: uuid(),
  type: 'timeline',
  domain: 'ops',
  primaryGoal: 'Show the API Gateway deployment and incident history for the last 30 days',
  confidence: 0.95,
  density: 'operator',
  layoutHint: 'timeline',

  data: {
    title: 'API Gateway — Deployment History (Feb 2026)',
    direction: 'vertical',
    showTimestamps: true,
    groupBy: 'week',
    executiveCap: 5,
    events: [
      // ── Week of 2026-01-26 ─────────────────────────────────────────────────
      {
        id: 'deploy-v1-18-0',
        title: 'Deploy v1.18.0',
        description: 'Gateway: rate-limiting overhaul, improved circuit breaker defaults.',
        timestamp: '2026-01-26T10:42:00',
        endTimestamp: '2026-01-26T10:58:00',
        category: 'deploy',
        status: 'completed',
        icon: '🚀',
        metadata: {
          service: 'api-gateway',
          version: 'v1.18.0',
          environment: 'production',
          deployed_by: 'alice@example.com',
          rollout_strategy: 'canary (10 → 100%)',
        },
        explainElementId: 'deploy-v1-18-explain',
      },
      {
        id: 'config-rate-limit',
        title: 'Rate-limit config push',
        description: 'Adjusted per-tenant rate limits after load test results.',
        timestamp: '2026-01-28T14:10:00',
        category: 'config',
        status: 'completed',
        icon: '⚙',
        metadata: {
          changed_by: 'bob@example.com',
          config_key: 'gateway.rateLimit.perTenant',
          old_value: '1000 req/min',
          new_value: '2000 req/min',
        },
      },

      // ── Week of 2026-02-02 ─────────────────────────────────────────────────
      {
        id: 'incident-p2-0203',
        title: 'P2 Incident: elevated 5xx on EU cluster',
        description: 'Elevated error rates (4.2%) traced to misconfigured upstream timeout after rate-limit config change.',
        timestamp: '2026-02-03T08:17:00',
        endTimestamp: '2026-02-03T09:44:00',
        category: 'incident',
        status: 'completed',
        icon: '🔥',
        metadata: {
          severity: 'P2',
          duration: '87 min',
          affected_region: 'EU-WEST',
          error_rate_peak: '4.2%',
          root_cause: 'upstream timeout misconfiguration',
        },
        explainElementId: 'incident-0203-explain',
      },
      {
        id: 'hotfix-v1-18-1',
        title: 'Hotfix v1.18.1 — upstream timeout fix',
        description: 'Reverted upstream timeout to 30 s; resolves EU 5xx spike.',
        timestamp: '2026-02-03T10:05:00',
        endTimestamp: '2026-02-03T10:18:00',
        category: 'deploy',
        status: 'completed',
        icon: '🩹',
        metadata: {
          service: 'api-gateway',
          version: 'v1.18.1',
          environment: 'production',
          deployed_by: 'carol@example.com',
          rollout_strategy: 'immediate',
        },
      },
      {
        id: 'deploy-v1-19-0',
        title: 'Deploy v1.19.0',
        description: 'mTLS between gateway and backend services; OTEL trace propagation.',
        timestamp: '2026-02-06T11:30:00',
        endTimestamp: '2026-02-06T11:55:00',
        category: 'deploy',
        status: 'completed',
        icon: '🚀',
        metadata: {
          service: 'api-gateway',
          version: 'v1.19.0',
          environment: 'production',
          deployed_by: 'alice@example.com',
          rollout_strategy: 'canary (5 → 25 → 100%)',
          jira: 'GW-412',
        },
      },

      // ── Week of 2026-02-09 ─────────────────────────────────────────────────
      {
        id: 'cert-rotation',
        title: 'TLS cert rotation',
        description: 'Automated annual cert rotation for *.api.example.com — zero downtime.',
        timestamp: '2026-02-10T03:00:00',
        category: 'config',
        status: 'completed',
        icon: '🔐',
        metadata: {
          changed_by: 'cert-bot (automated)',
          cert_expiry_before: '2026-02-14',
          cert_expiry_after: '2027-02-10',
        },
      },
      {
        id: 'deploy-v1-20-0',
        title: 'Deploy v1.20.0',
        description: 'Async request queue for downstream rate-limited services.',
        timestamp: '2026-02-12T14:00:00',
        endTimestamp: '2026-02-12T14:22:00',
        category: 'deploy',
        status: 'completed',
        icon: '🚀',
        metadata: {
          service: 'api-gateway',
          version: 'v1.20.0',
          environment: 'production',
          deployed_by: 'dave@example.com',
          rollout_strategy: 'blue-green',
          jira: 'GW-430',
        },
      },

      // ── Week of 2026-02-16 ─────────────────────────────────────────────────
      {
        id: 'scale-out-0217',
        title: 'Horizontal scale-out × 4 nodes',
        description: 'Pre-emptive capacity increase ahead of marketing campaign on 2026-02-18.',
        timestamp: '2026-02-17T09:00:00',
        category: 'config',
        status: 'completed',
        icon: '📈',
        metadata: {
          region: 'US-EAST, EU-WEST',
          node_count_before: 6,
          node_count_after: 10,
          approved_by: 'alice@example.com',
        },
      },
      {
        id: 'incident-p1-0218',
        title: 'P1 Incident: gateway unresponsive (US-EAST)',
        description: 'Memory leak in v1.20.0 async queue caused OOM on US-EAST nodes after sustained 2× traffic. Rolled back to v1.19.0.',
        timestamp: '2026-02-18T13:02:00',
        endTimestamp: '2026-02-18T13:49:00',
        category: 'incident',
        status: 'completed',
        icon: '🔥',
        metadata: {
          severity: 'P1',
          duration: '47 min',
          affected_region: 'US-EAST',
          error_rate_peak: '38%',
          root_cause: 'memory leak in async queue (v1.20.0)',
          action: 'rollback to v1.19.0',
        },
        explainElementId: 'incident-p1-explain',
      },
      {
        id: 'rollback-v1-19-0',
        title: 'Rollback → v1.19.0',
        description: 'Emergency rollback from v1.20.0 to stable v1.19.0 across all nodes.',
        timestamp: '2026-02-18T13:52:00',
        endTimestamp: '2026-02-18T14:06:00',
        category: 'deploy',
        status: 'completed',
        icon: '⏪',
        metadata: {
          service: 'api-gateway',
          version: 'v1.19.0',
          environment: 'production',
          deployed_by: 'carol@example.com',
          rollout_strategy: 'immediate rollback',
        },
      },

      // ── Week of 2026-02-23 ─────────────────────────────────────────────────
      {
        id: 'deploy-v1-20-1',
        title: 'Deploy v1.20.1 (memory-leak fix)',
        description: 'Patched async queue memory leak; staged canary to 10% of US-EAST traffic.',
        timestamp: '2026-02-23T11:15:00',
        endTimestamp: '2026-02-23T11:32:00',
        category: 'deploy',
        status: 'in_progress',
        icon: '🚀',
        metadata: {
          service: 'api-gateway',
          version: 'v1.20.1',
          environment: 'production',
          deployed_by: 'alice@example.com',
          rollout_strategy: 'canary (10%)',
          canary_health: '✓ 0 errors in 17 min',
          jira: 'GW-441',
        },
        explainElementId: 'deploy-v1-20-1-explain',
      },
    ],
  },

  explainability: {
    title: 'Why is this timeline shown?',
    summary: 'You asked for the recent deployment history of the API Gateway. The agent retrieved the last 30 days of deploy, config, and incident events from the CI/CD and incident tracking systems.',
    confidence: 0.95,
    elements: {
      'deploy-v1-18-explain': {
        label: 'v1.18.0 Deploy',
        reasoning: 'v1.18.0 introduced the rate-limiting overhaul that was the root cause of the subsequent EU incident. Highlighted for causal traceability.',
        confidence: 0.91,
        sources: [{ label: 'CI/CD log', url: '#' }],
      },
      'incident-0203-explain': {
        label: 'EU 5xx incident',
        reasoning: 'The upstream timeout misconfiguration was introduced by the config push on 2026-01-28, which changed a value the incident responders later identified as the trigger.',
        confidence: 0.93,
        sources: [{ label: 'Incident tracker INC-0381', url: '#' }],
      },
      'incident-p1-explain': {
        label: 'P1 Memory OOM',
        reasoning: 'A memory leak in the v1.20.0 async queue (GW-430) caused OOM under sustained 2× load from the marketing campaign. The fix (v1.20.1, GW-441) is currently in canary.',
        confidence: 0.97,
        sources: [
          { label: 'Incident report INC-0412', url: '#' },
          { label: 'JIRA GW-441', url: '#' },
        ],
      },
      'deploy-v1-20-1-explain': {
        label: 'Current canary',
        reasoning: 'v1.20.1 is currently at 10% canary traffic with no errors in 17 min. The agent flagged it as in-progress because full rollout is pending validation.',
        confidence: 0.98,
        sources: [{ label: 'Deployment dashboard', url: '#' }],
      },
    },
  },
};
