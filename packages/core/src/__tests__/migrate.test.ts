// ─────────────────────────────────────────────────────────────────────────────
// Schema migration utility tests
//
// Covers:
//   - migrationPath() — returns the correct step sequence
//   - Individual step migrations (0.1→0.2, 0.2→0.3, 0.3→1.0)
//   - migrate() — chains steps correctly, end-to-end
//   - needsMigration() — correct detection
//   - migrateIfNeeded() — no-op when already at target
//   - Error cases: unknown versions, downgrade attempts
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  migrate,
  migrationPath,
  needsMigration,
  migrateIfNeeded,
  MigrationError,
  MIGRATION_CHAIN,
  canMigrate,
  isOutOfSupport,
  getMajorVersion,
  getMinorVersion,
  buildBackwardCompatibilityShim,
  migrateWithBackwardCompatibilityShim,
} from '../compiler/migrate';
import { SUPPORTED_SCHEMA_VERSION } from '../compiler/version';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Minimal v0.1.0 payload using the original snake_case field names. */
const V0_1_PAYLOAD = {
  schema_version: '0.1.0',
  intent_type: 'document',
  domain: 'engineering',
  agent_confidence: 0.9,
  primary_goal: 'Show deployment report',
  data: {
    payload: {
      title: 'Deploy Report',
      sections: [],
    },
  },
};

/** Minimal v0.2.0 payload (camelCase, layoutType). */
const V0_2_PAYLOAD = {
  version: '0.2.0',
  type: 'document',
  domain: 'engineering',
  confidence: 0.9,
  primaryGoal: 'Show report',
  layoutType: 'feed',
  data: { title: 'Report', sections: [] },
  ambiguities: [],
};

/** Minimal v0.3.0 payload (layoutHint, explainability_map). */
const V0_3_PAYLOAD = {
  version: '0.3.0',
  type: 'document',
  domain: 'engineering',
  confidence: 0.85,
  primaryGoal: 'Show report',
  layoutHint: 'feed',
  priorityFields: [],
  explainability_map: { 'el-1': { reason: 'Important', sourceIds: [] } },
  data: { title: 'Report', sections: [] },
  ambiguities: [],
};

/** A minimal current (v1.0.0) payload. */
const V1_0_PAYLOAD = {
  version: '1.0.0',
  type: 'document',
  domain: 'engineering',
  confidence: 0.85,
  primaryGoal: 'Show report',
  layoutHint: 'feed',
  priorityFields: [],
  explainability: { 'el-1': { reason: 'Important', sourceIds: [] } },
  data: { title: 'Report', sections: [] },
  ambiguities: [],
};

// ── migrationPath() ───────────────────────────────────────────────────────────

describe('migrationPath()', () => {
  it('returns single step for adjacent versions', () => {
    expect(migrationPath('0.1.0', '0.2.0')).toEqual(['0.2.0']);
  });

  it('returns two steps for v0.1.0 → v0.3.0', () => {
    expect(migrationPath('0.1.0', '0.3.0')).toEqual(['0.2.0', '0.3.0']);
  });

  it('returns three steps for v0.1.0 → v1.0.0', () => {
    expect(migrationPath('0.1.0', '1.0.0')).toEqual(['0.2.0', '0.3.0', '1.0.0']);
  });

  it('returns empty array when from === to', () => {
    expect(migrationPath('1.0.0', '1.0.0')).toEqual([]);
  });

  it('throws MigrationError for unknown source version', () => {
    expect(() => migrationPath('9.9.9', '1.0.0')).toThrow(MigrationError);
  });

  it('throws MigrationError for unknown target version', () => {
    expect(() => migrationPath('0.1.0', '2.0.0')).toThrow(MigrationError);
  });

  it('throws MigrationError when downgrading', () => {
    expect(() => migrationPath('1.0.0', '0.3.0')).toThrow(MigrationError);
    expect(() => migrationPath('1.0.0', '0.3.0')).toThrow(/downgrade/i);
  });

  it('MIGRATION_CHAIN starts at 0.1.0 and ends at current', () => {
    expect(MIGRATION_CHAIN[0]).toBe('0.1.0');
    expect(MIGRATION_CHAIN[MIGRATION_CHAIN.length - 1]).toBe(SUPPORTED_SCHEMA_VERSION);
  });
});

// ── migrate() — step 0.1.0 → 0.2.0 ──────────────────────────────────────────

