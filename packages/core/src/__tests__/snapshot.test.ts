import { describe, it, expect, beforeEach } from 'vitest';
import { useIntentStore } from '../store/intent';
import { computeIntentDiff, generateSnapshotId } from '../schemas/snapshot';
import type { IntentPayload } from '../schemas/intent';

// ─────────────────────────────────────────────────────────────────────────────
// Intent Snapshots (version control) — unit tests
// ─────────────────────────────────────────────────────────────────────────────

function makeIntent(id: string, data?: Record<string, unknown>): IntentPayload {
  return {
    version: '1.0.0',
    intentId: id,
    type: 'comparison',
    domain: 'travel',
    primaryGoal: `Goal for ${id}`,
    confidence: 0.9,
    density: 'operator',
    ambiguities: [],
    data: data || { step: id },
    priorityFields: [],
    actions: [],
    explain: false,
  };
}

const resetStore = () =>
  useIntentStore.setState({
    currentIntent: null,
    intentHistory: [],
    redoStack: [],
    pendingModifications: [],
    hypotheticalIntent: null,
    hypotheticalDiff: {},
    snapshots: {},
    lastSnapshotId: null,
  });

describe('Intent Snapshots — version control', () => {
  beforeEach(resetStore);

  // ── computeIntentDiff ──────────────────────────────────────────────────────

  it('computeIntentDiff() detects added keys', () => {
    const before = { a: 1 };
    const after = { a: 1, b: 2 };
    const diff = computeIntentDiff(before, after);
    expect(diff).toContain('b');
    expect(diff).not.toContain('a');
  });

  it('computeIntentDiff() detects removed keys', () => {
    const before = { a: 1, b: 2 };
    const after = { a: 1 };
    const diff = computeIntentDiff(before, after);
    expect(diff).toContain('b');
  });

  it('computeIntentDiff() detects modified values', () => {
    const before = { a: 1, b: 2 };
    const after = { a: 1, b: 99 };
    const diff = computeIntentDiff(before, after);
    expect(diff).toContain('b');
    expect(diff).not.toContain('a');
  });

  it('computeIntentDiff() returns empty for identical objects', () => {
    const obj = { a: 1, b: { c: 2 } };
    const diff = computeIntentDiff(obj, obj);
    expect(diff).toHaveLength(0);
  });

  // ── createSnapshot ─────────────────────────────────────────────────────────

  it('createSnapshot() returns null when there is no current intent', () => {
    const result = useIntentStore.getState().createSnapshot('test');
    expect(result).toBeNull();
  });

  it('createSnapshot() saves a snapshot with label and timestamp', () => {
    const intent = makeIntent('a', { price: 100 });
    useIntentStore.getState().setIntent(intent);

    const snapshotId = useIntentStore.getState().createSnapshot('Initial price');
    expect(snapshotId).toBeTruthy();

    const { snapshots } = useIntentStore.getState();
    const snapshot = snapshots[snapshotId!];
    expect(snapshot).toBeTruthy();
    expect(snapshot.label).toBe('Initial price');
    expect(snapshot.intent.data).toEqual({ price: 100 });
    expect(snapshot.createdAt).toBeTruthy();
  });

  it('createSnapshot() computes diff from previous snapshot', () => {
    const intent1 = makeIntent('a', { price: 100, origin: 'LHR' });
    useIntentStore.getState().setIntent(intent1);
    const snap1 = useIntentStore.getState().createSnapshot('Snapshot 1');

    // Modify intent
    const intent2 = { ...intent1, data: { price: 200, origin: 'LHR' } };
    useIntentStore.getState().setIntent(intent2);
    const snap2 = useIntentStore.getState().createSnapshot('Snapshot 2');

    const { snapshots } = useIntentStore.getState();
    expect(snapshots[snap2!].changedKeys).toContain('price');
    expect(snapshots[snap2!].changedKeys).not.toContain('origin');
  });

  it('createSnapshot() links to previous snapshot', () => {
    useIntentStore.getState().setIntent(makeIntent('a'));
    const snap1 = useIntentStore.getState().createSnapshot('First');

    useIntentStore.getState().setIntent(makeIntent('b'));
    const snap2 = useIntentStore.getState().createSnapshot('Second');

    const { snapshots } = useIntentStore.getState();
    expect(snapshots[snap2!].previousSnapshotId).toBe(snap1);
  });

  // ── restoreSnapshot ────────────────────────────────────────────────────────

  it('restoreSnapshot() is a no-op when snapshot does not exist', () => {
    useIntentStore.getState().setIntent(makeIntent('a'));
    const current = useIntentStore.getState().currentIntent;

    useIntentStore.getState().restoreSnapshot('nonexistent');

    expect(useIntentStore.getState().currentIntent).toBe(current);
  });

  it('restoreSnapshot() restores saved intent state', () => {
    const intent1 = makeIntent('a', { price: 100 });
    useIntentStore.getState().setIntent(intent1);
    const snap1 = useIntentStore.getState().createSnapshot('Save 1');

    // Load a different intent
    useIntentStore.getState().setIntent(makeIntent('b', { price: 999 }));
    expect(useIntentStore.getState().currentIntent?.data).toEqual({ price: 999 });

    // Restore snapshot
    useIntentStore.getState().restoreSnapshot(snap1!);
    expect(useIntentStore.getState().currentIntent?.intentId).toBe('a');
    expect(useIntentStore.getState().currentIntent?.data).toEqual({ price: 100 });
  });

  it('restoreSnapshot() clears pending modifications', () => {
    useIntentStore.getState().setIntent(makeIntent('a'));
    useIntentStore.getState().createSnapshot('snap');
    useIntentStore.getState().modifyParameter('foo', 'bar');

    useIntentStore.getState().restoreSnapshot(
      Object.keys(useIntentStore.getState().snapshots)[0],
    );

    expect(useIntentStore.getState().pendingModifications).toHaveLength(0);
  });

  it('restoreSnapshot() clears redoStack', () => {
    useIntentStore.getState().setIntent(makeIntent('a'));
    useIntentStore.getState().createSnapshot('snap');
    useIntentStore.getState().setIntent(makeIntent('b'));
    useIntentStore.getState().undo();
    expect(useIntentStore.getState().redoStack).toHaveLength(1);

    useIntentStore.getState().restoreSnapshot(
      Object.keys(useIntentStore.getState().snapshots)[0],
    );

    expect(useIntentStore.getState().redoStack).toHaveLength(0);
  });

  // ── deleteSnapshot ─────────────────────────────────────────────────────────

  it('deleteSnapshot() removes a snapshot', () => {
    useIntentStore.getState().setIntent(makeIntent('a'));
    const snap1 = useIntentStore.getState().createSnapshot('To delete');
    const snap2 = useIntentStore.getState().createSnapshot('To keep');

    useIntentStore.getState().deleteSnapshot(snap1!);

    const { snapshots } = useIntentStore.getState();
    expect(snapshots[snap1!]).toBeUndefined();
    expect(snapshots[snap2!]).toBeTruthy();
  });

  it('deleteSnapshot() clears lastSnapshotId if matching', () => {
    useIntentStore.getState().setIntent(makeIntent('a'));
    const snap = useIntentStore.getState().createSnapshot('To delete');

    expect(useIntentStore.getState().lastSnapshotId).toBe(snap);
    useIntentStore.getState().deleteSnapshot(snap!);
    expect(useIntentStore.getState().lastSnapshotId).toBeNull();
  });

  // ── exportSnapshots / importSnapshots ──────────────────────────────────────

  it('exportSnapshots() returns valid JSON', () => {
    useIntentStore.getState().setIntent(makeIntent('a'));
    useIntentStore.getState().createSnapshot('Export test');

    const json = useIntentStore.getState().exportSnapshots();
    expect(() => JSON.parse(json)).not.toThrow();

    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].label).toBe('Export test');
  });

  it('importSnapshots() loads snapshots from JSON', () => {
    useIntentStore.getState().setIntent(makeIntent('a'));
    const snap1 = useIntentStore.getState().createSnapshot('Original');

    const json = useIntentStore.getState().exportSnapshots();
    resetStore();

    useIntentStore.getState().importSnapshots(json);

    const { snapshots } = useIntentStore.getState();
    expect(Object.keys(snapshots)).toHaveLength(1);
    expect(snapshots[snap1!].label).toBe('Original');
  });

  it('importSnapshots() ignores invalid JSON', () => {
    const original = useIntentStore.getState().snapshots;
    useIntentStore.getState().importSnapshots('not json');

    expect(useIntentStore.getState().snapshots).toBe(original);
  });

  // ── Integration: save → modify → restore ───────────────────────────────────

  it('round-trip: snapshot preserves state independently from history', () => {
    useIntentStore.getState().setIntent(makeIntent('a', { value: 1 }));
    const snap = useIntentStore.getState().createSnapshot('Checkpoint');

    // Load different intent, undo, redo
    useIntentStore.getState().setIntent(makeIntent('b', { value: 2 }));
    useIntentStore.getState().setIntent(makeIntent('c', { value: 3 }));
    useIntentStore.getState().undo();

    expect(useIntentStore.getState().currentIntent?.intentId).toBe('b');

    // Restore from snapshot
    useIntentStore.getState().restoreSnapshot(snap!);

    expect(useIntentStore.getState().currentIntent?.intentId).toBe('a');
    expect(useIntentStore.getState().currentIntent?.data).toEqual({ value: 1 });
  });
});
