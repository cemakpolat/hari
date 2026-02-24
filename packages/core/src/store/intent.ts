import { create } from 'zustand';
import { produce } from 'immer';
import type { IntentPayload } from '../schemas/intent';
import type { IntentModification } from '../schemas/intent';
import type { AmbiguityControl } from '../schemas/ambiguity';
import type { IntentSnapshot } from '../schemas/snapshot';
import { computeIntentDiff, generateSnapshotId } from '../schemas/snapshot';
import type { Collaborator } from '../schemas/presence';

// ─────────────────────────────────────────────────────────────────────────────
// Intent Store  (Store B in the architecture doc)
//
// Owns the current IntentPayload from the agent plus any pending modifications
// the user has made via ambiguity controls.  Modifications are committed as
// patches and sent back to the agent.
//
// History is capped at 20 entries to prevent unbounded memory growth.
//
// Undo/Redo (v0.5):
//   undo()  — pop from intentHistory, push current to redoStack
//   redo()  — pop from redoStack, push current to intentHistory
//
// Snapshots (v0.5):
//   createSnapshot(label)     — save current intent with diff tracking
//   restoreSnapshot(id)       — restore from a named snapshot
//   deleteSnapshot(id)        — remove a snapshot
//   exportSnapshots()         — JSON export
//   importSnapshots(json)     — JSON import
//
// Hypothetical Branch (v0.4):
//   branchHypothetical()        — deep-copy currentIntent → hypotheticalIntent
//   modifyHypotheticalParameter — mutate hypotheticalIntent without touching currentIntent
//   commitHypothetical()        — replace currentIntent with hypotheticalIntent
//   rollbackHypothetical()      — discard hypotheticalIntent
// ─────────────────────────────────────────────────────────────────────────────

const MAX_HISTORY = 20;

export interface PendingModification {
  intentId: string;
  modifications: Record<string, unknown>;
  timestamp: number;
}

export interface IntentState {
  currentIntent: IntentPayload | null;
  intentHistory: IntentPayload[];
  /** Intents that were undone and can be re-applied via redo(). Cleared when a new intent arrives from the agent. */
  redoStack: IntentPayload[];
  pendingModifications: PendingModification[];
  /** Isolated branch of currentIntent for what-if exploration. Never null unless no branch is active. */
  hypotheticalIntent: IntentPayload | null;
  /** Tracks which top-level data keys were modified in the hypothetical branch (for diff display). */
  hypotheticalDiff: Record<string, { was: unknown; becomes: unknown }>;
  /** Version-controlled snapshots: user-labeled points in intent history. */
  snapshots: Record<string, IntentSnapshot>;
  /** Most recent snapshot used for diff calculation. */
  lastSnapshotId: string | null;
  /** Real-time collaborators viewing/editing this intent. */
  collaborators: Record<string, Collaborator>;
}

export interface IntentActions {
  /** Replace the current intent (old one moves to history) */
  setIntent: (intent: IntentPayload) => void;
  /** Stage a generic key-value modification */
  modifyParameter: (key: string, value: unknown) => void;
  /** Update an ambiguity control's value in the current intent */
  modifyAmbiguity: (controlId: string, value: AmbiguityControl['value']) => void;
  /**
   * Return the current staged modifications as a patch.
   * Returns null if there is no current intent or no modifications.
   */
  commitModifications: () => IntentModification | null;
  clearModifications: () => void;
  /** Revert currentIntent to the previous entry in intentHistory. Pushes currentIntent onto redoStack. */
  undo: () => void;
  /** Re-apply the most recently undone intent from redoStack. */
  redo: () => void;

  // ── Snapshots (version control) ────────────────────────────────────────────
  /** Capture the current intent as a named snapshot for version control. */
  createSnapshot: (label: string) => string | null; // returns snapshotId or null if no current intent
  /** Restore a snapshot as the new currentIntent. */
  restoreSnapshot: (snapshotId: string) => void;
  /** Delete a snapshot. */
  deleteSnapshot: (snapshotId: string) => void;
  /** Export all snapshots as JSON string. */
  exportSnapshots: () => string;
  /** Import snapshots from JSON string. */
  importSnapshots: (json: string) => void;

  // ── Presence (real-time collaboration) ─────────────────────────────────────
  /** Add a collaborator. */
  addCollaborator: (collaborator: Collaborator) => void;
  /** Remove a collaborator by ID. */
  removeCollaborator: (collaboratorId: string) => void;
  /** Update a collaborator's focus (field they're editing) and action. */
  updateCollaboratorFocus: (collaboratorId: string, focusedDataKey?: string, currentAction?: 'viewing' | 'editing' | 'commenting') => void;
  /** Get all current collaborators. */
  getCollaborators: () => Collaborator[];

