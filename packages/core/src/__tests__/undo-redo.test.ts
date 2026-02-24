import { describe, it, expect, beforeEach } from 'vitest';
import { useIntentStore } from '../store/intent';
import type { IntentPayload } from '../schemas/intent';

// ─────────────────────────────────────────────────────────────────────────────
// Undo / Redo — unit tests
// ─────────────────────────────────────────────────────────────────────────────

function makeIntent(id: string, extra?: Partial<IntentPayload>): IntentPayload {
  return {
    version: '1.0.0',
    intentId: id,
    type: 'comparison',
    domain: 'travel',
    primaryGoal: `Goal for ${id}`,
    confidence: 0.9,
    density: 'operator',
    ambiguities: [],
    data: { step: id },
    priorityFields: [],
    actions: [],
    explain: false,
    ...extra,
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
  });

describe('IntentStore — undo / redo', () => {
  beforeEach(resetStore);

  // ── Initial state ──────────────────────────────────────────────────────────

  it('starts with empty intentHistory and redoStack', () => {
    const { intentHistory, redoStack } = useIntentStore.getState();
    expect(intentHistory).toHaveLength(0);
    expect(redoStack).toHaveLength(0);
  });

  // ── undo() ─────────────────────────────────────────────────────────────────

  it('undo() is a no-op when history is empty', () => {
    const intent = makeIntent('a');
    useIntentStore.getState().setIntent(intent);
    useIntentStore.getState().undo();

    const { currentIntent } = useIntentStore.getState();
    expect(currentIntent?.intentId).toBe('a');
  });

  it('undo() restores the previous intent', () => {
    useIntentStore.getState().setIntent(makeIntent('a'));
    useIntentStore.getState().setIntent(makeIntent('b'));

    useIntentStore.getState().undo();

    const { currentIntent } = useIntentStore.getState();
    expect(currentIntent?.intentId).toBe('a');
  });

  it('undo() pushes the displaced intent onto redoStack', () => {
    useIntentStore.getState().setIntent(makeIntent('a'));
    useIntentStore.getState().setIntent(makeIntent('b'));

    useIntentStore.getState().undo();

    const { redoStack } = useIntentStore.getState();
    expect(redoStack).toHaveLength(1);
    expect(redoStack[0].intentId).toBe('b');
  });

  it('undo() clears pendingModifications', () => {
    useIntentStore.getState().setIntent(makeIntent('a'));
    useIntentStore.getState().setIntent(makeIntent('b'));
    useIntentStore.getState().modifyParameter('foo', 'bar');

    useIntentStore.getState().undo();

    expect(useIntentStore.getState().pendingModifications).toHaveLength(0);
  });

  it('undo() supports multiple steps', () => {
    useIntentStore.getState().setIntent(makeIntent('a'));
    useIntentStore.getState().setIntent(makeIntent('b'));
    useIntentStore.getState().setIntent(makeIntent('c'));

    useIntentStore.getState().undo();
    useIntentStore.getState().undo();

    expect(useIntentStore.getState().currentIntent?.intentId).toBe('a');
    expect(useIntentStore.getState().redoStack).toHaveLength(2);
  });

  // ── redo() ─────────────────────────────────────────────────────────────────

  it('redo() is a no-op when redoStack is empty', () => {
    useIntentStore.getState().setIntent(makeIntent('a'));
    useIntentStore.getState().redo(); // no-op

    expect(useIntentStore.getState().currentIntent?.intentId).toBe('a');
  });

  it('redo() restores the most recently undone intent', () => {
    useIntentStore.getState().setIntent(makeIntent('a'));
    useIntentStore.getState().setIntent(makeIntent('b'));
    useIntentStore.getState().undo();

    useIntentStore.getState().redo();

    expect(useIntentStore.getState().currentIntent?.intentId).toBe('b');
  });

  it('redo() pushes the displaced intent back onto intentHistory', () => {
    useIntentStore.getState().setIntent(makeIntent('a'));
    useIntentStore.getState().setIntent(makeIntent('b'));
    useIntentStore.getState().undo();

    useIntentStore.getState().redo();

    const { intentHistory, redoStack } = useIntentStore.getState();
    expect(intentHistory[0].intentId).toBe('a');
    expect(redoStack).toHaveLength(0);
  });

  it('redo() clears pendingModifications', () => {
    useIntentStore.getState().setIntent(makeIntent('a'));
    useIntentStore.getState().setIntent(makeIntent('b'));
    useIntentStore.getState().undo();
    useIntentStore.getState().modifyParameter('foo', 'baz');

    useIntentStore.getState().redo();

    expect(useIntentStore.getState().pendingModifications).toHaveLength(0);
  });

  it('redo() supports multiple steps', () => {
    useIntentStore.getState().setIntent(makeIntent('a'));
    useIntentStore.getState().setIntent(makeIntent('b'));
    useIntentStore.getState().setIntent(makeIntent('c'));
    useIntentStore.getState().undo();
    useIntentStore.getState().undo();

    useIntentStore.getState().redo();
    useIntentStore.getState().redo();

    expect(useIntentStore.getState().currentIntent?.intentId).toBe('c');
    expect(useIntentStore.getState().redoStack).toHaveLength(0);
  });

  // ── Redo stack cleared by new agent intent ─────────────────────────────────

  it('setIntent() clears the redoStack', () => {
    useIntentStore.getState().setIntent(makeIntent('a'));
    useIntentStore.getState().setIntent(makeIntent('b'));
    useIntentStore.getState().undo();
    expect(useIntentStore.getState().redoStack).toHaveLength(1);

    // New intent from agent
    useIntentStore.getState().setIntent(makeIntent('c'));
    expect(useIntentStore.getState().redoStack).toHaveLength(0);
  });

  // ── Redo stack cleared by commitHypothetical() ─────────────────────────────

  it('commitHypothetical() clears the redoStack', () => {
    useIntentStore.getState().setIntent(makeIntent('a'));
    useIntentStore.getState().setIntent(makeIntent('b'));
    useIntentStore.getState().undo();
    expect(useIntentStore.getState().redoStack).toHaveLength(1);

    useIntentStore.getState().branchHypothetical();
    useIntentStore.getState().commitHypothetical();

    expect(useIntentStore.getState().redoStack).toHaveLength(0);
  });

  // ── Combined undo/redo round-trip ──────────────────────────────────────────

  it('round-trip: undo×3 then redo×3 returns to original', () => {
    ['a', 'b', 'c', 'd'].forEach((id) => useIntentStore.getState().setIntent(makeIntent(id)));

    useIntentStore.getState().undo();
    useIntentStore.getState().undo();
    useIntentStore.getState().undo();
    expect(useIntentStore.getState().currentIntent?.intentId).toBe('a');

    useIntentStore.getState().redo();
    useIntentStore.getState().redo();
    useIntentStore.getState().redo();
    expect(useIntentStore.getState().currentIntent?.intentId).toBe('d');
    expect(useIntentStore.getState().redoStack).toHaveLength(0);
    expect(useIntentStore.getState().intentHistory).toHaveLength(3);
  });
});
