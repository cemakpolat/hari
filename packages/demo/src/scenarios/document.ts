import { v4 as uuid } from 'uuid';
import type { IntentPayloadInput } from '@hari/core';
import type { DocumentData } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// AI-generated SRE Post-Mortem — "living document" demo scenario.
//
// Demonstrates the 'document' intent type:
//   - Multi-section structure with headings, paragraphs, callouts, code, metrics
//   - Per-section AI confidence indicators (drives visual treatment in renderer)
//   - Linked explainability elements for key findings
//   - Ambiguity controls: report depth (summary vs full) and AI annotation toggle
//   - Actions: acknowledge the report, escalate, export
// ─────────────────────────────────────────────────────────────────────────────

const documentData: DocumentData = {
  title: 'Incident Post-Mortem: Database Replication Lag',
  author: 'AI SRE Assistant',
  publishedAt: '2026-02-22T07:42:00Z',
  revision: 2,
  summary:
    'A spike in write latency caused replication lag to exceed 45 s on the primary ' +
    'replica.  The incident was contained within 23 minutes; no data loss occurred. ' +
    'Root cause: a poorly-indexed bulk-import job saturated the WAL writer thread.',

  sections: [
    {
      id: 'exec-summary',
      title: 'Executive Summary',
      confidence: 0.97,
      blocks: [
        {
          type: 'callout',
          variant: 'insight',
          title: 'Incident resolved — no data loss',
          text:
            'The database replication lag incident (INC-2847) was detected at 06:19 UTC, ' +
            'contained at 06:42 UTC, and fully resolved by 07:15 UTC.  All replicas ' +
            'are now within 200 ms of the primary.',
        },
        {
          type: 'metric',
          label: 'Max replication lag',
          value: '47 s',
          trend: 'down',
          delta: 'Now < 200 ms',
          unit: 'seconds',
        },
        {
          type: 'metric',
          label: 'Time to detect',
          value: '4 min',
          trend: 'stable',
        },
        {
          type: 'metric',
          label: 'Time to mitigate',
          value: '23 min',
          trend: 'stable',
        },
        {
          type: 'metric',
          label: 'Customer impact',
          value: 'Read-only degradation',
          trend: 'stable',
        },
      ],
    },

    {
      id: 'root-cause',
      title: 'Root Cause Analysis',
      confidence: 0.88,
      explainElementId: 'explain-root-cause',
      blocks: [
        {
          type: 'paragraph',
          text:
            'The primary root cause was a scheduled bulk-import job (job ID: etl-nightly-42) ' +
            'that executed a 3.2 M-row INSERT without the target table having an appropriate ' +
            'composite index on (tenant_id, created_at).  This caused a full sequential scan ' +
            'on every row-level conflict check, generating an abnormally large Write-Ahead Log ' +
            '(WAL) volume in a short window.',
          confidence: 0.88,
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'Contributing factor',
          text:
            'Replica autovacuum was running concurrently on the same table, amplifying ' +
            'I/O contention and extending the lag window by an estimated 8–12 minutes.',
        },
        {
          type: 'heading',
          level: 4,
          text: 'Offending query',
        },
        {
          type: 'code',
          language: 'sql',
          code:
            'INSERT INTO events (tenant_id, created_at, payload)\n' +
            'SELECT tenant_id, created_at, payload\n' +
            'FROM staging.events_import\n' +
            'ON CONFLICT (tenant_id, event_uuid) DO UPDATE\n' +
            '  SET payload = EXCLUDED.payload;\n' +
            '\n' +
            '-- Missing index on (tenant_id, created_at) caused 3.2M sequential checks.',
        },
      ],
    },

    {
      id: 'timeline',
      title: 'Timeline',
      confidence: 0.96,
      blocks: [
        {
          type: 'list',
          ordered: true,
          items: [
            '06:15 UTC — etl-nightly-42 job starts on primary (scheduled, unattended)',
            '06:19 UTC — Datadog alert: replica lag > 10 s; PagerDuty page fires',
            '06:22 UTC — On-call SRE acknowledges; begins investigation',
            '06:28 UTC — Root cause identified: bulk INSERT saturating WAL writer',
            '06:31 UTC — Decision: cancel ETL job and reschedule with index in place',
            '06:42 UTC — ETL job cancelled; WAL backlog clears; lag drops below 2 s',
            '07:10 UTC — Composite index created on production (non-blocking CONCURRENTLY)',
            '07:15 UTC — All replicas within 200 ms; incident closed',
          ],
        },
      ],
    },

    {
      id: 'affected-systems',
      title: 'Affected Systems',
      confidence: 0.99,
      blocks: [
        {
          type: 'list',
          ordered: false,
          items: [
            'pg-primary-us-east-1 — elevated write latency (P99: 840 ms, baseline: 12 ms)',
            'pg-replica-us-east-1a — replication lag peak 47 s',
            'pg-replica-us-east-1b — replication lag peak 43 s',
            'API gateway (read endpoints) — 503 rate 0.7% during degraded window',
            'Event search (Elasticsearch) — indexing delay ~35 s due to upstream lag',
          ],
        },
      ],
    },

    {
      id: 'divider-1',
      blocks: [{ type: 'divider' }],
    },

    {
      id: 'recommendations',
      title: 'Prevention Recommendations',
      confidence: 0.82,
      explainElementId: 'explain-recommendations',
      blocks: [
        {
          type: 'paragraph',
          text:
            'The following recommendations have been identified by the AI SRE Assistant. ' +
            'Confidence in their impact is rated per-item.',
          confidence: 0.82,
        },
        {
          type: 'callout',
          variant: 'insight',
          title: 'High impact · Low effort',
          text:
            'Add index on events(tenant_id, created_at) using CREATE INDEX CONCURRENTLY ' +
            'before re-running the ETL job.  Estimated to reduce WAL volume by 94%.',
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'Medium impact · Medium effort',
          text:
            'Implement a query governor that throttles bulk INSERT jobs when primary WAL ' +
            'flush latency exceeds a configurable threshold (recommended: 50 ms).',
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'Medium impact · Low effort',
          text:
            'Disable autovacuum on replica during known bulk-import windows using ' +
            'pg_cancel_backend() or ALTER TABLE … autovacuum_enabled = false temporarily.',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Add replication lag SLO: alert at 5 s, page at 15 s (current thresholds too high)',
            'Require EXPLAIN ANALYZE review for all ETL jobs touching > 500 K rows',
            'Add pre-flight index validation step to ETL pipeline CI',
          ],
        },
      ],
    },
  ],
};