describe('migrate() v0.1.0 → v0.2.0', () => {
  const result = migrate(V0_1_PAYLOAD, '0.1.0', '0.2.0');

  it('renames intent_type → type', () => {
    expect(result.type).toBe('document');
    expect(result).not.toHaveProperty('intent_type');
  });

  it('renames schema_version → version and sets "0.2.0"', () => {
    expect(result.version).toBe('0.2.0');
    expect(result).not.toHaveProperty('schema_version');
  });

  it('renames agent_confidence → confidence', () => {
    expect(result.confidence).toBe(0.9);
    expect(result).not.toHaveProperty('agent_confidence');
  });

  it('unwraps data.payload → data', () => {
    expect(result.data).toEqual({ title: 'Deploy Report', sections: [] });
  });

  it('adds ambiguities: [] default', () => {
    expect(result.ambiguities).toEqual([]);
  });
});

// ── migrate() — step 0.2.0 → 0.3.0 ──────────────────────────────────────────

describe('migrate() v0.2.0 → v0.3.0', () => {
  const result = migrate(V0_2_PAYLOAD, '0.2.0', '0.3.0');

  it('renames layoutType → layoutHint', () => {
    expect(result.layoutHint).toBe('feed');
    expect(result).not.toHaveProperty('layoutType');
  });

  it('adds priorityFields: [] default', () => {
    expect(result.priorityFields).toEqual([]);
  });

  it('sets version to "0.3.0"', () => {
    expect(result.version).toBe('0.3.0');
  });

  it('does not duplicate layoutHint when already present', () => {
    const withHint = { ...V0_2_PAYLOAD, layoutHint: 'cards' };
    const r = migrate(withHint, '0.2.0', '0.3.0');
    expect(r.layoutHint).toBe('cards');
    expect(r).not.toHaveProperty('layoutType');
  });
});

// ── migrate() — step 0.3.0 → 1.0.0 ──────────────────────────────────────────

describe('migrate() v0.3.0 → v1.0.0', () => {
  const result = migrate(V0_3_PAYLOAD, '0.3.0', '1.0.0');

  it('renames explainability_map → explainability', () => {
    expect(result.explainability).toEqual(V0_3_PAYLOAD.explainability_map);
    expect(result).not.toHaveProperty('explainability_map');
  });

  it('sets version to "1.0.0"', () => {
    expect(result.version).toBe('1.0.0');
  });

  it('adds density: "operator" when density was absent', () => {
    const withoutDensity = { ...V0_3_PAYLOAD };
    delete (withoutDensity as Record<string, unknown>).density;
    const r = migrate(withoutDensity, '0.3.0', '1.0.0');
    expect(r.density).toBe('operator');
  });

  it('preserves explicit density when present in v0.3 payload', () => {
    const withDensity = { ...V0_3_PAYLOAD, density: 'expert' };
    const r = migrate(withDensity, '0.3.0', '1.0.0');
    expect(r.density).toBe('expert');
  });

  it('does not overwrite explainability if already present', () => {
    const withBoth = {
      ...V0_3_PAYLOAD,
      explainability: { 'el-2': { reason: 'Other', sourceIds: [] } },
    };
    const r = migrate(withBoth, '0.3.0', '1.0.0');
    expect((r.explainability as Record<string, unknown>)['el-2']).toBeDefined();
  });
});

// ── migrate() — end-to-end chaining ─────────────────────────────────────────

describe('migrate() end-to-end', () => {
  it('migrates v0.1.0 → v1.0.0 in one call', () => {
    const result = migrate(V0_1_PAYLOAD, '0.1.0');
    expect(result.version).toBe('1.0.0');
    expect(result.type).toBe('document');
    expect(result.confidence).toBe(0.9);
    expect(result.data).toEqual({ title: 'Deploy Report', sections: [] });
    expect(result.priorityFields).toEqual([]);
    expect(result.ambiguities).toEqual([]);
  });

  it('migrates v0.2.0 → v1.0.0', () => {
    const result = migrate(V0_2_PAYLOAD, '0.2.0');
    expect(result.version).toBe('1.0.0');
    expect(result.layoutHint).toBe('feed');
    expect(result).not.toHaveProperty('layoutType');
  });

  it('migrates v0.3.0 → v1.0.0', () => {
    const result = migrate(V0_3_PAYLOAD, '0.3.0');
    expect(result.version).toBe('1.0.0');
    expect(result.explainability).toEqual(V0_3_PAYLOAD.explainability_map);
  });

  it('is a no-op when fromVersion === toVersion', () => {
    const result = migrate(V1_0_PAYLOAD, '1.0.0', '1.0.0');
    expect(result).toEqual(V1_0_PAYLOAD);
  });

  it('does not mutate the original payload', () => {
    const original = { ...V0_1_PAYLOAD };
    migrate(V0_1_PAYLOAD, '0.1.0');
    expect(V0_1_PAYLOAD).toEqual(original);
  });

  it('throws MigrationError for unknown fromVersion', () => {
    expect(() => migrate(V1_0_PAYLOAD, '9.9.9')).toThrow(MigrationError);
  });

  it('throws MigrationError when trying to downgrade', () => {
    expect(() => migrate(V1_0_PAYLOAD, '1.0.0', '0.3.0')).toThrow(MigrationError);
  });

  it('partial migration: v0.1.0 → v0.3.0 skips the 1.0 step', () => {
    const result = migrate(V0_1_PAYLOAD, '0.1.0', '0.3.0');
    expect(result.version).toBe('0.3.0');
    expect(result.type).toBe('document');
    // explainability_map rename not yet applied
    expect(result).not.toHaveProperty('explainability');
  });
});

