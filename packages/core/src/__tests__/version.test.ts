import { describe, it, expect } from 'vitest';
import {
  checkSchemaVersion,
  buildCapabilityManifest,
  SUPPORTED_SCHEMA_VERSION,
  negotiateVersion,
  negotiateVersionFull,
  queryCapabilities,
  getSupportedSchemaVersions,
  type VersionNegotiationRequest,
  type CapabilityQuery,
} from '../compiler/version';

describe('checkSchemaVersion', () => {
  it('returns compatible for the current supported version', () => {
    const result = checkSchemaVersion(SUPPORTED_SCHEMA_VERSION);
    expect(result.status).toBe('compatible');
  });

  it('returns compatible for 1.0.0', () => {
    const result = checkSchemaVersion('1.0.0');
    expect(result.status).toBe('compatible');
  });

  it('returns degraded for a higher minor within same major', () => {
    // 1.99.0 is ahead of 1.0.0 — frontend will warn but not reject
    const result = checkSchemaVersion('1.99.0');
    expect(result.status).toBe('degraded');
    expect((result as { reason: string }).reason).toBeDefined();
  });

  it('returns incompatible for a different major version', () => {
    const [major] = SUPPORTED_SCHEMA_VERSION.split('.').map(Number);
    const nextMajor = `${major + 1}.0.0`;
    const result = checkSchemaVersion(nextMajor);
    expect(result.status).toBe('incompatible');
    expect((result as { reason: string }).reason).toBeDefined();
  });

  it('result includes a reason string when not compatible', () => {
    const result = checkSchemaVersion('99.0.0');
    expect(result.status).toBe('incompatible');
    const r = result as { reason: string };
    expect(typeof r.reason).toBe('string');
    expect(r.reason.length).toBeGreaterThan(0);
  });

  it('returns degraded for an unrecognised version format', () => {
    const result = checkSchemaVersion('not-a-version');
    expect(result.status).toBe('degraded');
  });
});

describe('buildCapabilityManifest', () => {
  it('includes provided domains and intent types', () => {
    const manifest = buildCapabilityManifest(['travel', 'cloudops'], ['comparison', 'diagnostic']);
    expect(manifest.supportedDomains).toContain('travel');
    expect(manifest.supportedDomains).toContain('cloudops');
    expect(manifest.supportedIntentTypes).toContain('comparison');
    expect(manifest.supportedIntentTypes).toContain('diagnostic');
  });

  it('includes the supported schema version', () => {
    const manifest = buildCapabilityManifest([], []);
    expect(manifest.schemaVersion).toBe(SUPPORTED_SCHEMA_VERSION);
  });

  it('includes all four built-in ambiguity control types', () => {
    const manifest = buildCapabilityManifest([], []);
    expect(manifest.supportedAmbiguityTypes).toContain('range_selector');
    expect(manifest.supportedAmbiguityTypes).toContain('toggle');
    expect(manifest.supportedAmbiguityTypes).toContain('multi_select');
    expect(manifest.supportedAmbiguityTypes).toContain('single_select');
  });

  it('includes all three density modes', () => {
    const manifest = buildCapabilityManifest([], []);
    expect(manifest.densityModes).toContain('executive');
    expect(manifest.densityModes).toContain('operator');
    expect(manifest.densityModes).toContain('expert');
  });
});