  // ── Hypothetical branch ────────────────────────────────────────────────────
  /** Create an isolated copy of currentIntent for what-if exploration. */
  branchHypothetical: () => void;
  /** Modify a data key in the hypothetical branch without touching the real state. */
  modifyHypotheticalParameter: (key: string, value: unknown) => void;
  /** Apply the hypothetical branch as the new currentIntent (commit). */
  commitHypothetical: () => void;
  /** Discard the hypothetical branch (rollback). */
  rollbackHypothetical: () => void;
}

export type IntentStore = IntentState & IntentActions;
export type { IntentSnapshot, Collaborator }; // re-export for convenience

export const useIntentStore = create<IntentStore>()((set, get) => ({
  currentIntent: null,
  intentHistory: [],
  redoStack: [],
  pendingModifications: [],
  hypotheticalIntent: null,
  hypotheticalDiff: {},
  snapshots: {},
  lastSnapshotId: null,
  collaborators: {},

  setIntent: (intent) =>
    set(
      produce((state: IntentState) => {
        if (state.currentIntent) {
          state.intentHistory.unshift(state.currentIntent);
          if (state.intentHistory.length > MAX_HISTORY) {
            state.intentHistory.length = MAX_HISTORY;
          }
        }
        state.currentIntent = intent;
        state.pendingModifications = [];
        state.hypotheticalIntent = null;
        state.hypotheticalDiff = {};
        // A new intent from the agent resets the redo stack — no going forward.
        state.redoStack = [];
        // Note: snapshots persist across agent intents — they're session-level, not intent-level
        // Collaborators also persist across intents (session-level presence)
      }),
    ),

  modifyParameter: (key, value) =>
    set(
      produce((state: IntentState) => {
        if (!state.currentIntent) return;
        const existing = state.pendingModifications.find(
          (m) => m.intentId === state.currentIntent!.intentId,
        );
        if (existing) {
          existing.modifications[key] = value;
          existing.timestamp = Date.now();
        } else {
          state.pendingModifications.push({
            intentId: state.currentIntent.intentId,
            modifications: { [key]: value },
            timestamp: Date.now(),
          });
        }
      }),
    ),

  modifyAmbiguity: (controlId, value) =>
    set(
      produce((state: IntentState) => {
        if (!state.currentIntent) return;
        const control = state.currentIntent.ambiguities.find((a) => a.id === controlId);
        if (control) {
          // Type-safe: value shape matches the discriminated union's value field
          (control as Record<string, unknown>)['value'] = value;
        }
      }),
    ),

  commitModifications: () => {
    const { pendingModifications, currentIntent } = get();
    if (!currentIntent) return null;
    const mod = pendingModifications.find((m) => m.intentId === currentIntent.intentId);
    if (!mod || Object.keys(mod.modifications).length === 0) return null;
    return {
      event: 'intent_modification' as const,
      originalIntentId: mod.intentId,
      modifications: { ...mod.modifications },
      timestamp: mod.timestamp,
    };
  },

  clearModifications: () =>
    set(
      produce((state: IntentState) => {
        state.pendingModifications = [];
      }),
    ),

  undo: () =>
    set(
      produce((state: IntentState) => {
        const prev = state.intentHistory.shift();
        if (prev) {
          if (state.currentIntent) {
            state.redoStack.unshift(state.currentIntent);
            if (state.redoStack.length > MAX_HISTORY) {
              state.redoStack.length = MAX_HISTORY;
            }
          }
          state.currentIntent = prev;
          state.pendingModifications = [];
        }
      }),
    ),

  redo: () =>
    set(
      produce((state: IntentState) => {
        const next = state.redoStack.shift();
        if (next) {
          if (state.currentIntent) {
            state.intentHistory.unshift(state.currentIntent);
            if (state.intentHistory.length > MAX_HISTORY) {
              state.intentHistory.length = MAX_HISTORY;
            }
          }
          state.currentIntent = next;
          state.pendingModifications = [];
        }
      }),
    ),

  // ── Snapshots (version control) ────────────────────────────────────────────

  createSnapshot: (label: string) => {
    const { currentIntent } = get();
    if (!currentIntent) return null;

    const snapshotId = generateSnapshotId();
    const lastSnapshot = get().lastSnapshotId ? get().snapshots[get().lastSnapshotId!] : null;

    const snapshot: IntentSnapshot = {
      snapshotId,
      label,
      createdAt: new Date().toISOString(),
      intent: JSON.parse(JSON.stringify(currentIntent)) as IntentPayload, // deep clone
      changedKeys: lastSnapshot
        ? computeIntentDiff(lastSnapshot.intent.data as Record<string, unknown>, currentIntent.data as Record<string, unknown>)
        : [],
      previousSnapshotId: get().lastSnapshotId,
    };

    set(
      produce((state: IntentState) => {
        state.snapshots[snapshotId] = snapshot;
        state.lastSnapshotId = snapshotId;
      }),
    );

    return snapshotId;
  },

  restoreSnapshot: (snapshotId: string) => {
    const { snapshots } = get();
    const snapshot = snapshots[snapshotId];
    if (!snapshot) return;

    // Restore is like loading a new intent — moves current to history
    set(
      produce((state: IntentState) => {
        if (state.currentIntent) {
          state.intentHistory.unshift(state.currentIntent);
          if (state.intentHistory.length > MAX_HISTORY) {
            state.intentHistory.length = MAX_HISTORY;
          }
        }
        state.currentIntent = JSON.parse(JSON.stringify(snapshot.intent)) as IntentPayload;
        state.pendingModifications = [];
        state.hypotheticalIntent = null;
        state.hypotheticalDiff = {};
        state.redoStack = [];
        // Restoring a snapshot cues it as the last known snapshot for diffs.
        state.lastSnapshotId = snapshotId;
      }),
    );
  },

  deleteSnapshot: (snapshotId: string) => {
    set(
      produce((state: IntentState) => {
        delete state.snapshots[snapshotId];
        if (state.lastSnapshotId === snapshotId) {
          state.lastSnapshotId = null;
        }
      }),
    );
  },

  exportSnapshots: () => {
    const { snapshots } = get();
    return JSON.stringify(Object.values(snapshots), null, 2);
  },

  importSnapshots: (json: string) => {
    try {
      const imported = JSON.parse(json) as IntentSnapshot[];
      set(
        produce((state: IntentState) => {
          for (const snapshot of imported) {
            state.snapshots[snapshot.snapshotId] = snapshot;
          }
        }),
      );
    } catch (e) {
      console.error('Failed to import snapshots:', e);
    }
  },

  // ── Presence (real-time collaboration) ─────────────────────────────────────

  addCollaborator: (collaborator: Collaborator) =>
    set(
      produce((state: IntentState) => {
        state.collaborators[collaborator.collaboratorId] = collaborator;
      }),
    ),

  removeCollaborator: (collaboratorId: string) =>
    set(
      produce((state: IntentState) => {
        delete state.collaborators[collaboratorId];
      }),
    ),

  updateCollaboratorFocus: (
    collaboratorId: string,
    focusedDataKey?: string,
    currentAction?: 'viewing' | 'editing' | 'commenting',
  ) => {
    const { collaborators } = get();
    const collaborator = collaborators[collaboratorId];
    if (!collaborator) return;

    set(
      produce((state: IntentState) => {
        const collab = state.collaborators[collaboratorId];
        if (collab) {
          if (focusedDataKey !== undefined) {
            collab.focusedDataKey = focusedDataKey;
          }
          if (currentAction !== undefined) {
            collab.currentAction = currentAction;
          }
          collab.lastActive = new Date().toISOString();
        }
      }),
    );
  },

  getCollaborators: () => {
    const { collaborators } = get();
    return Object.values(collaborators);
  },

  // ── Hypothetical branch ────────────────────────────────────────────────────

  branchHypothetical: () =>
    set(
      produce((state: IntentState) => {
        if (!state.currentIntent) return;
        // Deep-clone via JSON round-trip — IntentPayload is JSON-serialisable
        state.hypotheticalIntent = JSON.parse(JSON.stringify(state.currentIntent)) as IntentPayload;
        state.hypotheticalDiff = {};
      }),
    ),

  modifyHypotheticalParameter: (key, value) =>
   set(
      produce((state: IntentState) => {
        if (!state.hypotheticalIntent || !state.currentIntent) return;
        const was = (state.currentIntent.data as Record<string, unknown>)[key];
        (state.hypotheticalIntent.data as Record<string, unknown>)[key] = value;
        state.hypotheticalDiff[key] = { was, becomes: value };
      }),
    ),

  commitHypothetical: () =>
    set(
      produce((state: IntentState) => {
        if (!state.hypotheticalIntent) return;
        if (state.currentIntent) {
          state.intentHistory.unshift(state.currentIntent);
          if (state.intentHistory.length > MAX_HISTORY) {
            state.intentHistory.length = MAX_HISTORY;
          }
        }
        state.currentIntent = state.hypotheticalIntent;
        state.hypotheticalIntent = null;
        state.hypotheticalDiff = {};
        state.pendingModifications = [];
        // Committing a what-if branch is a forward mutation — clear redo.
        state.redoStack = [];
        // Committing also clears the last snapshot context.
        state.lastSnapshotId = null;
      }),
    ),

  rollbackHypothetical: () =>
    set(
      produce((state: IntentState) => {
        state.hypotheticalIntent = null;
        state.hypotheticalDiff = {};
      }),
    ),
}));
