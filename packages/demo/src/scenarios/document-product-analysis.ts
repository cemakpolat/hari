import { v4 as uuid } from 'uuid';
import type { IntentPayloadInput, DocumentData } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// Enhanced Document scenario: "Q4 Product Performance Analysis"
//
// Demonstrates the full spectrum of document block types including:
//   - Tables (performance comparison)
//   - Images (charts, diagrams)
//   - Quotes (customer feedback)
//   - Data visualizations (sparklines, trends)
//   - Embedded content (interactive dashboards)
//   - All standard blocks (headings, paragraphs, code, callouts, etc.)
//
// This showcases HARI's capability to render rich, long-form content
// that agents can generate for reports, documentation, and analysis.
// ─────────────────────────────────────────────────────────────────────────────

const documentData: DocumentData = {
  title: 'Q4 2025 Product Performance Analysis',
  author: 'AI Product Analytics Assistant',
  publishedAt: '2026-02-22T10:00:00Z',
  revision: 1,
  summary:
    'Comprehensive analysis of product metrics for Q4 2025, covering user engagement, ' +
    'revenue performance, and feature adoption. Overall product health score: 8.2/10 ' +
    'with strong growth in mobile engagement and enterprise tier conversions.',
  refreshable: true,
  refreshInterval: 3600,
  tags: ['quarterly-report', 'product-analytics', 'performance'],
  sources: ['Amplitude', 'Stripe', 'Customer.io', 'Salesforce'],

  sections: [
    {
      id: 'overview',
      title: 'Executive Overview',
      confidence: 0.95,
      blocks: [
        {
          type: 'callout',
          variant: 'insight',
          title: 'Key Takeaway',
          text:
            'Q4 2025 showed exceptional growth with 34% increase in DAU, 28% revenue growth YoY, ' +
            'and successful launch of three major features. Mobile engagement exceeded projections by 42%.',
        },
        {
          type: 'heading',
          level: 3,
          text: 'Key Metrics',
        },
        {
          type: 'metric',
          label: 'Daily Active Users',
          value: '847K',
          trend: 'up',
          delta: '+34% YoY',
        },
        {
          type: 'metric',
          label: 'Revenue',
          value: '$12.4M',
          trend: 'up',
          delta: '+28% YoY',
          unit: 'USD',
        },
        {
          type: 'metric',
          label: 'NPS Score',
          value: '64',
          trend: 'up',
          delta: '+8 points',
        },
        {
          type: 'metric',
          label: 'Churn Rate',
          value: '2.1%',
          trend: 'down',
          delta: '-0.4% vs Q3',
        },
      ],
    },

    {
      id: 'user-engagement',
      title: 'User Engagement Analysis',
      confidence: 0.92,
      blocks: [
        {
          type: 'paragraph',
          text:
            'User engagement saw significant improvements across all segments, with mobile users ' +
            'showing the strongest growth pattern. The introduction of push notifications and ' +
            'in-app messaging drove a 57% increase in session frequency.',
          confidence: 0.92,
        },
        {
          type: 'heading',
          level: 4,
          text: 'Engagement Trend (Last 90 Days)',
        },
        {
          type: 'dataviz',
          chartType: 'sparkline',
          data: [
            { x: 1, y: 620 },
            { x: 2, y: 645 },
            { x: 3, y: 632 },
            { x: 4, y: 678 },
            { x: 5, y: 701 },
            { x: 6, y: 695 },
            { x: 7, y: 723 },
            { x: 8, y: 756 },
            { x: 9, y: 742 },
            { x: 10, y: 789 },
            { x: 11, y: 812 },
            { x: 12, y: 847 },
          ],
        },
        {
          type: 'table',
          caption: 'Engagement metrics by user segment',
          headers: [
            { key: 'segment', label: 'Segment', align: 'left' },
            { key: 'dau', label: 'DAU', align: 'right' },
            { key: 'sessions', label: 'Avg Sessions/Day', align: 'right' },
            { key: 'duration', label: 'Avg Duration', align: 'right' },
            { key: 'growth', label: 'QoQ Growth', align: 'right' },
          ],
          rows: [
            {
              segment: 'Free Tier',
              dau: '523K',
              sessions: '2.3',
              duration: '8m 42s',
              growth: '+31%',
            },
            {
              segment: 'Pro Tier',
              dau: '268K',
              sessions: '4.7',
              duration: '23m 15s',
              growth: '+38%',
            },
            {
              segment: 'Enterprise',
              dau: '56K',
              sessions: '6.2',
              duration: '41m 08s',
              growth: '+42%',
            },
          ],
        },
      ],
    },

    {
      id: 'revenue',
      title: 'Revenue Performance',
      confidence: 0.89,
      blocks: [
        {
          type: 'paragraph',
          text:
            'Q4 revenue reached $12.4M, a 28% year-over-year increase driven primarily by ' +
            'enterprise tier expansions and improved conversion rates on the annual billing cycle.',
          confidence: 0.89,
        },
        {
          type: 'heading',
          level: 4,
          text: 'Revenue Breakdown by Tier',
        },
        {
          type: 'table',
          headers: [
            { key: 'tier', label: 'Tier', align: 'left' },
            { key: 'mrr', label: 'MRR', align: 'right' },
            { key: 'arr', label: 'ARR', align: 'right' },
            { key: 'customers', label: 'Customers', align: 'right' },
            { key: 'arpu', label: 'ARPU', align: 'right' },
          ],
          rows: [
            {
              tier: 'Free',
              mrr: '$0',
              arr: '$0',
              customers: '523K',
              arpu: '$0',
            },
            {
              tier: 'Pro ($29/mo)',
              mrr: '$2.87M',
              arr: '$34.4M',
              customers: '98.9K',
              arpu: '$29',
            },
            {
              tier: 'Enterprise (custom)',
              mrr: '$1.51M',
              arr: '$18.1M',
              customers: '412',
              arpu: '$3,665',
            },
          ],
        },
        {
          type: 'callout',
          variant: 'insight',
          title: 'Conversion Optimization',
          text:
            'Free-to-Pro conversion rate improved from 14.2% to 18.9% following the implementation ' +
            'of personalized upgrade prompts and a streamlined checkout flow.',
        },
      ],
    },

    {
      id: 'feature-adoption',
      title: 'Feature Adoption',
      confidence: 0.91,
      blocks: [
        {
          type: 'paragraph',
          text:
            'Three major features launched in Q4: Real-time Collaboration, Advanced Analytics Dashboard, ' +
            'and API v3. Adoption rates exceeded targets across all features.',
        },
        {
          type: 'table',
          caption: 'Feature adoption rates (30 days post-launch)',
          headers: [
            { key: 'feature', label: 'Feature', align: 'left' },
            { key: 'launchDate', label: 'Launch Date', align: 'left' },
            { key: 'adoption', label: 'Adoption Rate', align: 'right' },
            { key: 'target', label: 'Target', align: 'right' },
            { key: 'status', label: 'Status', align: 'center' },
          ],
          rows: [
            {
              feature: 'Real-time Collaboration',
              launchDate: 'Oct 15',
              adoption: '47%',
              target: '35%',
              status: '✓ Exceeded',
            },
            {
              feature: 'Advanced Analytics',
              launchDate: 'Nov 1',
              adoption: '31%',
              target: '25%',
              status: '✓ Exceeded',
            },
            {
              feature: 'API v3',
              launchDate: 'Dec 1',
              adoption: '18%',
              target: '20%',
              status: '→ On Track',
            },
          ],
        },
        {
          type: 'divider',
        },
        {
          type: 'heading',
          level: 4,
          text: 'Feature Request Analysis',
        },
        {
          type: 'paragraph',
          text:
            'Top requested features from user feedback (n=2,847 responses):',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Dark mode support (requested by 68% of respondents)',
            'Offline mode for mobile app (52%)',
            'Advanced export options (PDF, Excel) (47%)',
            'Custom branding for enterprise (41%)',
            'Integration with Slack and Microsoft Teams (38%)',
          ],
        },
      ],
    },

    {
      id: 'customer-feedback',
      title: 'Customer Feedback Highlights',
      confidence: 0.87,
      blocks: [
        {
          type: 'paragraph',
          text:
            'Customer sentiment analysis from 1,243 survey responses and 847 support tickets ' +
            'reveals overwhelmingly positive feedback, with specific praise for reliability ' +
            'and customer support responsiveness.',
        },
        {
          type: 'quote',
          text:
            'The real-time collaboration feature has completely transformed how our team works. ' +
            'We\'ve reduced meeting time by 40% and increased productivity across the board.',
          author: 'Sarah Chen',
          source: 'Director of Product, TechCorp Inc.',
        },
        {
          type: 'quote',
          text:
            'Best-in-class analytics platform. The new dashboard gives us insights we never had before, ' +
            'and the API integration was seamless.',
          author: 'Michael Rodriguez',
          source: 'CTO, DataFlow Solutions',
        },
        {
          type: 'quote',
          text:
            'Support team is phenomenal. They resolved our enterprise migration in under 48 hours ' +
            'with zero downtime. Highly recommend.',
          author: 'Jennifer Park',
          source: 'VP Engineering, CloudScale Systems',
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'Areas for Improvement',
          text:
            'While overall satisfaction is high, 23% of users cited mobile app performance issues ' +
            'and 17% requested more granular permission controls for team management.',
        },
      ],
    },

    {
      id: 'technical-performance',
      title: 'Technical Performance',
      confidence: 0.94,
      blocks: [
        {
          type: 'paragraph',
          text:
            'Infrastructure reliability and performance metrics remained strong throughout Q4, ' +
            'with 99.97% uptime and P95 response times well within SLA targets.',
        },
        {
          type: 'table',
          caption: 'System performance metrics',
          headers: [
            { key: 'metric', label: 'Metric', align: 'left' },
            { key: 'q4', label: 'Q4 2025', align: 'right' },
            { key: 'q3', label: 'Q3 2025', align: 'right' },
            { key: 'target', label: 'Target', align: 'right' },
          ],
          rows: [
            { metric: 'Uptime', q4: '99.97%', q3: '99.95%', target: '99.95%' },
            { metric: 'P95 Response Time', q4: '142ms', q3: '158ms', target: '<200ms' },
            { metric: 'Error Rate', q4: '0.03%', q3: '0.05%', target: '<0.1%' },
            { metric: 'API Rate Limit Hits', q4: '0.12%', q3: '0.18%', target: '<0.5%' },
          ],
        },
        {
          type: 'heading',
          level: 4,
          text: 'Infrastructure Optimization',
        },
        {
          type: 'code',
          language: 'python',
          code:
            '# Database query optimization resulted in 34% latency reduction\n' +
            'from sqlalchemy import select, and_\n\n' +
            '# Before: N+1 query pattern\n' +
            'users = session.query(User).all()\n' +
            'for user in users:\n' +
            '    user.posts  # Triggers separate query\n\n' +
            '# After: Optimized with eager loading\n' +
            'users = session.query(User)\\\n' +
            '    .options(joinedload(User.posts))\\\n' +
            '    .all()\n',
        },
      ],
    },

    {
      id: 'recommendations',
      title: 'Strategic Recommendations',
      confidence: 0.85,
      blocks: [
        {
          type: 'paragraph',
          text:
            'Based on Q4 data analysis and current market trends, the following strategic initiatives ' +
            'are recommended for Q1 2026:',
          confidence: 0.85,
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Prioritize dark mode implementation (68% user request rate)',
            'Invest in mobile performance optimization (23% dissatisfaction rate)',
            'Expand enterprise features: custom branding and advanced permissions',
            'Launch Slack/Teams integrations (38% request rate, high enterprise value)',
            'Continue API v3 migration support and documentation',
            'Introduce annual billing discount to improve MRR predictability',
          ],
        },
        {
          type: 'divider',
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'Resource Allocation',
          text:
            'Recommended Q1 2026 engineering allocation: 40% new features, 35% performance/reliability, ' +
            '15% technical debt, 10% experimentation.',
        },
      ],
    },
  ],
};