// Satisfy the TypeScript cast — data is typed as Record<string, unknown> in IntentPayload
const data = documentData as unknown as Record<string, unknown>;

export const documentIntent: IntentPayloadInput = {
  version: '1.0.0',
  intentId: uuid(),
  type: 'document',
  domain: 'reports',
  primaryGoal: 'Review AI-generated post-mortem for incident INC-2847',
  confidence: 0.91,
  density: 'operator',
  data,

  ambiguities: [
    {
      id: 'report-depth',
      label: 'Report depth',
      description: 'How much detail to show in the rendered document.',
      type: 'single_select',
      options: [
        { value: 'summary',  label: 'Summary only' },
        { value: 'standard', label: 'Standard'      },
        { value: 'full',     label: 'Full detail'   },
      ],
      value: 'standard',
      parameterKey: 'reportDepth',
    },
    {
      id: 'show-confidence',
      label: 'Show AI confidence',
      description: 'Display per-section and per-paragraph confidence indicators.',
      type: 'toggle',
      value: true,
      parameterKey: 'showConfidence',
    },
  ],

  priorityFields: ['summary', 'root-cause', 'recommendations'],

  actions: [
    {
      id: 'acknowledge-report',
      label: 'Acknowledge',
      description: 'Mark the post-mortem as reviewed by your team.',
      variant: 'primary',
      safety: {
        confidence: 0.99,
        reversible: true,
        riskLevel: 'low',
        requiresConfirmation: false,
      },
    },
    {
      id: 'escalate-report',
      label: 'Escalate to VP Eng',
      description: 'Flag this incident for executive review.',
      variant: 'destructive',
      safety: {
        confidence: 0.92,
        reversible: false,
        riskLevel: 'medium',
        requiresConfirmation: true,
        confirmationDelay: 3000,
        explanation: 'This will page the VP of Engineering and create a formal escalation record.',
        blastRadius: {
          scope: 'org',
          affectedSystems: ['pagerduty', 'email', 'jira'],
          downstreamEffects: 'VP Eng will be paged immediately; JIRA escalation ticket created.',
        },
      },
    },
    {
      id: 'export-pdf',
      label: 'Export PDF',
      description: 'Download this post-mortem as a PDF for sharing.',
      variant: 'secondary',
      safety: {
        confidence: 0.99,
        reversible: true,
        riskLevel: 'low',
        requiresConfirmation: false,
      },
    },
  ],

  explainability: {
    'explain-root-cause': {
      elementId: 'explain-root-cause',
      summary:
        'Root cause was identified by correlating WAL write amplification metrics ' +
        'with the ETL job execution window and cross-referencing with pg_stat_activity ' +
        'snapshots taken every 10 s during the incident.',
      dataSources: [
        { name: 'pg_stat_activity snapshots', type: 'database', freshness: '2026-02-22T06:30:00Z', reliability: 0.99 },
        { name: 'Datadog metrics (WAL flush latency)', type: 'api', freshness: '2026-02-22T06:42:00Z', reliability: 0.97 },
      ],
      assumptions: [
        'WAL flush latency spike from 8 ms → 640 ms at 06:16 UTC',
        'etl-nightly-42 appeared in pg_stat_activity with state=active throughout',
        'No composite index on events(tenant_id, created_at) confirmed via \\d+ events',
      ],
      alternativesConsidered: [
        {
          description: 'Network partition between primary and replica',
          reason: 'Ruled out — no packet loss or latency spike detected on network monitors.',
        },
        {
          description: 'Hardware disk degradation on primary',
          reason: 'Ruled out — I/O latency on primary was within normal bounds throughout.',
        },
      ],
      whatIfQueries: [
        'What if the index had been in place?',
        'What if autovacuum had been paused during the import?',
        'How long until replicas fully catch up at current lag rate?',
      ],
    },
    'explain-recommendations': {
      elementId: 'explain-recommendations',
      summary:
        'Recommendations are ranked by (estimated impact × implementation speed). ' +
        'The index fix is the critical path item; governance and SLO changes are ' +
        'complementary hardening measures.',
      dataSources: [
        { name: 'PostgreSQL WAL tuning guidelines', type: 'database', reliability: 0.95 },
        { name: 'Historical incident corpus (INC-2801, INC-2734)', type: 'database', reliability: 0.88 },
      ],
      assumptions: [
        'Index addition eliminates sequential conflict checks (root cause)',
        'Query governor prevents recurrence even if index is accidentally dropped',
        'SLO tightening reduces detection latency for future similar incidents',
      ],
      alternativesConsidered: [
        {
          description: 'Increase replica count to absorb lag spikes',
          reason: 'Treats symptom not cause; does not prevent WAL saturation.',
        },
      ],
      whatIfQueries: [
        'What if we skip the index and just add retries?',
        'How much does the query governor reduce P99 write latency?',
        'What is the risk of running CREATE INDEX CONCURRENTLY during business hours?',
      ],
    },
  },

  explain: false,
};
