// ─────────────────────────────────────────────────────────────────────────────
// Schema Version Guard
//
// Every IntentPayload carries a semver `version` field.  The frontend must
// check this before rendering and decide whether to:
//   - Render normally          (version is supported)
//   - Render with warnings     (minor/patch version drift)
//   - Degrade gracefully       (major version mismatch)
//
// This implements the HARI extensibility contract:
//   "Frontends transform or gracefully degrade older versions."
//   "Capability discovery allows agents to adapt to supported features."
// ─────────────────────────────────────────────────────────────────────────────

export const SUPPORTED_SCHEMA_VERSION = '1.0.0';

export type VersionCompatibility =
  | { status: 'compatible';    warnings: string[] }
  | { status: 'degraded';      warnings: string[]; reason: string }
  | { status: 'incompatible';  reason: string };

/**
 * Check whether an IntentPayload's schema version is compatible with this
 * frontend version.  Returns a compatibility report the renderer can act on.
 */
export function checkSchemaVersion(payloadVersion: string): VersionCompatibility {
  const [supMaj, supMin] = SUPPORTED_SCHEMA_VERSION.split('.').map(Number);
  const parts = payloadVersion.split('.').map(Number);

  if (parts.length !== 3 || parts.some(isNaN)) {
    return { status: 'degraded', warnings: [], reason: `Unrecognised version format: "${payloadVersion}"` };
  }

  const [maj, min] = parts;

  if (maj !== supMaj) {
    return {
      status: 'incompatible',
      reason: `Major version mismatch: agent sent v${payloadVersion}, frontend supports v${SUPPORTED_SCHEMA_VERSION}. ` +
              `Rendering may fail. Update the frontend or ask the agent to downgrade the schema.`,
    };
  }

  const warnings: string[] = [];
  if (min > supMin) {
    warnings.push(
      `Agent uses schema v${payloadVersion} which is newer than supported v${SUPPORTED_SCHEMA_VERSION}. ` +
      `Some new fields may be ignored.`,
    );
    return { status: 'degraded', warnings, reason: warnings[0] };
  }

  if (min < supMin) {
    warnings.push(`Agent uses older schema v${payloadVersion}. Missing fields will use defaults.`);
  }

  return { status: 'compatible', warnings };
}

/**
 * Capability manifest: tells the agent which intent types and ambiguity
 * control types this frontend version supports.
 */
export interface CapabilityManifest {
  schemaVersion: string;
  supportedIntentTypes: string[];
  supportedAmbiguityTypes: string[];
  supportedDomains: string[];
  densityModes: string[];
}

/**
 * Version negotiation request: agent declares which schema versions it can produce.
 */
export interface VersionNegotiationRequest {
  /** Ordered list of schema versions the agent can produce, best-first. */
  supportedVersions: string[];
  /** Agent name/ID for logging. */
  agentId?: string;
}

/**
 * Version negotiation response: frontend declares which versions it accepts.
 */
export interface VersionNegotiationResponse {
  /** The mutually agreed-upon schema version. */
  agreedVersion: string;
  /** All versions the frontend supports. */
  supportedVersions: string[];
  /** Warnings (e.g., version drift) if any. */
  warnings: string[];
  /** Whether fallback/compatibility shim will be applied. */
  willApplyBackwardCompatibilityShim: boolean;
}

/**
 * Capability query: agent asks if the frontend supports specific features.
 */
export interface CapabilityQuery {
  intentTypes?: string[];
  ambiguityTypes?: string[];
  domains?: string[];
  minSchemaVersion?: string;
}

/**
 * Capability query result: confirms which features are supported.
 */
export interface CapabilityQueryResult {
  /** Which of the requested intent types are supported. */
  supportedIntentTypes: string[];
  /** Which of the requested ambiguity types are supported. */
  supportedAmbiguityTypes: string[];
  /** Which of the requested domains are supported. */
  supportedDomains: string[];
  /** Whether the minimum schema version is met. */
  meetsMinVersion: boolean;
  /** Overall capability summary. */
  allCapabilitiesSupported: boolean;
}

export function buildCapabilityManifest(
  registeredDomains: string[],
  registeredIntentTypes: string[],
): CapabilityManifest {
  return {
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    supportedIntentTypes: registeredIntentTypes,
    supportedAmbiguityTypes: ['range_selector', 'toggle', 'multi_select', 'single_select'],
    supportedDomains: registeredDomains,
    densityModes: ['executive', 'operator', 'expert'],
  };
}

// ── Version Negotiation Protocol ──────────────────────────────────────────────

/**
 * Negotiate a common schema version between agent and frontend.
 *
 * Agent provides a list of versions it can produce (best-first).
 * Frontend returns the best match it supports.
 *
 * Used during handshake to establish a working version before sending payloads.
 *
 * @param agentVersions Versions the agent claims to support (best-first)
 * @param frontendSupportedVersions Versions the frontend supports (defaults to SUPPORTED_SCHEMA_VERSION)
 * @returns The mutually agreed version, or null if no overlap
 *
 * @example
 * ```ts
 * const agreed = negotiateVersion(['1.1.0', '1.0.0'], ['1.0.0']);
 * // agreed === '1.0.0'
 * ```
 */