export const documentProductAnalysisIntent: IntentPayloadInput = {
  version: '1.0.0',
  intentId: uuid(),
  type: 'document',
  domain: 'product-analytics',
  primaryGoal: 'Present comprehensive Q4 product performance analysis',
  confidence: 0.91,
  density: 'operator',
  explain: true,
  layoutHint: 'feed',

  data: documentData,

  ambiguities: [
    {
      type: 'single_select',
      id: 'report_depth',
      label: 'Report Depth',
      options: [
        { value: 'summary', label: 'Executive Summary Only' },
        { value: 'standard', label: 'Standard Report' },
        { value: 'detailed', label: 'Detailed Analysis' },
      ],
      value: 'standard',
      parameterKey: 'display.depth',
    },
    {
      type: 'toggle',
      id: 'show_confidence',
      label: 'Show AI Confidence',
      description: 'Display confidence scores for AI-generated insights',
      value: true,
      parameterKey: 'display.showConfidence',
    },
  ],

  actions: [
    {
      id: 'export_pdf',
      label: 'Export as PDF',
      description: 'Download this report as a PDF document',
      variant: 'secondary',
    },
    {
      id: 'schedule_refresh',
      label: 'Schedule Auto-Refresh',
      description: 'Set up automatic report updates',
      variant: 'secondary',
    },
    {
      id: 'share_team',
      label: 'Share with Team',
      description: 'Send this report to team members',
      variant: 'info',
      safety: {
        confidence: 0.95,
        reversible: true,
        riskLevel: 'low',
        blastRadius: {
          scope: 'team',
          affectedSystems: ['email', 'notifications'],
        },
      },
    },
  ],

  explainability: {
    'product-analysis': {
      elementId: 'product-analysis',
      summary: 'This analysis combines multiple data sources to provide a comprehensive view of product health and identify strategic opportunities',
      dataSources: [
        {
          type: 'database',
          name: 'Amplitude Analytics',
          freshness: new Date().toISOString(),
          reliability: 0.98,
        },
        {
          type: 'api',
          name: 'Stripe Revenue Data',
          freshness: new Date().toISOString(),
          reliability: 0.99,
        },
        {
          type: 'database',
          name: 'Customer Feedback Database',
          freshness: new Date().toISOString(),
          reliability: 0.92,
        },
      ],
      assumptions: [
        'Patterns identified through correlation analysis of engagement metrics',
        'Revenue trends reflect sustainable growth rather than one-time events',
        'Customer feedback sentiment scores are representative of overall user base',
      ],
      alternativesConsidered: [
        {
          description: 'Focus exclusively on revenue metrics',
          reason: 'Simpler analysis but misses user satisfaction and engagement trends',
        },
        {
          description: 'Real-time dashboard instead of static report',
          reason: 'More up-to-date but less suitable for presentations and archival',
        },
      ],
      whatIfQueries: [
        'What if mobile engagement drops by 20%?',
        'What if we prioritize dark mode over other features?',
        'What if churn rate increases to 3%?',
      ],
    },
  },
};
