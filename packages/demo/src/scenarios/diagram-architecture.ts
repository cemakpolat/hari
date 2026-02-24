import { v4 as uuid } from 'uuid';
import type { IntentPayloadInput } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// Diagram scenario: "System Architecture Overview"
//
// Demonstrates all three DiagramRenderer sub-kinds:
//   1. Mermaid  — service dependency flowchart
//   2. Graph    — microservice topology (nodes + edges)
//   3. Chart    — API latency & error-rate bar/line charts
// ─────────────────────────────────────────────────────────────────────────────

export const diagramArchitectureIntent: IntentPayloadInput = {
  version: '1.0.0',
  intentId: uuid(),
  type: 'diagram',
  domain: 'engineering',
  primaryGoal: 'Visualise system architecture, service topology, and performance metrics',
  confidence: 0.96,
  density: 'operator',

  data: {
    title: 'System Architecture Overview',
    description:
      'Three complementary views of the platform: a high-level Mermaid flowchart, ' +
      'an interactive service-dependency graph, and API performance charts.',

    diagrams: [
      // ── 1. Mermaid flowchart ──────────────────────────────────────────────
      {
        id: 'mermaid-arch',
        kind: 'mermaid',
        title: 'Request Flow (Mermaid)',
        markup: `flowchart LR
    Client([Browser / Mobile])
    CDN[CDN / Edge]
    GW[API Gateway]
    Auth[Auth Service]
    API[Core API]
    Queue[(Message Queue)]
    Worker[Background Worker]
    DB[(PostgreSQL)]
    Cache[(Redis Cache)]
    S3[(Object Store)]

    Client -->|HTTPS| CDN
    CDN -->|Cache miss| GW
    GW -->|JWT verify| Auth
    Auth -.->|token valid| GW
    GW -->|REST / gRPC| API
    API -->|read / write| DB
    API -->|cache lookup| Cache
    API -->|enqueue job| Queue
    Queue -->|consume| Worker
    Worker -->|store artefacts| S3
    Worker -->|update status| DB`,
        caption: 'End-to-end request path from client through CDN, gateway, core API, and async workers.',
      },

      // ── 2. Graph — microservice topology ─────────────────────────────────
      {
        id: 'graph-services',
        kind: 'graph',
        title: 'Microservice Dependency Graph',
        layout: 'hierarchy',
        caption: 'Layout: frontend clients → gateway → core services → data layer. Hover in expert density to see metadata.',
        nodes: [
          // Frontend
          { id: 'web',      label: 'Web App',      group: 'frontend',  shape: 'circle', icon: '🌐', metadata: { version: 'v3.2.1', team: 'frontend' } },
          { id: 'mobile',   label: 'Mobile',        group: 'frontend',  shape: 'circle', icon: '📱', metadata: { version: 'v2.1.0', team: 'frontend' } },
          // Gateway
          { id: 'gw',       label: 'API Gateway',   group: 'gateway',   shape: 'diamond', icon: '🔀', metadata: { rps: '12 000', p99: '8 ms' } },
          { id: 'auth',     label: 'Auth',           group: 'gateway',   shape: 'circle', icon: '🔐', metadata: { provider: 'JWT/OAuth2' } },
          // Core services
          { id: 'users',    label: 'Users',          group: 'core',      shape: 'circle', icon: '👤', metadata: { slo: '99.9%' } },
          { id: 'orders',   label: 'Orders',         group: 'core',      shape: 'circle', icon: '📦', metadata: { slo: '99.95%' } },
          { id: 'payments', label: 'Payments',       group: 'core',      shape: 'circle', icon: '💳', metadata: { pci: 'compliant', slo: '99.99%' } },
          { id: 'notify',   label: 'Notifications',  group: 'core',      shape: 'circle', icon: '🔔', metadata: { channels: 'email, push, sms' } },
          // Data
          { id: 'pg',       label: 'PostgreSQL',     group: 'data',      shape: 'square', icon: '🗄', metadata: { version: '15', replicas: '2' } },
          { id: 'redis',    label: 'Redis',           group: 'data',      shape: 'square', icon: '⚡', metadata: { mode: 'cluster', memory: '32 GB' } },
          { id: 'mq',       label: 'RabbitMQ',       group: 'data',      shape: 'hexagon', icon: '🐇', metadata: { queues: '14', consumers: '8' } },
        ],
        edges: [
          { source: 'web',      target: 'gw',       directed: true,  style: 'solid',  weight: 2 },
          { source: 'mobile',   target: 'gw',       directed: true,  style: 'solid',  weight: 2 },
          { source: 'gw',       target: 'auth',     directed: true,  style: 'dashed', label: 'verify', weight: 1 },
          { source: 'gw',       target: 'users',    directed: true,  style: 'solid',  weight: 2 },
          { source: 'gw',       target: 'orders',   directed: true,  style: 'solid',  weight: 2 },
          { source: 'gw',       target: 'payments', directed: true,  style: 'solid',  weight: 1.5 },
          { source: 'orders',   target: 'payments', directed: true,  style: 'solid',  label: 'charge', weight: 1.5 },
          { source: 'orders',   target: 'notify',   directed: true,  style: 'dashed', label: 'event', weight: 1 },
          { source: 'payments', target: 'notify',   directed: true,  style: 'dashed', label: 'receipt', weight: 1 },
          { source: 'users',    target: 'pg',        directed: true,  style: 'solid',  weight: 1.5 },
          { source: 'orders',   target: 'pg',        directed: true,  style: 'solid',  weight: 1.5 },
          { source: 'payments', target: 'pg',        directed: true,  style: 'solid',  weight: 1.5 },
          { source: 'users',    target: 'redis',     directed: true,  style: 'dotted', label: 'cache', weight: 1 },
          { source: 'orders',   target: 'mq',        directed: true,  style: 'dashed', label: 'publish', weight: 1 },
          { source: 'notify',   target: 'mq',        directed: false, style: 'dashed', label: 'consume', weight: 1 },
        ],
      },

      // ── 3a. Bar chart — p99 API latency ──────────────────────────────────
      {
        id: 'chart-latency',
        kind: 'chart',
        chartType: 'bar',
        title: 'p99 API Latency by Service (ms)',
        unit: ' ms',
        yZeroBased: true,
        labels: ['Users', 'Orders', 'Payments', 'Auth', 'Notify'],
        series: [
          {
            name: 'Last 24 h',
            color: '#6366f1',
            values: [18, 42, 67, 12, 28],
          },
          {
            name: 'Last 7 d avg',
            color: '#0ea5e9',
            values: [22, 38, 58, 10, 31],
          },
        ],
        caption: 'Lower is better. Payments service breached SLO threshold this morning.',
      },

      // ── 3b. Line chart — error rates ─────────────────────────────────────
      {
        id: 'chart-errors',
        kind: 'chart',
        chartType: 'area',
        title: 'API Error Rate over 6 Hours (%)',
        unit: '%',
        yZeroBased: true,
        labels: ['00:00', '01:00', '02:00', '03:00', '04:00', '05:00'],
        series: [
          {
            name: '5xx errors',
            color: '#ef4444',
            values: [0.12, 0.08, 0.15, 1.82, 0.95, 0.21],
          },
          {
            name: '4xx errors',
            color: '#f59e0b',
            values: [0.45, 0.38, 0.51, 0.62, 0.48, 0.43],
          },
        ],
        caption: '5xx spike at 03:00 correlated with Payments DB connection pool exhaustion.',
      },

      // ── 4. Pie chart — traffic share ──────────────────────────────────────
      {
        id: 'chart-traffic',
        kind: 'chart',
        chartType: 'pie',
        title: 'Traffic Distribution by Service',
        unit: ' k req',
        labels: ['Users', 'Orders', 'Payments', 'Auth', 'Notify', 'Other'],
        series: [
          {
            name: 'Requests (24 h)',
            values: [320, 185, 97, 430, 64, 42],
          },
        ],
        caption: 'Auth traffic dominates due to short JWT TTL (15 min) causing frequent refreshes.',
      },
    ],
  },

  actions: [
    {
      id: 'export-diagram',
      label: 'Export diagrams',
      description: 'Download all diagrams as PNG / SVG bundle',
      variant: 'secondary',
    },
    {
      id: 'run-health-check',
      label: 'Run health check',
      description: 'Trigger a live health-check probe across all services',
      variant: 'primary',
      safety: {
        confidence: 0.98,
        reversible: true,
        requiresConfirmation: false,
        riskLevel: 'low',
      },
    },
  ],
};