// ── needsMigration() ──────────────────────────────────────────────────────────

describe('needsMigration()', () => {
  it('returns true for v0.1.0 payload', () => {
    expect(needsMigration({ version: '0.1.0' })).toBe(true);
  });

  it('returns true for v0.3.0 payload', () => {
    expect(needsMigration({ version: '0.3.0' })).toBe(true);
  });

  it('returns false for current version payload', () => {
    expect(needsMigration({ version: SUPPORTED_SCHEMA_VERSION })).toBe(false);
  });

  it('returns true when version field is missing', () => {
    expect(needsMigration({})).toBe(true);
  });

  it('respects a custom target version', () => {
    expect(needsMigration({ version: '0.1.0' }, '0.2.0')).toBe(true);
    expect(needsMigration({ version: '0.2.0' }, '0.2.0')).toBe(false);
  });
});

// ── migrateIfNeeded() ─────────────────────────────────────────────────────────

describe('migrateIfNeeded()', () => {
  it('returns the payload unchanged when already at target version', () => {
    const result = migrateIfNeeded(V1_0_PAYLOAD);
    expect(result).toBe(V1_0_PAYLOAD); // reference equality — same object
  });

  it('migrates a v0.1.0 payload to the current version', () => {
    const result = migrateIfNeeded(V0_1_PAYLOAD);
    expect(result.version).toBe(SUPPORTED_SCHEMA_VERSION);
    expect(result.type).toBe('document');
  });

  it('migrates a v0.3.0 payload to the current version', () => {
    const result = migrateIfNeeded(V0_3_PAYLOAD);
    expect(result.version).toBe(SUPPORTED_SCHEMA_VERSION);
  });

  it('handles a payload with no version field (defaults to oldest known)', () => {
    const noVersion = { ...V0_1_PAYLOAD };
    delete (noVersion as Record<string, unknown>).schema_version;
    const result = migrateIfNeeded(noVersion);
    expect(result.version).toBe(SUPPORTED_SCHEMA_VERSION);
  });
});

// ── Backward Compatibility Layer ──────────────────────────────────────────────

