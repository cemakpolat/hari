export type {
  AgentBridge,
  AgentBridgeEvents,
  AgentBridgeEventName,
  AgentBridgeListener,
  ConnectionState,
  WhatIfQuery,
  WhatIfDelta,
  WhatIfResult,
  ReconnectOptions,
  TransportOptions,
} from './types';

export { MockAgentBridge } from './mock';
export type { MockTransportOptions } from './mock';

export { WebSocketAgentBridge } from './websocket';
export type { WebSocketTransportOptions } from './websocket';

export { SSEAgentBridge } from './sse';
export type { SSETransportOptions } from './sse';

export {
  parseNdjsonLine,
  splitNdjsonBuffer,
  NdjsonStreamParser,
  streamNdjson,
} from './streaming';
export type { NdjsonChunkResult } from './streaming';

export { adaptIntentPayload, adaptWithVersionCheck } from './adapter';
export type { RawPayload, AdaptResult } from './adapter';
