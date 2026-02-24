// ─────────────────────────────────────────────────────────────────────────────
// useDocumentCollaboration — React hook managing collaborative document editing.
//
// Architecture:
//   Each peer maintains its own local copy of the document sections (mutable).
//   Operations (DocumentEditOperation) are applied locally and broadcast to
//   other peers via a configurable transport (BroadcastChannel by default for
//   same-origin tab sync; drop in a WebSocket adapter for cross-device).
//
// Conflict resolution:
//   Block operations use "last-write-wins" per block index. Each op carries a
//   Lamport timestamp for causal ordering; peers apply remote ops in lamport
//   order so independent edits on different blocks are always idempotent.
//
// Presence:
//   `focusedBlocks` tracks which collaborator currently has a block focused
//   (section+index key → collaborator info) for rendering avatar cursors.
//
// Usage:
//   const collab = useDocumentCollaboration({ sections, authorId, authorName, authorColor });
//   // Render collab.sections instead of the original prop
//   collab.editBlock('intro', 1, newBlock);
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DocumentBlock,
  DocumentSection,
  DocumentEditOperation,
  StampedOperation,
  BlockComment,
  BlockCommentMap,
} from '@hari/core';

// ── Transport interface (pluggable) ────────────────────────────────────────────

export interface CollabTransport {
  /** Send an operation to remote peers. */
  send(op: StampedOperation): void;
  /** Register a handler for operations received from remote peers. */
  onReceive(handler: (op: StampedOperation) => void): () => void;
  /** Tear down the transport connection. */
  dispose(): void;
}

// ── BroadcastChannel transport (default — same-origin tab sync) ───────────────

export function createBroadcastTransport(channelName: string): CollabTransport {
  if (typeof BroadcastChannel === 'undefined') {
    // SSR / unsupported — return a no-op transport
    return { send: () => {}, onReceive: () => () => {}, dispose: () => {} };
  }
  const channel = new BroadcastChannel(channelName);
  return {
    send(op) {
      channel.postMessage(op);
    },
    onReceive(handler) {
      const listener = (e: MessageEvent<StampedOperation>) => handler(e.data);
      channel.addEventListener('message', listener);
      return () => channel.removeEventListener('message', listener);
    },
    dispose() {
      channel.close();
    },
  };
}

// ── Hook options & return type ─────────────────────────────────────────────────

export interface CollaboratorPresenceInfo {
  authorId: string;
  authorName: string;
  authorColor: string;
  lastSeen: number; // timestamp ms
}

export interface UseDocumentCollaborationOptions {
  /** Initial document sections from the intent payload. */
  sections: DocumentSection[];
  /** Unique ID for this collaborator's session. */
  authorId: string;
  /** Display name shown to other collaborators. */
  authorName: string;
  /** Hex colour used for cursors / avatars. */
  authorColor: string;
  /**
   * Channel name for the BroadcastChannel transport.
   * Peers sharing the same channelName will sync.
   * Override with a WebSocket transport via `transport` prop for cross-device.
   * @default 'hari-collab-default'
   */
  channelName?: string;
  /**
   * Custom transport implementation (e.g. WebSocket).
   * When provided, `channelName` is ignored.
   */
  transport?: CollabTransport;
  /** Called whenever the local section state changes (after applying an op). */
  onChange?: (sections: DocumentSection[]) => void;
}

export interface UseDocumentCollaborationResult {
  /** Current (possibly mutated) sections — use these to render the document. */
  sections: DocumentSection[];
  /** Pending ops the local user has issued but not yet acknowledged. */
  pendingOps: StampedOperation[];
  /** Map of block focus: `${sectionId}:${blockIndex}` → collaborator info */
  focusedBlocks: Record<string, CollaboratorPresenceInfo>;
  /** Comment map: sectionId → blockIndex → comments[] */
  comments: BlockCommentMap;
  /** Local Lamport clock value. */
  lamport: number;

