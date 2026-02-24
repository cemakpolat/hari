import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Presence Schema — track real-time collaborators
//
// Represents the current presence state of collaborators viewing/editing
// the intent. Used for: cursor tracking, edit highlights, user badges.
// ─────────────────────────────────────────────────────────────────────────────

export const CollaboratorSchema = z.object({
  /** Unique collaborator ID (e.g., session ID or user ID). */
  collaboratorId: z.string().min(1).max(64),
  /** Display name (e.g., "Alice", "Bob"). */
  displayName: z.string().min(1).max(32),
  /** Hex color for visual identification (e.g., "#FF5733"). */
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  /** Last activity timestamp (ISO 8601). */
  lastActive: z.string().datetime(),
  /** Optional: current field or block they're focusing on. */
  focusedDataKey: z.string().optional(),
  /** Optional: action they're currently performing. */
  currentAction: z.enum(['viewing', 'editing', 'commenting']).optional(),
});

export type Collaborator = z.infer<typeof CollaboratorSchema>;

/**
 * Generate a random color for a collaborator.
 */
export function generateCollaboratorColor(): string {
  // Generate random RGB values for simplicity and consistency
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);

  const toHex = (val: number) => val.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Create a collaborator with sensible defaults.
 */
export function createCollaborator(displayName: string, collaboratorId?: string): Collaborator {
  return {
    collaboratorId: collaboratorId || `collab-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    displayName,
    color: generateCollaboratorColor(),
    lastActive: new Date().toISOString(),
  };
}
