// ─────────────────────────────────────────────────────────────────────────────
// Schema Migration Utilities  (§8 — Schema Versioning)
//
// HARI has evolved through several schema versions.  This module provides:
//
//   migrate(payload, fromVersion, toVersion?)
//     Chains individual version-step migrations to up-cast an old payload
//     to any newer target version (defaults to the current supported version).
//
//   MIGRATION_CHAIN
//     Ordered list of all historical versions.
//
//   MigrationError
//     Thrown when a migration path does not exist or inputs are invalid.
//
// ── Historical schema changes ──────────────────────────────────────────────
//
//  v0.1.0  Initial release.  Used snake_case top-level keys:
//            intent_type, schema_version, agent_confidence.
//          data was nested under data.payload.
//          No ambiguities, priorityFields, or explainability.
//
//  v0.2.0  Renamed fields to camelCase:
//            intent_type        → type
//            schema_version     → version
//            agent_confidence   → confidence
//          Introduced layoutType (later renamed again in v0.3).
//          Added ambiguities: [] default.
//
//  v0.3.0  Renamed layoutType → layoutHint.
//          Introduced explainability_map (replaced in v1.0).
//          Added priorityFields: [] default.
//          density defaulted to 'expert'.
//
//  v1.0.0  Stable public API.
//            explainability_map → explainability
//            density default changed to 'operator'
//          All fields are now camelCase throughout.
//
// ─────────────────────────────────────────────────────────────────────────────

import { SUPPORTED_SCHEMA_VERSION } from './version';

// ── Types ────────────────────────────────────────────────────────────────────

/** All schema versions known to this migration module. */
export const MIGRATION_CHAIN = ['0.1.0', '0.2.0', '0.3.0', '1.0.0'] as const;
export type KnownSchemaVersion = typeof MIGRATION_CHAIN[number];

/** An untyped intent payload object suitable for transformation. */
type RawPayload = Record<string, unknown>;

/** A function that up-casts a payload from one version to the next. */
type StepMigration = (payload: RawPayload) => RawPayload;

/**
 * Backward compatibility shim: default field values when acceptance
 * major version behind.  Agents can include these or rely on the
 * frontend to fill them in.
 */
export interface BackwardCompatibilityDefaults {
  /** Default ambiguities when missing. */
  ambiguities?: unknown[];
  /** Default priorityFields when missing. */
  priorityFields?: unknown[];
  /** Default explainability when missing. */
  explainability?: Record<string, unknown>;
  /** Default density when missing. */
  density?: string;
  /** Default layoutHint when missing. */
  layoutHint?: string;
  /** Default confidence when missing. */
  confidence?: number;
}

// ── Error ─────────────────────────────────────────────────────────────────────

export class MigrationError extends Error {
  constructor(message: string, public readonly payload?: RawPayload) {
    super(message);
    this.name = 'MigrationError';
  }
}

// ── Individual step migrations ────────────────────────────────────────────────

/**
 * v0.1.0 → v0.2.0
 *
 * Renames snake_case keys to camelCase.  Unwraps nested `data.payload`
 * if present.  Adds `ambiguities: []` default.
 */
function migrate_0_1_to_0_2(payload: RawPayload): RawPayload {
  const out: RawPayload = { ...payload };

  // intent_type → type
  if ('intent_type' in out && !('type' in out)) {
    out.type = out.intent_type;
    delete out.intent_type;
  }

  // schema_version → version
  if ('schema_version' in out && !('version' in out)) {
    out.version = out.schema_version;
    delete out.schema_version;
  }

  // agent_confidence → confidence
  if ('agent_confidence' in out && !('confidence' in out)) {
    out.confidence = out.agent_confidence;
    delete out.agent_confidence;
  }

  // Unwrap data.payload → data (v0.1 nested the data one level deeper)
  if (
    out.data !== null &&
    typeof out.data === 'object' &&
    !Array.isArray(out.data) &&
    'payload' in (out.data as RawPayload)
  ) {
    out.data = (out.data as RawPayload).payload;
  }

  // Add ambiguities default
  if (!('ambiguities' in out)) {
    out.ambiguities = [];
  }

  out.version = '0.2.0';
  return out;
}

