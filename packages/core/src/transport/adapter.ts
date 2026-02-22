// ─────────────────────────────────────────────────────────────────────────────
// Schema Version Adaptation Layer
//
// When checkSchemaVersion() returns 'degraded' (older minor) or 'incompatible'
// (different major), the transport adapters call adaptIntentPayload() to
// normalise field names from known earlier layouts into the current schema
// before passing the object to IntentPayloadSchema.safeParse().
//
// Adaptation rules (applied in order):
//   1. ambiguityControls → ambiguities     (pre-1.0 field name)
//   2. actions[*].type  → actions[*].variant (pre-1.0 field name clash)
//   3. explainability[*].reason → summary  (pre-1.0 ExplainabilityContext)
//
// The adapter is intentionally conservative: it only renames fields that are
// clearly from an older layout (source key exists, dest key is absent).
// Unknown fields are left in place and will be stripped by Zod's parse.
// ─────────────────────────────────────────────────────────────────────────────

import { checkSchemaVersion } from '../compiler/version';
import type { VersionCompatibility } from '../compiler/version';

/** Raw, unvalidated payload object received from the transport layer. */
export type RawPayload = Record<string, unknown>;

/**
 * Apply backward-compatibility field renames to a raw payload object.
 *
 * Safe to call on any version — the rules only fire when the old field is
 * present AND the new field is absent.
 */
export function adaptIntentPayload(raw: RawPayload): RawPayload {
  const adapted: RawPayload = { ...raw };

  // Rule 1 — ambiguityControls → ambiguities
  if ('ambiguityControls' in adapted && !('ambiguities' in adapted)) {
    adapted.ambiguities = adapted.ambiguityControls;
    delete adapted.ambiguityControls;
  }

  // Rule 2 — actions[*].type → variant
  if (Array.isArray(adapted.actions)) {
    adapted.actions = adapted.actions.map((action: unknown) => {
      if (action && typeof action === 'object') {
        const a = action as Record<string, unknown>;
        if (!('variant' in a) && 'type' in a) {
          const { type, ...rest } = a;
          return { ...rest, variant: type };
        }
      }
      return action;
    });
  }

  // Rule 3 — explainability[*].reason → summary
  if (adapted.explainability && typeof adapted.explainability === 'object' && !Array.isArray(adapted.explainability)) {
    const contexts = adapted.explainability as Record<string, unknown>;
    adapted.explainability = Object.fromEntries(
      Object.entries(contexts).map(([key, ctx]) => {
        if (ctx && typeof ctx === 'object' && !Array.isArray(ctx)) {
          const c = ctx as Record<string, unknown>;
          if (!('summary' in c) && 'reason' in c) {
            const { reason, ...rest } = c;
            return [key, { ...rest, summary: reason }];
          }
        }
        return [key, ctx];
      }),
    );
  }

  return adapted;
}

export interface AdaptResult {
  /** The adapted payload, ready for IntentPayloadSchema.safeParse() */
  adapted: RawPayload;
  /** Version compatibility report */
  compatibility: VersionCompatibility;
  /** Human-readable warnings to surface in the UI (empty for 'compatible') */
  warnings: string[];
}

/**
 * Check the schema version of a raw payload and adapt it if the version is
 * known to have renamed fields.
 *
 * Usage in transport adapters:
 * ```ts
 * const { adapted, warnings } = adaptWithVersionCheck(rawMsg.payload);
 * const result = IntentPayloadSchema.safeParse(adapted);
 * if (!result.success) { log('error', result.error); return; }
 * if (warnings.length) { log('warn', warnings); }
 * emit('intent', result.data);
 * ```
 */
export function adaptWithVersionCheck(raw: RawPayload): AdaptResult {
  const version = typeof raw.version === 'string' ? raw.version : '0.0.0';
  const compatibility = checkSchemaVersion(version);

  const warnings: string[] = [];

  if (compatibility.status === 'incompatible') {
    warnings.push(
      `Schema v${version} is incompatible — rendering may fail. ` +
        `Frontend supports ${JSON.stringify(compatibility.reason)}.`,
    );
  }

  if (compatibility.status === 'degraded') {
    warnings.push(...(compatibility.warnings ?? [compatibility.reason]));
  }

  // Always attempt adaptation regardless of compatibility status — the rules
  // are conservative and a no-op when no old fields are present.
  const adapted = adaptIntentPayload(raw);

  return { adapted, compatibility, warnings };
}