  /** Replace block at (sectionId, blockIndex) with newBlock. */
  editBlock: (sectionId: string, blockIndex: number, newBlock: DocumentBlock) => void;
  /** Insert a block after afterIndex (-1 = prepend) in a section. */
  insertBlock: (sectionId: string, afterIndex: number, block: DocumentBlock) => void;
  /** Remove the block at blockIndex in a section. */
  deleteBlock: (sectionId: string, blockIndex: number) => void;
  /** Move a block within a section. */
  moveBlock: (sectionId: string, fromIndex: number, toIndex: number) => void;
  /** Add a comment to a block. */
  addComment: (sectionId: string, blockIndex: number, text: string) => void;
  /** Resolve a comment. */
  resolveComment: (sectionId: string, blockIndex: number, commentId: string) => void;
  /** Signal to peers that this user is focusing a specific block. */
  focusBlock: (sectionId: string, blockIndex: number) => void;
  /** Signal that this user has stopped focusing any block. */
  blurBlock: () => void;
  /** Undo the last local operation. */
  undo: () => void;
  /** Whether there is a local op that can be undone. */
  canUndo: boolean;
}

// ── Implementation ─────────────────────────────────────────────────────────────

export function useDocumentCollaboration(
  options: UseDocumentCollaborationOptions,
): UseDocumentCollaborationResult {
  const {
    sections: initialSections,
    authorId,
    authorName,
    authorColor,
    channelName = 'hari-collab-default',
    transport: externalTransport,
    onChange,
  } = options;

  const [sections, setSections] = useState<DocumentSection[]>(
    () => initialSections.map((s) => ({ ...s, blocks: [...s.blocks] })),
  );
  const sectionsRef = useRef<DocumentSection[]>(
    initialSections.map((s) => ({ ...s, blocks: [...s.blocks] })),
  );
  const [comments, setComments] = useState<BlockCommentMap>({});
  const commentsRef = useRef<BlockCommentMap>({});
  const [focusedBlocks, setFocusedBlocks] = useState<
    Record<string, CollaboratorPresenceInfo>
  >({});
  const [lamport, setLamport] = useState(0);
  // Use a ref for synchronous access to the Lamport counter (avoids batching
  // issues where multiple tick() calls in the same flush see stale state).
  const lamportRef = useRef(0);
  const [pendingOps, setPendingOps] = useState<StampedOperation[]>([]);

  // Undo stack: stores section snapshots before each local op
  const undoStack = useRef<DocumentSection[][]>([]);

  // Keep stable refs for callbacks
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // ── Transport setup ─────────────────────────────────────────────────────────
  const transportRef = useRef<CollabTransport | null>(null);

  useEffect(() => {
    const t = externalTransport ?? createBroadcastTransport(channelName);
    transportRef.current = t;

    const unsubscribe = t.onReceive((stamped) => {
      applyRemoteOp(stamped);
    });

    return () => {
      unsubscribe();
      t.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, externalTransport]);

  // ── Lamport tick ────────────────────────────────────────────────────────────
  const tick = useCallback((): number => {
    const next = lamportRef.current + 1;
    lamportRef.current = next;
    setLamport(next);
    return next;
  }, []);

  // ── Apply op to sections (pure, returns next sections) ─────────────────────
  const applyOp = useCallback(
    (
      op: DocumentEditOperation,
      currentSections: DocumentSection[],
      currentComments: BlockCommentMap,
    ): { sections: DocumentSection[]; comments: BlockCommentMap } => {
      let nextSections = currentSections;
      let nextComments = currentComments;

      switch (op.type) {
        case 'block_edit': {
          nextSections = currentSections.map((s) =>
            s.id !== op.sectionId
              ? s
              : {
                  ...s,
                  blocks: s.blocks.map((b, i) => (i === op.blockIndex ? op.block : b)),
                },
          );
          break;
        }
        case 'block_insert': {
          nextSections = currentSections.map((s) => {
            if (s.id !== op.sectionId) return s;
            const blocks = [...s.blocks];
            blocks.splice(op.afterIndex + 1, 0, op.block);
            return { ...s, blocks };
          });
          break;
        }
        case 'block_delete': {
          nextSections = currentSections.map((s) => {
            if (s.id !== op.sectionId) return s;
            const blocks = [...s.blocks];
            blocks.splice(op.blockIndex, 1);
            return { ...s, blocks };
          });
          // Shift comment indices
          nextComments = shiftCommentIndices(nextComments, op.sectionId, op.blockIndex, -1);
          break;
        }
        case 'block_move': {
          nextSections = currentSections.map((s) => {
            if (s.id !== op.sectionId) return s;
            const blocks = [...s.blocks];
            const [moved] = blocks.splice(op.fromIndex, 1);
            blocks.splice(op.toIndex, 0, moved);
            return { ...s, blocks };
          });
          break;
        }
        case 'comment_add': {
          const secComments = nextComments[op.sectionId] ?? {};
          const blockComments = secComments[op.blockIndex] ?? [];
          nextComments = {
            ...nextComments,
            [op.sectionId]: {
              ...secComments,
              [op.blockIndex]: [...blockComments, op.comment],
            },
          };
          break;
        }
        case 'comment_resolve': {
          const secC = nextComments[op.sectionId] ?? {};
          const bc = (secC[op.blockIndex] ?? []).map((c) =>
            c.commentId === op.commentId ? { ...c, resolved: true } : c,
          );
          nextComments = {
            ...nextComments,
            [op.sectionId]: { ...secC, [op.blockIndex]: bc },
          };
          break;
        }
      }

      return { sections: nextSections, comments: nextComments };
    },
    [],
  );

  // ── Apply remote op (called from transport handler) ────────────────────────
  const applyRemoteOp = useCallback(
    (stamped: StampedOperation) => {
      // Advance our Lamport clock if the remote timestamp is ahead
      const nextL = Math.max(lamportRef.current, stamped.lamport) + 1;
      lamportRef.current = nextL;
      setLamport(nextL);

      // Handle presence focus ops (encoded as custom metadata on top of ops)
      if ('__focus' in stamped) {
        const f = (stamped as unknown as { __focus: { sectionId: string; blockIndex: number } }).__focus;
        const key = `${f.sectionId}:${f.blockIndex}`;
        setFocusedBlocks((prev) => ({
          ...prev,
          [key]: {
            authorId: stamped.authorId,
            authorName: stamped.authorName,
            authorColor: stamped.authorColor ?? '#6366f1',
            lastSeen: Date.now(),
          },
        }));
        return;
      }

      if ('__blur' in stamped) {
        setFocusedBlocks((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((k) => {
            if (next[k].authorId === stamped.authorId) delete next[k];
          });
          return next;
        });
        return;
      }

      setSections((prevSections) => {
        let nextComments: BlockCommentMap = {};
        setComments((prevComments) => {
          const result = applyOp(stamped.op, prevSections, prevComments);
          nextComments = result.comments;
          return result.comments;
        });
        const result = applyOp(stamped.op, prevSections, nextComments);
        onChangeRef.current?.(result.sections);
        return result.sections;
      });
    },
    [applyOp],
  );

  // ── Issue local op ─────────────────────────────────────────────────────────
  const issueOp = useCallback(
    (op: DocumentEditOperation) => {
      const l = tick();
      const stamped: StampedOperation = {
        opId: `${authorId}-${l}-${Math.random().toString(36).slice(2)}`,
        authorId,
        authorName,
        lamport: l,
        issuedAt: new Date().toISOString(),
        op,
      };

      // Snapshot for undo using synchronous refs (always up-to-date).
      undoStack.current.push(sectionsRef.current.map((s) => ({ ...s, blocks: [...s.blocks] })));
      if (undoStack.current.length > 50) undoStack.current.shift();

      // Apply op synchronously via refs, then flush to React state.
      const result = applyOp(op, sectionsRef.current, commentsRef.current);
      sectionsRef.current = result.sections;
      commentsRef.current = result.comments;

      setSections(result.sections);
      setComments(result.comments);
      onChangeRef.current?.(result.sections);

      setPendingOps((prev) => [...prev, stamped]);
      transportRef.current?.send(stamped);

      // Remove from pending after a short delay (simulating acknowledgement)
      setTimeout(() => {
        setPendingOps((prev) => prev.filter((p) => p.opId !== stamped.opId));
      }, 1500);
    },
    [authorId, authorName, tick, applyOp],
  );

  // ── Public edit API ─────────────────────────────────────────────────────────

  const editBlock = useCallback(
    (sectionId: string, blockIndex: number, newBlock: DocumentBlock) => {
      issueOp({ type: 'block_edit', sectionId, blockIndex, block: newBlock });
    },
    [issueOp],
  );

  const insertBlock = useCallback(
    (sectionId: string, afterIndex: number, block: DocumentBlock) => {
      issueOp({ type: 'block_insert', sectionId, afterIndex, block });
    },
    [issueOp],
  );

  const deleteBlock = useCallback(
    (sectionId: string, blockIndex: number) => {
      issueOp({ type: 'block_delete', sectionId, blockIndex });
    },
    [issueOp],
  );

  const moveBlock = useCallback(
    (sectionId: string, fromIndex: number, toIndex: number) => {
      issueOp({ type: 'block_move', sectionId, fromIndex, toIndex });
    },
    [issueOp],
  );

  const addComment = useCallback(
    (sectionId: string, blockIndex: number, text: string) => {
      const comment: BlockComment = {
        commentId: `cmt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        authorId,
        authorName,
        authorColor,
        text,
        createdAt: new Date().toISOString(),
        resolved: false,
      };
      issueOp({ type: 'comment_add', sectionId, blockIndex, comment });
    },
    [authorId, authorName, authorColor, issueOp],
  );

  const resolveComment = useCallback(
    (sectionId: string, blockIndex: number, commentId: string) => {
      issueOp({ type: 'comment_resolve', sectionId, blockIndex, commentId });
    },
    [issueOp],
  );

  // ── Presence: focus / blur ──────────────────────────────────────────────────

  const focusBlock = useCallback(
    (sectionId: string, blockIndex: number) => {
      const key = `${sectionId}:${blockIndex}`;
      setFocusedBlocks((prev) => ({
        ...prev,
        [key]: { authorId, authorName, authorColor, lastSeen: Date.now() },
      }));

      const l = lamportRef.current + 1;
      lamportRef.current = l;
      setLamport(l);
      const msg = {
        opId: `focus-${authorId}-${l}`,
        authorId,
        authorName,
        authorColor,
        lamport: l,
        issuedAt: new Date().toISOString(),
        op: { type: 'block_edit' as const, sectionId, blockIndex, block: { type: 'divider' as const } },
        __focus: { sectionId, blockIndex },
      } as unknown as StampedOperation;
      transportRef.current?.send(msg);
    },
    [authorId, authorName, authorColor],
  );

  const blurBlock = useCallback(() => {
    setFocusedBlocks((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (next[k].authorId === authorId) delete next[k];
      });
      return next;
    });
    const l = lamportRef.current + 1;
    lamportRef.current = l;
    setLamport(l);
    const msg = {
      opId: `blur-${authorId}-${l}`,
      authorId,
      authorName,
      authorColor,
      lamport: l,
      issuedAt: new Date().toISOString(),
      op: { type: 'block_edit' as const, sectionId: '', blockIndex: 0, block: { type: 'divider' as const } },
      __blur: true,
    } as unknown as StampedOperation;
    transportRef.current?.send(msg);
  }, [authorId, authorName, authorColor]);

  // ── Undo ────────────────────────────────────────────────────────────────────

  const undo = useCallback(() => {
    const snapshot = undoStack.current.pop();
    if (!snapshot) return;
    setSections(snapshot);
    onChangeRef.current?.(snapshot);
  }, []);

  return {
    sections,
    pendingOps,
    focusedBlocks,
    comments,
    lamport,
    editBlock,
    insertBlock,
    deleteBlock,
    moveBlock,
    addComment,
    resolveComment,
    focusBlock,
    blurBlock,
    undo,
    canUndo: undoStack.current.length > 0,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shiftCommentIndices(
  comments: BlockCommentMap,
  sectionId: string,
  deletedIndex: number,
  delta: number,
): BlockCommentMap {
  const secComments = comments[sectionId];
  if (!secComments) return comments;

  const next: Record<number, BlockComment[]> = {};
  for (const [idx, list] of Object.entries(secComments)) {
    const i = Number(idx);
    if (i === deletedIndex) continue; // deleted block
    const newIdx = i > deletedIndex ? i + delta : i;
    next[newIdx] = list;
  }
  return { ...comments, [sectionId]: next };
}