/**
 * v0.2.0 → v0.3.0
 *
 * Renames `layoutType` → `layoutHint`.  Adds `priorityFields: []` default.
 */
function migrate_0_2_to_0_3(payload: RawPayload): RawPayload {
  const out: RawPayload = { ...payload };

  // layoutType → layoutHint (always remove old key; copy value only if new key absent)
  if ('layoutType' in out) {
    if (!('layoutHint' in out)) {
      out.layoutHint = out.layoutType;
    }
    delete out.layoutType;
  }

  // Add priorityFields default
  if (!('priorityFields' in out)) {
    out.priorityFields = [];
  }

  out.version = '0.3.0';
  return out;
}

/**
 * v0.3.0 → v1.0.0
 *
 * Renames `explainability_map` → `explainability`.
 * Normalises `density` default from 'expert' → 'operator'.
 */
function migrate_0_3_to_1_0(payload: RawPayload): RawPayload {
  const out: RawPayload = { ...payload };

  // explainability_map → explainability
  if ('explainability_map' in out && !('explainability' in out)) {
    out.explainability = out.explainability_map;
    delete out.explainability_map;
  }

  // v0.3 density defaulted to 'expert'; in v1.0 the field default is 'operator'.
  // Only touch this if the field was absent in the original payload.
  if (!('density' in payload)) {
    out.density = 'operator';
  }

  out.version = '1.0.0';
  return out;
}

// ── Step migration registry ───────────────────────────────────────────────────

