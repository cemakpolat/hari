import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Chat / Conversation Schema
//
// The chat intent type renders a conversation thread between the user and
// agent. Use it for support conversations, assistant interactions, Q&A
// sessions, or any message-based exchange.
//
// Density mapping:
//   executive — compact message list, no timestamps or metadata
//   operator  — messages with timestamps, role indicators, status
//   expert    — full detail: timestamps, status, attachments, metadata
// ─────────────────────────────────────────────────────────────────────────────

export const ChatMessageRoleSchema = z.enum(['user', 'agent', 'system']);
export type ChatMessageRole = z.infer<typeof ChatMessageRoleSchema>;

export const ChatMessageStatusSchema = z.enum(['sent', 'streaming', 'error']);
export type ChatMessageStatus = z.infer<typeof ChatMessageStatusSchema>;

export const ChatAttachmentSchema = z.object({
  /** Unique attachment identifier */
  id: z.string(),
  /** File name or display title */
  name: z.string(),
  /** MIME type, e.g. "image/png", "application/pdf" */
  type: z.string(),
  /** Human-readable file size, e.g. "1.2 MB" */
  size: z.string().optional(),
  /** URL to view or download the attachment */
  url: z.string().optional(),
});

export type ChatAttachment = z.infer<typeof ChatAttachmentSchema>;

export const ChatMessageSchema = z.object({
  /** Unique message identifier */
  id: z.string(),
  /** Who sent this message */
  role: ChatMessageRoleSchema,
  /**
   * Message body — markdown is supported and will be rendered inline.
   * For streaming messages this may be a partial string.
   */
  content: z.string(),
  /**
   * Unix epoch milliseconds when this message was sent/received.
   * Used to render timestamps and sort messages.
   */
  timestamp: z.number(),
  /**
   * Delivery/rendering status.
   * - sent: message was delivered successfully
   * - streaming: content is still being received character-by-character
   * - error: message failed to send or generate
   * @default 'sent'
   */
  status: ChatMessageStatusSchema.default('sent'),
  /** Optional file or media attachments */
  attachments: z.array(ChatAttachmentSchema).default([]),
  /** Extra key-value metadata shown in expert density */
  metadata: z.record(z.string(), z.unknown()).optional(),
  /** Links to an explainability entry in the parent IntentPayload */
  explainElementId: z.string().optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatDataSchema = z.object({
  /** Optional conversation heading */
  title: z.string().optional(),
  /** Ordered list of messages (oldest first) */
  messages: z.array(ChatMessageSchema),
  /**
   * ID of the message that is currently streaming.
   * The renderer animates that message differently.
   */
  streamingMessageId: z.string().optional(),
  /**
   * Placeholder text for the user input box.
   * @default 'Type a message…'
   */
  inputPlaceholder: z.string().default('Type a message…'),
  /**
   * Whether the user can attach files to their messages.
   * @default false
   */
  allowAttachments: z.boolean().default(false),
  /**
   * When true the input box is hidden (read-only conversation view).
   * @default false
   */
  readOnly: z.boolean().default(false),
});

export type ChatData = z.infer<typeof ChatDataSchema>;