describe('Backward Compatibility Layer', () => {
  describe('getMajorVersion() and getMinorVersion()', () => {
    it('extracts major version number', () => {
      expect(getMajorVersion('1.5.2')).toBe(1);
      expect(getMajorVersion('0.3.0')).toBe(0);
      expect(getMajorVersion('2.0.0')).toBe(2);
    });

    it('extracts minor version number', () => {
      expect(getMinorVersion('1.5.2')).toBe(5);
      expect(getMinorVersion('0.3.0')).toBe(3);
      expect(getMinorVersion('2.0.0')).toBe(0);
    });
  });

  describe('canMigrate()', () => {
    it('accepts same major version', () => {
      expect(canMigrate('1.0.0', '1.0.0')).toBe(true);
      expect(canMigrate('1.5.2', '1.0.0')).toBe(true);
    });

    it('accepts one major version behind', () => {
      expect(canMigrate('0.3.0', '1.0.0')).toBe(true);
      expect(canMigrate('0.1.0', '1.0.0')).toBe(true);
    });

    it('rejects more than one major version behind', () => {
      expect(canMigrate('0.1.0', '2.0.0')).toBe(false);
      expect(canMigrate('0.3.0', '2.0.0')).toBe(false);
    });

    it('accepts unknown version (defaults to oldest)', () => {
      expect(canMigrate('', '1.0.0')).toBe(true);
    });
  });

  describe('isOutOfSupport()', () => {
    it('returns false for same major version', () => {
      expect(isOutOfSupport('1.0.0', '1.0.0')).toBe(false);
      expect(isOutOfSupport('1.5.2', '1.0.0')).toBe(false);
    });

    it('returns false for one major version behind', () => {
      expect(isOutOfSupport('0.3.0', '1.0.0')).toBe(false);
      expect(isOutOfSupport('0.1.0', '1.0.0')).toBe(false);
    });

    it('returns true for more than one major version behind', () => {
      expect(isOutOfSupport('0.1.0', '2.0.0')).toBe(true);
      expect(isOutOfSupport('0.3.0', '2.0.0')).toBe(true);
    });
  });

  describe('buildBackwardCompatibilityShim()', () => {
    it('fills missing ambiguities with default []', () => {
      const payload = { version: '1.0.0', type: 'document' };
      const result = buildBackwardCompatibilityShim(payload);
      expect(result.ambiguities).toEqual([]);
    });

    it('fills missing priorityFields with default []', () => {
      const payload = { version: '1.0.0', type: 'document' };
      const result = buildBackwardCompatibilityShim(payload);
      expect(result.priorityFields).toEqual([]);
    });

    it('fills missing explainability with default {}', () => {
      const payload = { version: '1.0.0', type: 'document' };
      const result = buildBackwardCompatibilityShim(payload);
      expect(result.explainability).toEqual({});
    });

    it('fills missing density with "operator"', () => {
      const payload = { version: '1.0.0', type: 'document' };
      const result = buildBackwardCompatibilityShim(payload);
      expect(result.density).toBe('operator');
    });

    it('fills missing layoutHint with "default"', () => {
      const payload = { version: '1.0.0', type: 'document' };
      const result = buildBackwardCompatibilityShim(payload);
      expect(result.layoutHint).toBe('default');
    });

    it('fills missing confidence with 0.5', () => {
      const payload = { version: '1.0.0', type: 'document' };
      const result = buildBackwardCompatibilityShim(payload);
      expect(result.confidence).toBe(0.5);
    });

    it('does not overwrite existing fields', () => {
      const payload = {
        version: '1.0.0',
        type: 'document',
        ambiguities: [{ type: 'toggle', field: 'x' }],
        density: 'expert',
        confidence: 0.95,
      };
      const result = buildBackwardCompatibilityShim(payload);
      expect(result.ambiguities).toEqual([{ type: 'toggle', field: 'x' }]);
      expect(result.density).toBe('expert');
      expect(result.confidence).toBe(0.95);
    });

    it('accepts custom defaults', () => {
      const payload = { version: '1.0.0', type: 'document' };
      const custom = { confidence: 0.9, density: 'executive' };
      const result = buildBackwardCompatibilityShim(payload, custom);
      expect(result.confidence).toBe(0.9);
      expect(result.density).toBe('executive');
    });
  });

  describe('migrateWithBackwardCompatibilityShim()', () => {
    it('migrates and applies shim to v0.1 payload', () => {
      const result = migrateWithBackwardCompatibilityShim(
        V0_1_PAYLOAD,
        '0.1.0',
        SUPPORTED_SCHEMA_VERSION,
      );
      expect(result.version).toBe(SUPPORTED_SCHEMA_VERSION);
      expect(result.type).toBe('document');
      expect(result.ambiguities).toEqual([]);
      expect(Array.isArray(result.priorityFields)).toBe(true);
      expect(result.explainability).toBeDefined();
    });

    it('rejects out-of-support versions', () => {
      expect(() => {
        migrateWithBackwardCompatibilityShim(V0_1_PAYLOAD, '0.1.0', '2.0.0');
      }).toThrow(MigrationError);
    });

    it('applies custom defaults', () => {
      // Create a payload without confidence to test custom defaults
      const payloadNoConfidence = {
        schema_version: '0.1.0',
        intent_type: 'document',
        domain: 'engineering',
        // Note: no agent_confidence here
        primary_goal: 'Show deployment report',
        data: {
          payload: {
            title: 'Deploy Report',
            sections: [],
          },
        },
      };
      const custom = { confidence: 0.99 };
      const result = migrateWithBackwardCompatibilityShim(
        payloadNoConfidence,
        '0.1.0',
        SUPPORTED_SCHEMA_VERSION,
        custom,
      );
      expect(result.confidence).toBe(0.99);
    });
  });
});
