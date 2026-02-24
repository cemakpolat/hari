import { v4 as uuid } from 'uuid';
import type { IntentPayloadInput } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// Collaborative Document scenario: "Architecture Decision Record — Live Edit"
//
// Demonstrates CollaborativeDocumentEditor:
//   - Block-level inline editing for every block type
//   - Real-time collaborator cursors (simulated via BroadcastChannel;
//     open a second browser tab to see multi-user sync)
//   - Per-block comment threads (add, view, resolve)
//   - Pending-op indicator (yellow bar while op is in-flight to peers)
//   - Insert / delete / move-up / move-down block toolbar
//   - Undo last local operation (⌘Z / Ctrl+Z)
//   - Read-only mode toggle in the demo panel
// ─────────────────────────────────────────────────────────────────────────────

export const documentCollaborativeIntent: IntentPayloadInput = {
  version: '1.0.0',
  intentId: uuid(),
  type: 'document',
  domain: 'collab',
  primaryGoal: 'Live multi-user editing of an Architecture Decision Record',
  confidence: 0.97,
  density: 'operator',

  data: {
    title: 'ADR-042: Adopt BroadcastChannel for Same-Origin Tab Sync',
    author: 'Engineering Platform Team',
    publishedAt: new Date().toISOString(),
    revision: 1,
    summary:
      'We adopt the BroadcastChannel API as the default transport for same-origin collaborative document editing, with a pluggable WebSocket fallback for cross-origin or cross-device scenarios.',

    sections: [
      {
        id: 'sec-status',
        title: 'Status',
        collapsible: false,
        defaultCollapsed: false,
        blocks: [
          {
            type: 'callout',
            variant: 'info',
            text: '🟡 Proposed — under review. Edit this document to accept, reject, or amend.',
          },
        ],
      },
      {
        id: 'sec-context',
        title: 'Context',
        collapsible: true,
        defaultCollapsed: false,
        blocks: [
          {
            type: 'paragraph',
            text: 'The HARI intent-based UI toolkit needs a lightweight mechanism for multiple browser tabs (or users on the same origin) to stay in sync while editing a shared document. Server-side WebSocket infrastructure introduces operational overhead for a feature that could be satisfied entirely client-side for same-origin scenarios.',
          },
          {
            type: 'paragraph',
            text: 'The BroadcastChannel API (available in all modern browsers) allows any same-origin tab to subscribe to a named channel and receive messages posted by other tabs — zero server infra required.',
          },
          {
            type: 'callout',
            variant: 'warning',
            text: '⚠ BroadcastChannel only works within the same browser profile and origin. Cross-device or cross-browser collaboration requires the WebSocket transport adapter.',
          },
        ],
      },
      {
        id: 'sec-decision',
        title: 'Decision',
        collapsible: true,
        defaultCollapsed: false,
        blocks: [
          {
            type: 'paragraph',
            text: 'We will ship `createBroadcastTransport(channelName)` as the default `CollabTransport` implementation inside `useDocumentCollaboration`. Consumers pass a unique `channelName` (e.g. the intent ID) to scope each document to its own channel.',
          },
          {
            type: 'heading',
            level: 3,
            text: 'Conflict Resolution Strategy',
          },
          {
            type: 'paragraph',
            text: 'Concurrency is handled with an OT-lite approach: each operation carries a Lamport timestamp. When two ops target the same block, the one with the higher Lamport clock wins (Last-Write-Wins per block index). This is sufficient for documents where single-block conflicts are rare and the cost of CRDT-level ordering is not justified.',
          },
          {
            type: 'code',
            language: 'typescript',
            code:
              `// Issue a local op — increments the Lamport clock synchronously via ref.\nconst issueOp = (op: DocumentEditOperation) => {\n  const l = tick();          // lamportRef.current + 1, then set state\n  const stamped: StampedOperation = {\n    opId: \`\${authorId}-\${l}-\${nanoid()}\`,\n    authorId, authorName, lamport: l,\n    issuedAt: new Date().toISOString(),\n    op,\n  };\n  // Apply synchronously via sectionsRef + commentsRef, then flush to React.\n  const result = applyOp(op, sectionsRef.current, commentsRef.current);\n  sectionsRef.current = result.sections;\n  commentsRef.current = result.comments;\n  setSections(result.sections);\n  setComments(result.comments);\n  transportRef.current?.send(stamped);\n};`,
          },
        ],
      },
      {
        id: 'sec-consequences',
        title: 'Consequences',
        collapsible: true,
        defaultCollapsed: false,
        blocks: [
          {
            type: 'heading',
            level: 3,
            text: 'Positive',
          },
          {
            type: 'list',
            ordered: false,
            items: [
              'Zero server infrastructure for same-origin tab sync.',
              'Sub-millisecond latency for local-tab operations.',
              'Pluggable transport: swap BroadcastChannel for WebSocket with one prop.',
              'Synchronous `sectionsRef` / `commentsRef` prevent React batching from causing stale-closure conflicts.',
              'Lamport clock uses a `useRef` for O(1) synchronous reads — no async setState batching issues.',
            ],
          },
          {
            type: 'heading',
            level: 3,
            text: 'Negative / Trade-offs',
          },
          {
            type: 'list',
            ordered: false,
            items: [
              'LWW-per-block is not lossless: concurrent edits to the same block by two users means one edit is overwritten.',
              'BroadcastChannel does not survive page reloads — no offline queue or history without additional storage.',
              'Undo stack is local only; remote ops from peers do not participate in local undo.',
            ],
          },
        ],
      },
      {
        id: 'sec-alternatives',
        title: 'Alternatives Considered',
        collapsible: true,
        defaultCollapsed: true,
        blocks: [
          {
            type: 'table',
            headers: ['Option', 'Latency', 'Infra Cost', 'Offline', 'Decision'],
            rows: [
              ['BroadcastChannel (chosen)', '< 1 ms', 'None', 'No', '✅ Adopted'],
              ['WebSocket (pluggable fallback)', '2–20 ms', 'Server required', 'Possible', '⏳ Future'],
              ['Yjs CRDT', '< 5 ms', 'None (or server)', 'Yes', '❌ Overkill for current scope'],
              ['SharedWorker + MessageChannel', '< 2 ms', 'None', 'No', '❌ Complex DX'],
            ],
          },
        ],
      },
      {
        id: 'sec-references',
        title: 'References',
        collapsible: true,
        defaultCollapsed: true,
        blocks: [
          {
            type: 'paragraph',
            text: 'MDN BroadcastChannel API — https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API',
          },
          {
            type: 'paragraph',
            text: 'Lamport timestamps — L. Lamport, "Time, Clocks, and the Ordering of Events in a Distributed System", CACM 1978.',
          },
          {
            type: 'paragraph',
            text: 'HARI implementation: packages/ui/src/hooks/useDocumentCollaboration.ts',
          },
        ],
      },
    ],
  },
};
