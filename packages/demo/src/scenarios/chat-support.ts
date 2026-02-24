import { v4 as uuid } from 'uuid';
import type { IntentPayloadInput } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// Chat scenario: "Customer support session"
//
// Demonstrates the chat intent type with a realistic support conversation
// including user messages, agent responses (one still streaming), and
// an error message. Uses categories meeting, oncall, and incident to
// show all role types.
// ─────────────────────────────────────────────────────────────────────────────

// Anchor timestamp: 2026-02-24 10:00 UTC (today in the demo)
const BASE_MS = new Date('2026-02-24T10:00:00Z').getTime();
const min = (n: number) => BASE_MS + n * 60_000;

export const chatSupportIntent: IntentPayloadInput = {
  version: '1.0.0',
  intentId: uuid(),
  type: 'chat',
  domain: 'support',
  primaryGoal: 'Assist the user with an account billing issue through a real-time chat session',
  confidence: 0.95,
  density: 'operator',

  data: {
    title: 'Support Chat — Billing Inquiry',
    inputPlaceholder: 'Type your message here…',
    allowAttachments: true,
    streamingMessageId: 'msg-agent-4',

    messages: [
      // ── System notice ─────────────────────────────────────────────────────
      {
        id: 'msg-system-1',
        role: 'system',
        content: 'You are connected to HARI Support Agent v1.2. Session ID: #84291',
        timestamp: min(0),
      },

      // ── Opening ───────────────────────────────────────────────────────────
      {
        id: 'msg-agent-1',
        role: 'agent',
        content: 'Hello! I\'m your **HARI Support Agent**. How can I help you today?',
        timestamp: min(0.5),
        status: 'sent',
        metadata: { model: 'claude-sonnet-4-6', latency_ms: '312' },
      },
      {
        id: 'msg-user-1',
        role: 'user',
        content: 'Hi! I was charged twice for my subscription this month. Can you look into it?',
        timestamp: min(1.5),
        status: 'sent',
      },

      // ── Investigation ─────────────────────────────────────────────────────
      {
        id: 'msg-agent-2',
        role: 'agent',
        content: 'I\'m sorry to hear that. Let me pull up your account right away.\n\nCould you confirm your email address so I can look up the charges?',
        timestamp: min(2),
        status: 'sent',
      },
      {
        id: 'msg-user-2',
        role: 'user',
        content: 'Sure, it\'s alice@example.com',
        timestamp: min(3),
        status: 'sent',
      },
      {
        id: 'msg-agent-3',
        role: 'agent',
        content: 'Thanks Alice! I can see your account. I\'ve found **two charges** on 2026-02-01:\n\n- `$29.99` — Annual Pro plan (renewal)\n- `$29.99` — Duplicate charge (processing error)\n\nI\'ve flagged this for our billing team. You\'ll receive a refund for the duplicate within **3–5 business days**.',
        timestamp: min(4),
        status: 'sent',
        attachments: [
          {
            id: 'att-1',
            name: 'invoice-2026-02-01.pdf',
            type: 'application/pdf',
            size: '84 KB',
            url: '#',
          },
        ],
        explainElementId: 'refund-explain',
        metadata: { confidence: '0.97', billing_ref: 'BIL-20260201-4892' },
      },

      // ── Currently streaming response ───────────────────────────────────────
      {
        id: 'msg-user-3',
        role: 'user',
        content: 'Thank you so much! Will I get a confirmation email?',
        timestamp: min(5),
        status: 'sent',
      },
      {
        id: 'msg-agent-4',
        role: 'agent',
        content: 'Absolutely! A confirmation email will be sent to alice@example.com within the next few minutes. The email will include the refund reference number and expected timeline.',
        timestamp: min(5.5),
        status: 'streaming',  // This message is still being generated
      },
    ],
  },

  explainability: {
    title: 'Why is this chat shown?',
    summary: 'The agent detected a billing anomaly on your account and initiated a support session to resolve a duplicate charge.',
    confidence: 0.95,
    elements: {
      'refund-explain': {
        label: 'Refund decision',
        reasoning: 'Our billing system detected two identical charges (same amount, same billing period) within 24 hours. Per policy, duplicate charges are automatically eligible for refund without additional approval. The refund was initiated automatically and flagged to our finance team.',
        confidence: 0.99,
        sources: [
          { label: 'Billing policy v3.2', url: '#' },
          { label: 'Transaction log', url: '#' },
        ],
      },
    },
  },

  actions: [
    {
      actionId: 'end-session',
      label: 'End Session',
      description: 'Close this support chat session',
      verb: 'close',
      target: 'support-session-84291',
      reversible: true,
      blastRadius: {
        scope: 'self',
        affectedSystems: ['support-portal'],
      },
    },
  ],
};