describe('Version Negotiation Protocol', () => {
  describe('negotiateVersion()', () => {
    it('returns first agent version that frontend supports', () => {
      const result = negotiateVersion(['1.1.0', '1.0.0'], ['1.0.0']);
      expect(result).toBe('1.0.0');
    });

    it('returns null when no overlap', () => {
      const result = negotiateVersion(['2.0.0', '2.1.0'], ['1.0.0']);
      expect(result).toBeNull();
    });

    it('respects agent version precedence (first match)', () => {
      const result = negotiateVersion(['0.3.0', '1.0.0'], ['0.3.0', '1.0.0']);
      expect(result).toBe('0.3.0'); // Agent's best version first
    });

    it('handles single-element arrays', () => {
      expect(negotiateVersion(['1.0.0'], ['1.0.0'])).toBe('1.0.0');
      expect(negotiateVersion(['1.0.0'], ['2.0.0'])).toBeNull();
    });

    it('defaults to SUPPORTED_SCHEMA_VERSION', () => {
      const result = negotiateVersion(['1.0.0']);
      expect(result).toBe(SUPPORTED_SCHEMA_VERSION);
    });
  });

  describe('negotiateVersionFull()', () => {
    it('returns agreed version when common ground exists', () => {
      const request: VersionNegotiationRequest = {
        supportedVersions: ['1.0.0'],
        agentId: 'agent-1',
      };
      const response = negotiateVersionFull(request);
      expect(response.agreedVersion).toBe('1.0.0');
      expect(response.warnings.length).toBe(0);
    });

    it('warns about version drift (minor difference)', () => {
      const request: VersionNegotiationRequest = {
        supportedVersions: ['1.5.0', '1.0.0'],
        agentId: 'agent-2',
      };
      const response = negotiateVersionFull(request, ['1.0.0']);
      expect(response.agreedVersion).toBe('1.0.0');
      expect(response.warnings.some((w) => w.includes('drift'))).toBe(true);
    });

    it('warns about major version mismatch when no overlap', () => {
      const request: VersionNegotiationRequest = {
        supportedVersions: ['2.0.0'],
        agentId: 'agent-3',
      };
      const response = negotiateVersionFull(request, ['1.0.0']);
      expect(response.warnings.length).toBeGreaterThan(0);
      expect(response.warnings[0]).toContain('No version overlap');
    });

    it('sets willApplyBackwardCompatibilityShim correctly', () => {
      const request: VersionNegotiationRequest = {
        supportedVersions: ['1.0.0'],
        agentId: 'agent-4',
      };
      const response = negotiateVersionFull(request, ['1.0.0']);
      expect(response.willApplyBackwardCompatibilityShim).toBe(false);
    });

    it('includes supportedVersions in response', () => {
      const request: VersionNegotiationRequest = {
        supportedVersions: ['1.0.0'],
      };
      const response = negotiateVersionFull(request, ['1.0.0', '0.3.0']);
      expect(response.supportedVersions).toContain('1.0.0');
      expect(response.supportedVersions).toContain('0.3.0');
    });
  });
});

describe('Capability Discovery API', () => {
  describe('queryCapabilities()', () => {
    const manifest = buildCapabilityManifest(
      ['travel', 'ops', 'engineering'],
      ['document', 'form', 'diagnostic'],
    );

    it('returns matching intent types', () => {
      const query: CapabilityQuery = {
        intentTypes: ['document', 'workflow'],
      };
      const result = queryCapabilities(manifest, query);
      expect(result.supportedIntentTypes).toEqual(['document']);
    });

    it('returns matching domains', () => {
      const query: CapabilityQuery = {
        domains: ['travel', 'unknown'],
      };
      const result = queryCapabilities(manifest, query);
      expect(result.supportedDomains).toEqual(['travel']);
    });

    it('returns matching ambiguity types', () => {
      const query: CapabilityQuery = {
        ambiguityTypes: ['toggle', 'unknown_type'],
      };
      const result = queryCapabilities(manifest, query);
      expect(result.supportedAmbiguityTypes).toEqual(['toggle']);
    });

    it('checks minimum schema version', () => {
      const query: CapabilityQuery = {
        minSchemaVersion: '0.9.0',
      };
      const result = queryCapabilities(manifest, query);
      expect(result.meetsMinVersion).toBe(true);
    });

    it('returns false for unmet minimum version', () => {
      const query: CapabilityQuery = {
        minSchemaVersion: '2.0.0',
      };
      const result = queryCapabilities(manifest, query);
      expect(result.meetsMinVersion).toBe(false);
    });

    it('sets allCapabilitiesSupported when all match', () => {
      const query: CapabilityQuery = {
        intentTypes: ['document'],
        domains: ['travel'],
        ambiguityTypes: ['toggle'],
      };
      const result = queryCapabilities(manifest, query);
      expect(result.allCapabilitiesSupported).toBe(true);
    });

    it('sets allCapabilitiesSupported false when any missing', () => {
      const query: CapabilityQuery = {
        intentTypes: ['document', 'workflow'],
        domains: ['travel'],
      };
      const result = queryCapabilities(manifest, query);
      expect(result.allCapabilitiesSupported).toBe(false);
    });

    it('returns all capabilities when query is empty', () => {
      const query: CapabilityQuery = {};
      const result = queryCapabilities(manifest, query);
      expect(result.supportedIntentTypes).toEqual(manifest.supportedIntentTypes);
      expect(result.supportedDomains).toEqual(manifest.supportedDomains);
      expect(result.allCapabilitiesSupported).toBe(true);
    });

    it('defaults to no version requirement', () => {
      const query: CapabilityQuery = {
        intentTypes: ['document'],
      };
      const result = queryCapabilities(manifest, query);
      expect(result.meetsMinVersion).toBe(true);
    });
  });

  describe('getSupportedSchemaVersions()', () => {
    it('returns array containing SUPPORTED_SCHEMA_VERSION', () => {
      const versions = getSupportedSchemaVersions();
      expect(versions).toContain(SUPPORTED_SCHEMA_VERSION);
    });

    it('returns non-empty array', () => {
      const versions = getSupportedSchemaVersions();
      expect(versions.length).toBeGreaterThan(0);
    });
  });
});
