import { z } from 'zod';
import { IntentPayloadSchema } from './intent';

// ─────────────────────────────────────────────────────────────────────────────
// Intent Snapshot Schema — version control for payloads
//
// A snapshot captures the full state of an intent at a point in time,
// with a user-provided label and automatic diff tracking.
// ─────────────────────────────────────────────────────────────────────────────

export const IntentSnapshotSchema = z.object({
  /** Unique snapshot ID (uuid). */
  snapshotId: z.string().uuid(),
  /** User-provided label (e.g., "Before config change"). */
  label: z.string().min(1).max(128),
  /** Timestamp when snapshot was created (ISO 8601). */
  createdAt: z.string().datetime(),
  /** The full intent payload at this snapshot. */
  intent: IntentPayloadSchema,
  /** Summary of changes from previous snapshot (if any). Top-level keys that changed. */
  changedKeys: z.array(z.string()),
  /** Optional: intentId of the previous snapshot for linked history. */
  previousSnapshotId: z.string().uuid().nullable(),
});

export type IntentSnapshot = z.infer<typeof IntentSnapshotSchema>;

/**
 * Compute diff between two intent payloads.
 * Returns array of top-level data keys that differ.
 */
export function computeIntentDiff(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const changed: string[] = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of allKeys) {
    // Simple JSON comparison — sufficient for metadata display
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changed.push(key);
    }
  }
  return changed;
}

/**
 * Generate a snapshot ID (for demo; in real app, use crypto.randomUUID()).
 */
export function generateSnapshotId(): string {
  return crypto.randomUUID?.() || `snapshot-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