const STEP_MIGRATIONS: Record<string, StepMigration> = {
  '0.1.0->0.2.0': migrate_0_1_to_0_2,
  '0.2.0->0.3.0': migrate_0_2_to_0_3,
  '0.3.0->1.0.0': migrate_0_3_to_1_0,
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the ordered slice of `MIGRATION_CHAIN` between `from` (exclusive)
 * and `to` (inclusive).  Used internally by `migrate()`.
 */
export function migrationPath(from: string, to: string): string[] {
  const fromIdx = MIGRATION_CHAIN.indexOf(from as KnownSchemaVersion);
  const toIdx   = MIGRATION_CHAIN.indexOf(to   as KnownSchemaVersion);

  if (fromIdx === -1) {
    throw new MigrationError(`Unknown source version: "${from}". Known versions: ${MIGRATION_CHAIN.join(', ')}`);
  }
  if (toIdx === -1) {
    throw new MigrationError(`Unknown target version: "${to}". Known versions: ${MIGRATION_CHAIN.join(', ')}`);
  }
  if (fromIdx > toIdx) {
    throw new MigrationError(
      `Cannot downgrade: source "${from}" is newer than target "${to}". ` +
      'Downgrade migrations are not supported.'
    );
  }

  // Return the versions *after* from up to and including to
  return MIGRATION_CHAIN.slice(fromIdx + 1, toIdx + 1) as unknown as string[];
}

/**
 * Up-casts a raw intent payload from `fromVersion` to `toVersion`
 * (defaults to the current `SUPPORTED_SCHEMA_VERSION`).
 *
 * Chains individual step migrations sequentially.  Returns the transformed
 * payload with `version` set to `toVersion`.
 *
 * Throws `MigrationError` if either version is unknown or if a downgrade
 * is requested.
 *
 * @example
 * ```ts
 * const modern = migrate(legacyPayload, '0.1.0');
 * // modern.version === '1.0.0'
 * ```
 */
export function migrate(
  payload: RawPayload,
  fromVersion: string,
  toVersion: string = SUPPORTED_SCHEMA_VERSION,
): RawPayload {
  const steps = migrationPath(fromVersion, toVersion);

  let current = { ...payload };

  for (const targetVersion of steps) {
    const prevVersion = MIGRATION_CHAIN[MIGRATION_CHAIN.indexOf(targetVersion as KnownSchemaVersion) - 1];
    const key = `${prevVersion}->${targetVersion}`;
    const fn = STEP_MIGRATIONS[key];

    if (!fn) {
      // No migration needed for this step (e.g. compatible minor bump)
      current = { ...current, version: targetVersion };
      continue;
    }

    try {
      current = fn(current);
    } catch (err) {
      throw new MigrationError(
        `Migration step ${key} failed: ${err instanceof Error ? err.message : String(err)}`,
        current,
      );
    }
  }

  return current;
}

/**
 * Returns true if `payload` needs migration to reach `targetVersion`
 * (defaults to `SUPPORTED_SCHEMA_VERSION`).
 */
export function needsMigration(
  payload: RawPayload,
  targetVersion: string = SUPPORTED_SCHEMA_VERSION,
): boolean {
  const payloadVersion = typeof payload.version === 'string' ? payload.version : null;
  if (!payloadVersion) return true;
  return payloadVersion !== targetVersion && migrationPath(payloadVersion, targetVersion).length > 0;
}

/**
 * Convenience: migrate a payload only if it needs it.
 * Returns the payload unchanged if already at the target version.
 */
export function migrateIfNeeded(
  payload: RawPayload,
  targetVersion: string = SUPPORTED_SCHEMA_VERSION,
): RawPayload {
  const payloadVersion = typeof payload.version === 'string' ? payload.version : '0.1.0';
  if (payloadVersion === targetVersion) return payload;

  try {
    if (!needsMigration(payload, targetVersion)) return payload;
    return migrate(payload, payloadVersion, targetVersion);
  } catch {
    // If the version is unknown, attempt from the oldest known version
    return migrate(payload, MIGRATION_CHAIN[0], targetVersion);
  }
}

// ── Backward Compatibility Layer ──────────────────────────────────────────────
//
// Allows the frontend to accept payloads from one major version behind without
// hard migration errors.  Missing fields are filled with sensible defaults.

/**
 * Extract major version number from a semver string.
 *
 * @example
 * ```ts
 * getMajorVersion('1.5.2') === 1
 * getMajorVersion('0.3.0') === 0
 * ```
 */
export function getMajorVersion(version: string): number {
  const parts = version.split('.').map(Number);
  return parts[0] || 0;
}

/**
 * Extract minor version number from a semver string.
 */
export function getMinorVersion(version: string): number {
  const parts = version.split('.').map(Number);
  return parts[1] || 0;
}

/**
 * Determine if a version is out of support (more than one major version behind).
 *
 * The frontend only guarantees compatibility with one major version behind.
 *
 * @example
 * ```ts
 * isOutOfSupport('0.1.0', '1.0.0') // false — acceptable
 * isOutOfSupport('0.1.0', '2.0.0') // true  — too old
 * ```
 */
export function isOutOfSupport(
  payloadVersion: string,
  currentVersion: string = SUPPORTED_SCHEMA_VERSION,
): boolean {
  const payloadMajor = getMajorVersion(payloadVersion);
  const currentMajor = getMajorVersion(currentVersion);
  return payloadMajor < currentMajor - 1;
}

/**
 * Determine if a version can be migrated to the target version.
 *
 * Throws if more than one major version behind.
 * Accepts anything from the same major or one behind.
 *
 * @example
 * ```ts
 * canMigrate('1.0.0', '1.0.0') // true
 * canMigrate('0.3.0', '1.0.0') // true  — one major behind
 * canMigrate('0.1.0', '2.0.0') // false — two major versions behind
 * ```
 */
export function canMigrate(
  payloadVersion: string,
  targetVersion: string = SUPPORTED_SCHEMA_VERSION,
): boolean {
  // Unknown/missing version: try from oldest
  if (!payloadVersion) return true;

  // Check if out of support (more than one major version behind)
  if (isOutOfSupport(payloadVersion, targetVersion)) {
    return false;
  }

  // Same major version: always migratable
  if (getMajorVersion(payloadVersion) === getMajorVersion(targetVersion)) {
    return true;
  }

  // One major version behind: migratable
  return getMajorVersion(payloadVersion) === getMajorVersion(targetVersion) - 1;
}

/**
 * Default backward compatibility field values.
 * Used by migrateWithBackwardCompatibilityShim() to fill missing fields.
 */
const BC_DEFAULTS: BackwardCompatibilityDefaults = {
  ambiguities: [],
  priorityFields: [],
  explainability: {},
  density: 'operator',
  layoutHint: 'default',
  confidence: 0.5,
};

/**
 * Build a shim: fill in missing fields with backward compatibility defaults.
 *
 * Used after migration to ensure all expected fields are present, even if
 * the agent sent a payload from an older version.
 *
 * @param payload The migrated payload (already at target version)
 * @param defaults Optional custom defaults; merged with BC_DEFAULTS
 * @returns The payload with all expected fields populated
 *
 * @example
 * ```ts
 * const migrated = migrate(oldPayload, '0.1.0', '1.0.0');
 * const shimmed = buildBackwardCompatibilityShim(migrated);
 * // Now shimmed.explainability, shimmed.priorityFields, etc. are guaranteed
 * ```
 */
export function buildBackwardCompatibilityShim(
  payload: RawPayload,
  defaults: BackwardCompatibilityDefaults = {},
): RawPayload {
  const merged = { ...BC_DEFAULTS, ...defaults };
  const out = { ...payload };

  // Ensure all expected fields are present
  if (!('ambiguities' in out) || !Array.isArray(out.ambiguities)) {
    out.ambiguities = merged.ambiguities;
  }

  if (!('priorityFields' in out) || !Array.isArray(out.priorityFields)) {
    out.priorityFields = merged.priorityFields;
  }

  if (!('explainability' in out) || typeof out.explainability !== 'object' || out.explainability === null) {
    out.explainability = merged.explainability;
  }

  if (!('density' in out) || !['executive', 'operator', 'expert'].includes(String(out.density))) {
    out.density = merged.density;
  }

  if (!('layoutHint' in out) || typeof out.layoutHint !== 'string') {
    out.layoutHint = merged.layoutHint;
  }

  if (!('confidence' in out) || typeof out.confidence !== 'number') {
    out.confidence = merged.confidence;
  }

  return out;
}

/**
 * Migrate a payload with backward compatibility shim applied.
 *
 * Combines migrate() + buildBackwardCompatibilityShim() in one call.
 * If the payload is from an unsupported version (>1 major behind), throws.
 *
 * @param payload The raw payload from an agent
 * @param fromVersion The version the agent declared
 * @param toVersion The target version (defaults to SUPPORTED_SCHEMA_VERSION)
 * @param customDefaults Optional custom default values for shimmed fields
 * @returns The migrated payload with all fields populated
 * @throws {MigrationError} if the version is unsupported or migration fails
 *
 * @example
 * ```ts
 * // Agent sends v0.3.0 payload, frontend supports v1.0.0
 * const migrated = migrateWithBackwardCompatibilityShim(
 *   agentPayload,
 *   '0.3.0',
 *   '1.0.0'
 * );
 * // Result is guaranteed to have all v1.0.0 fields
 * ```
 */
export function migrateWithBackwardCompatibilityShim(
  payload: RawPayload,
  fromVersion: string,
  toVersion: string = SUPPORTED_SCHEMA_VERSION,
  customDefaults: BackwardCompatibilityDefaults = {},
): RawPayload {
  // Check if version is out of support
  if (isOutOfSupport(fromVersion, toVersion)) {
    throw new MigrationError(
      `Payload version ${fromVersion} is out of support (>1 major version behind). ` +
      `Target is ${toVersion}. Please ask the agent to upgrade.`,
      payload,
    );
  }

  // Perform migration
  const migrated = migrate(payload, fromVersion, toVersion);

  // Apply backward compatibility shim
  return buildBackwardCompatibilityShim(migrated, customDefaults);
}