export function negotiateVersion(
  agentVersions: string[],
  frontendSupportedVersions: string[] = [SUPPORTED_SCHEMA_VERSION],
): string | null {
  // Find the first agent version that the frontend also supports
  for (const agentVersion of agentVersions) {
    if (frontendSupportedVersions.includes(agentVersion)) {
      return agentVersion;
    }
  }
  return null;
}

/**
 * Perform full version negotiation with detailed response.
 *
 * Includes warnings about version drift and whether backward compatibility
 * shim will be applied.
 *
 * @param request Agent's version negotiation request
 * @param frontendSupportedVersions Versions frontend supports
 * @returns Negotiation response with agreed version and details
 *
 * @example
 * ```ts
 * const response = negotiateVersionFull({
 *   supportedVersions: ['1.1.0', '1.0.0'],
 *   agentId: 'agent-xyz'
 * }, ['1.0.0']);
 * // response.agreedVersion === '1.0.0'
 * // response.willApplyBackwardCompatibilityShim === false
 * ```
 */
export function negotiateVersionFull(
  request: VersionNegotiationRequest,
  frontendSupportedVersions: string[] = [SUPPORTED_SCHEMA_VERSION],
): VersionNegotiationResponse {
  const warnings: string[] = [];
  const agreedVersion = negotiateVersion(request.supportedVersions, frontendSupportedVersions);

  if (!agreedVersion) {
    // No overlap: use frontend version and warn
    const fallback = frontendSupportedVersions[0];
    warnings.push(
      `No version overlap: agent supports ${request.supportedVersions.join(', ')}, ` +
      `frontend supports ${frontendSupportedVersions.join(', ')}. ` +
      `Falling back to ${fallback}. Rendering may fail.`,
    );
    return {
      agreedVersion: fallback,
      supportedVersions: frontendSupportedVersions,
      warnings,
      willApplyBackwardCompatibilityShim: true,
    };
  }

  // Check for version drift
  const [agentMajor, agentMinor] = request.supportedVersions[0].split('.').map(Number);
  const [agreedMajor, agreedMinor] = agreedVersion.split('.').map(Number);

  if (agentMajor !== agreedMajor) {
    warnings.push(
      `Major version mismatch: agent best version is ${request.supportedVersions[0]}, ` +
      `but negotiated to ${agreedVersion}.`,
    );
  } else if (agentMinor !== agreedMinor) {
    warnings.push(
      `Minor version drift: agent prefers ${request.supportedVersions[0]}, ` +
      `but using ${agreedVersion}. Some fields may be ignored.`,
    );
  }

  const willApplyShim = agreedVersion !== frontendSupportedVersions[0];

  return {
    agreedVersion,
    supportedVersions: frontendSupportedVersions,
    warnings,
    willApplyBackwardCompatibilityShim: willApplyShim,
  };
}

// ── Capability Discovery API ─────────────────────────────────────────────────

/**
 * Query the frontend's capabilities.
 *
 * Agent asks: "Do you support these intent types, ambiguity types, and domains?"
 * Frontend responds with a detailed capability report.
 *
 * Used by agents to adapt payload content based on what the frontend can render.
 *
 * @param manifest The frontend's capability manifest
 * @param query Agent's capability query
 * @returns Capability query result with supported features
 *
 * @example
 * ```ts
 * const manifest = buildCapabilityManifest(['travel'], ['comparison']);
 * const result = queryCapabilities(manifest, {
 *   intentTypes: ['comparison', 'workflow'],
 *   domains: ['travel', 'ops']
 * });
 * // result.supportedIntentTypes === ['comparison']
 * // result.supportedDomains === ['travel']
 * // result.allCapabilitiesSupported === false
 * ```
 */
export function queryCapabilities(
  manifest: CapabilityManifest,
  query: CapabilityQuery,
): CapabilityQueryResult {
  const supportedIntentTypes = query.intentTypes
    ? query.intentTypes.filter((t) => manifest.supportedIntentTypes.includes(t))
    : manifest.supportedIntentTypes;

  const supportedAmbiguityTypes = query.ambiguityTypes
    ? query.ambiguityTypes.filter((t) => manifest.supportedAmbiguityTypes.includes(t))
    : manifest.supportedAmbiguityTypes;

  const supportedDomains = query.domains
    ? query.domains.filter((d) => manifest.supportedDomains.includes(d))
    : manifest.supportedDomains;

  const meetsMinVersion =
    !query.minSchemaVersion ||
    manifest.schemaVersion >= query.minSchemaVersion;

  const allCapabilitiesSupported =
    (!query.intentTypes || supportedIntentTypes.length === query.intentTypes.length) &&
    (!query.ambiguityTypes || supportedAmbiguityTypes.length === query.ambiguityTypes.length) &&
    (!query.domains || supportedDomains.length === query.domains.length) &&
    meetsMinVersion;

  return {
    supportedIntentTypes,
    supportedAmbiguityTypes,
    supportedDomains,
    meetsMinVersion,
    allCapabilitiesSupported,
  };
}

/**
 * Get all schema versions the frontend currently supports.
 *
 * Primarily used by agents to understand the negotiation window.
 *
 * @deprecated Use SUPPORTED_SCHEMA_VERSION directly or list from manifest
 */
export function getSupportedSchemaVersions(): string[] {
  return [SUPPORTED_SCHEMA_VERSION];
}
