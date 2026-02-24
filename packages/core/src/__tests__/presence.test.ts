import { describe, it, expect, beforeEach } from 'vitest';
import { useIntentStore } from '../store/intent';
import type { IntentPayload } from '../schemas/intent';
import { createCollaborator } from '../schemas/presence';

let store: ReturnType<typeof useIntentStore.getState>;

const mockIntent: IntentPayload = {
  intentId: 'a0000000-0000-0000-0000-000000000001',
  version: '1.0.0',
  type: 'FORM_FILL',
  domain: 'test',
  primaryGoal: 'Test Form',
  confidence: 0.95,
  data: { field1: '', field2: '' } as Record<string, unknown>,
  ambiguities: [],
  createdAt: new Date().toISOString(),
};

describe('Presence (Real-time Collaboration)', () => {
  beforeEach(() => {
    useIntentStore.setState({
      currentIntent: mockIntent,
      intentHistory: [],
      redoStack: [],
      pendingModifications: [],
      hypotheticalIntent: null,
      hypotheticalDiff: {},
      snapshots: {},
      lastSnapshotId: null,
      collaborators: {},
    });
    store = useIntentStore.getState();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Add Collaborator Tests
  // ────────────────────────────────────────────────────────────────────────────

  it('should add a single collaborator', () => {
    const collab = createCollaborator('Alice');
    useIntentStore.getState().addCollaborator(collab);

    const collaborators = useIntentStore.getState().getCollaborators();
    expect(collaborators).toHaveLength(1);
    expect(collaborators[0].displayName).toBe('Alice');
  });

  it('should add multiple collaborators', () => {
    const alice = createCollaborator('Alice');
    const bob = createCollaborator('Bob');
    const charlie = createCollaborator('Charlie');

    useIntentStore.getState().addCollaborator(alice);
    useIntentStore.getState().addCollaborator(bob);
    useIntentStore.getState().addCollaborator(charlie);

    const collaborators = useIntentStore.getState().getCollaborators();
    expect(collaborators).toHaveLength(3);
    expect(collaborators.map((c) => c.displayName)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('should update existing collaborator if same ID is added', () => {
    const collab1 = createCollaborator('Alice', 'user-1');
    useIntentStore.getState().addCollaborator(collab1);

    const collab2 = createCollaborator('Alice Updated', 'user-1');
    useIntentStore.getState().addCollaborator(collab2);

    const collaborators = useIntentStore.getState().getCollaborators();
    expect(collaborators).toHaveLength(1);
    expect(collaborators[0].displayName).toBe('Alice Updated');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Remove Collaborator Tests
  // ────────────────────────────────────────────────────────────────────────────

  it('should remove a collaborator by ID', () => {
    const alice = createCollaborator('Alice');
    const bob = createCollaborator('Bob');

    useIntentStore.getState().addCollaborator(alice);
    useIntentStore.getState().addCollaborator(bob);

    const collabs1 = useIntentStore.getState().getCollaborators();
    expect(collabs1).toHaveLength(2);

    useIntentStore.getState().removeCollaborator(alice.collaboratorId);

    const collabs2 = useIntentStore.getState().getCollaborators();
    expect(collabs2).toHaveLength(1);
    expect(collabs2[0].displayName).toBe('Bob');
  });

  it('should not error when removing non-existent collaborator', () => {
    const alice = createCollaborator('Alice');
    useIntentStore.getState().addCollaborator(alice);

    expect(() => {
      useIntentStore.getState().removeCollaborator('non-existent-id');
    }).not.toThrow();

    const collabs = useIntentStore.getState().getCollaborators();
    expect(collabs).toHaveLength(1);
  });

  it('should remove all collaborators individually', () => {
    const alice = createCollaborator('Alice');
    const bob = createCollaborator('Bob');
    const charlie = createCollaborator('Charlie');

    useIntentStore.getState().addCollaborator(alice);
    useIntentStore.getState().addCollaborator(bob);
    useIntentStore.getState().addCollaborator(charlie);

    useIntentStore.getState().removeCollaborator(alice.collaboratorId);
    useIntentStore.getState().removeCollaborator(bob.collaboratorId);
    useIntentStore.getState().removeCollaborator(charlie.collaboratorId);

    const collabs = useIntentStore.getState().getCollaborators();
    expect(collabs).toHaveLength(0);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Update Collaborator Focus Tests
  // ────────────────────────────────────────────────────────────────────────────

  it('should update collaborator focus to a data key', () => {
    const alice = createCollaborator('Alice');
    useIntentStore.getState().addCollaborator(alice);

    useIntentStore.getState().updateCollaboratorFocus(alice.collaboratorId, 'field1');

    const collabs = useIntentStore.getState().getCollaborators();
    expect(collabs[0].focusedDataKey).toBe('field1');
  });

  it('should update collaborator action (viewing/editing/commenting)', () => {
    const alice = createCollaborator('Alice');
    useIntentStore.getState().addCollaborator(alice);

    useIntentStore.getState().updateCollaboratorFocus(alice.collaboratorId, 'field1', 'editing');

    const collabs = useIntentStore.getState().getCollaborators();
    expect(collabs[0].currentAction).toBe('editing');
  });

  it('should update both focus and action together', () => {
    const alice = createCollaborator('Alice');
    useIntentStore.getState().addCollaborator(alice);

    useIntentStore.getState().updateCollaboratorFocus(alice.collaboratorId, 'field2', 'commenting');

    const collabs = useIntentStore.getState().getCollaborators();
    expect(collabs[0].focusedDataKey).toBe('field2');
    expect(collabs[0].currentAction).toBe('commenting');
  });

  it('should update focus without changing action', () => {
    const alice = createCollaborator('Alice');
    useIntentStore.getState().addCollaborator(alice);

    useIntentStore.getState().updateCollaboratorFocus(alice.collaboratorId, 'field1', 'editing');
    useIntentStore.getState().updateCollaboratorFocus(alice.collaboratorId, 'field2');

    const collabs = useIntentStore.getState().getCollaborators();
    expect(collabs[0].focusedDataKey).toBe('field2');
    expect(collabs[0].currentAction).toBe('editing'); // unchanged
  });

  it('should update action without changing focus', () => {
    const alice = createCollaborator('Alice');
    useIntentStore.getState().addCollaborator(alice);

    useIntentStore.getState().updateCollaboratorFocus(alice.collaboratorId, 'field1', 'editing');
    useIntentStore.getState().updateCollaboratorFocus(alice.collaboratorId, undefined, 'viewing');

    const collabs = useIntentStore.getState().getCollaborators();
    expect(collabs[0].focusedDataKey).toBe('field1');
    expect(collabs[0].currentAction).toBe('viewing');
  });

  it('should update lastActive timestamp on focus change', async () => {
    const alice = createCollaborator('Alice');
    useIntentStore.getState().addCollaborator(alice);

    const collabs1 = useIntentStore.getState().getCollaborators();
    const originalTime = collabs1[0].lastActive;

    // Wait a bit to ensure timestamp is different
    await new Promise((resolve) => setTimeout(resolve, 10));
    
    useIntentStore.getState().updateCollaboratorFocus(alice.collaboratorId, 'field1');

    const collabs2 = useIntentStore.getState().getCollaborators();
    const newTime = collabs2[0].lastActive;

    expect(newTime > originalTime).toBe(true);
  });

  it('should not error when updating focus for non-existent collaborator', () => {
    expect(() => {
      useIntentStore.getState().updateCollaboratorFocus('non-existent-id', 'field1', 'editing');
    }).not.toThrow();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Get Collaborators Tests
  // ────────────────────────────────────────────────────────────────────────────

  it('should return empty array when no collaborators', () => {
    const collabs = useIntentStore.getState().getCollaborators();
    expect(collabs).toEqual([]);
  });

  it('should return all collaborators as array', () => {
    const alice = createCollaborator('Alice');
    const bob = createCollaborator('Bob');

    useIntentStore.getState().addCollaborator(alice);
    useIntentStore.getState().addCollaborator(bob);

    const collabs = useIntentStore.getState().getCollaborators();
    expect(Array.isArray(collabs)).toBe(true);
    expect(collabs).toHaveLength(2);
    expect(collabs.map((c) => c.displayName)).toEqual(['Alice', 'Bob']);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Concurrent Collaborators Scenarios
  // ────────────────────────────────────────────────────────────────────────────

  it('should handle multiple collaborators on different fields', () => {
    const alice = createCollaborator('Alice');
    const bob = createCollaborator('Bob');

    useIntentStore.getState().addCollaborator(alice);
    useIntentStore.getState().addCollaborator(bob);

    useIntentStore.getState().updateCollaboratorFocus(alice.collaboratorId, 'field1', 'editing');
    useIntentStore.getState().updateCollaboratorFocus(bob.collaboratorId, 'field2', 'viewing');

    const collabs = useIntentStore.getState().getCollaborators();
    const aliceCollab = collabs.find((c) => c.displayName === 'Alice')!;
    const bobCollab = collabs.find((c) => c.displayName === 'Bob')!;

    expect(aliceCollab.focusedDataKey).toBe('field1');
    expect(aliceCollab.currentAction).toBe('editing');
    expect(bobCollab.focusedDataKey).toBe('field2');
    expect(bobCollab.currentAction).toBe('viewing');
  });

  it('should handle multiple collaborators on the same field', () => {
    const alice = createCollaborator('Alice');
    const bob = createCollaborator('Bob');

    useIntentStore.getState().addCollaborator(alice);
    useIntentStore.getState().addCollaborator(bob);

    useIntentStore.getState().updateCollaboratorFocus(alice.collaboratorId, 'field1', 'editing');
    useIntentStore.getState().updateCollaboratorFocus(bob.collaboratorId, 'field1', 'commenting');

    const collabs = useIntentStore.getState().getCollaborators();
    const aliceCollab = collabs.find((c) => c.displayName === 'Alice')!;
    const bobCollab = collabs.find((c) => c.displayName === 'Bob')!;

    expect(aliceCollab.focusedDataKey).toBe('field1');
    expect(aliceCollab.currentAction).toBe('editing');
    expect(bobCollab.focusedDataKey).toBe('field1');
    expect(bobCollab.currentAction).toBe('commenting');
  });

  it('should maintain collaborators across setIntent (session-level persistence)', () => {
    const alice = createCollaborator('Alice');
    useIntentStore.getState().addCollaborator(alice);
    useIntentStore.getState().updateCollaboratorFocus(alice.collaboratorId, 'field1', 'editing');

    // New intent from agent
    const newIntent: IntentPayload = {
      ...mockIntent,
      intentId: 'a0000000-0000-0000-0000-000000000002',
    };
    useIntentStore.getState().setIntent(newIntent);

    // Collaborators should still be present
    const collabs = useIntentStore.getState().getCollaborators();
    expect(collabs).toHaveLength(1);
    expect(collabs[0].displayName).toBe('Alice');
    expect(collabs[0].focusedDataKey).toBe('field1');
    expect(collabs[0].currentAction).toBe('editing');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Collaborator State Isolation Tests
  // ────────────────────────────────────────────────────────────────────────────

  it('should preserve collaborator state independent of undo/redo', () => {
    const alice = createCollaborator('Alice');
    const bob = createCollaborator('Bob');

    useIntentStore.getState().addCollaborator(alice);
    useIntentStore.getState().addCollaborator(bob);

    useIntentStore.getState().updateCollaboratorFocus(alice.collaboratorId, 'field1', 'editing');

    // Perform undo
    useIntentStore.getState().undo();

    // Collaborators should remain unchanged
    const collabs = useIntentStore.getState().getCollaborators();
    expect(collabs).toHaveLength(2);
    expect(collabs.find((c) => c.displayName === 'Alice')?.focusedDataKey).toBe('field1');
  });

  it('should preserve collaborators in hypothetical branch', () => {
    const alice = createCollaborator('Alice');
    useIntentStore.getState().addCollaborator(alice);
    useIntentStore.getState().updateCollaboratorFocus(alice.collaboratorId, 'field1', 'editing');

    // Create hypothetical branch
    useIntentStore.getState().branchHypothetical();

    // Collaborators should still be visible
    const collabs = useIntentStore.getState().getCollaborators();
    expect(collabs).toHaveLength(1);
    expect(collabs[0].focusedDataKey).toBe('field1');

    // Commit hypothetical
    useIntentStore.getState().commitHypothetical();

    // Collaborators should still be there
    const collabs2 = useIntentStore.getState().getCollaborators();
    expect(collabs2).toHaveLength(1);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Color Assignment Tests
  // ────────────────────────────────────────────────────────────────────────────

  it('should assign unique colors to collaborators', () => {
    const alice = createCollaborator('Alice');
    const bob = createCollaborator('Bob');
    const charlie = createCollaborator('Charlie');

    useIntentStore.getState().addCollaborator(alice);
    useIntentStore.getState().addCollaborator(bob);
    useIntentStore.getState().addCollaborator(charlie);

    const collabs = useIntentStore.getState().getCollaborators();
    const colors = collabs.map((c) => c.color);

    // All colors should be defined and unique
    expect(colors).toHaveLength(3);
    expect(new Set(colors).size).toBe(3);
  });

  it('should use provided color when creating collaborator', () => {
    const collab = createCollaborator('Alice', 'user-1');
    expect(collab.color).toBeDefined();
    expect(collab.color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
