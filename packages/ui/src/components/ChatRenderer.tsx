import React, { useMemo, useRef, useEffect, useState } from 'react';
import { ChatDataSchema, type ChatMessage, type ChatAttachment } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// ChatRenderer
//
// Renders a conversation thread between a user and an agent.
// Supports density-aware presentation:
//   executive — compact list of messages, no timestamps
//   operator  — messages with role icons, timestamps, and status
//   expert    — full detail: timestamps, attachments, metadata, Why? buttons
//
// Streaming support: when a message's status is 'streaming', a blinking
// cursor is appended to indicate live generation.
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatRendererProps {
  data: unknown;
  density?: 'executive' | 'operator' | 'expert';
  onExplain?: (elementId: string) => void;
  onSendMessage?: (message: string, attachments?: File[]) => void;
}

// ── Role styling ───────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  user: {
    label: 'You',
    icon: '👤',
    align: 'flex-end' as const,
    bubbleBg: '#eff6ff',
    bubbleBorder: '#bfdbfe',
    labelColor: '#1d4ed8',
  },
  agent: {
    label: 'Agent',
    icon: '🤖',
    align: 'flex-start' as const,
    bubbleBg: '#f9fafb',
    bubbleBorder: '#e5e7eb',
    labelColor: '#374151',
  },
  system: {
    label: 'System',
    icon: 'ℹ️',
    align: 'center' as const,
    bubbleBg: '#fefce8',
    bubbleBorder: '#fde68a',
    labelColor: '#92400e',
  },
};

// ── Status indicator ───────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; style: React.CSSProperties }> = {
  streaming: {
    label: 'Typing…',
    style: { background: '#dbeafe', color: '#1d4ed8' },
  },
  error: {
    label: 'Error',
    style: { background: '#fee2e2', color: '#991b1b' },
  },
};

// ── Utilities ──────────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Simple markdown-to-inline-HTML: bold, italic, code spans, and newlines. */
function renderMarkdownInline(content: string): React.ReactNode {
  const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\n)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} style={{ background: '#f1f5f9', borderRadius: '3px', padding: '0 3px', fontSize: '0.85em', fontFamily: 'monospace' }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part === '\n') {
      return <br key={i} />;
    }
    return part;
  });
}

// ── Attachment pill ────────────────────────────────────────────────────────────

function AttachmentPill({ attachment }: { attachment: ChatAttachment }) {
  const isImage = attachment.type.startsWith('image/');
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.3rem',
      background: '#f1f5f9',
      border: '1px solid #e2e8f0',
      borderRadius: '0.375rem',
      padding: '0.2rem 0.5rem',
      fontSize: '0.75rem',
      color: '#475569',
      marginTop: '0.25rem',
      marginRight: '0.25rem',
    }}>
      <span>{isImage ? '🖼' : '📎'}</span>
      <span>{attachment.name}</span>
      {attachment.size && <span style={{ color: '#94a3b8' }}>({attachment.size})</span>}
    </div>
  );
}

// ── Date separator ─────────────────────────────────────────────────────────────

function DateSeparator({ ts }: { ts: number }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      margin: '0.75rem 0',
    }}>
      <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
      <span style={{ fontSize: '0.7rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
        {formatDate(ts)}
      </span>
      <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
    </div>
  );
}

// ── Single message bubble ──────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: ChatMessage;
  density: 'executive' | 'operator' | 'expert';
  isStreaming: boolean;
  onExplain?: (id: string) => void;
}

function MessageBubble({ message, density, isStreaming, onExplain }: MessageBubbleProps) {
  const config = ROLE_CONFIG[message.role] ?? ROLE_CONFIG.agent;
  const isSystem = message.role === 'system';
  const statusBadge = message.status && message.status !== 'sent' ? STATUS_BADGE[message.status] : null;

  if (isSystem) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0' }}>
        <div style={{
          background: config.bubbleBg,
          border: `1px solid ${config.bubbleBorder}`,
          borderRadius: '99px',
          padding: '0.2rem 0.9rem',
          fontSize: '0.75rem',
          color: config.labelColor,
          maxWidth: '70%',
          textAlign: 'center',
        }}>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: config.align,
      marginBottom: '0.75rem',
    }}>
      {/* Role + timestamp header */}
      {density !== 'executive' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          marginBottom: '0.2rem',
          flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
        }}>
          <span style={{ fontSize: '0.9rem' }}>{config.icon}</span>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: config.labelColor }}>{config.label}</span>
          {density === 'operator' || density === 'expert' ? (
            <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>{formatTime(message.timestamp)}</span>
          ) : null}
          {statusBadge && (
            <span style={{ fontSize: '0.65rem', borderRadius: '3px', padding: '0 4px', ...statusBadge.style }}>
              {statusBadge.label}
            </span>
          )}
        </div>
      )}

      {/* Bubble */}
      <div style={{
        background: config.bubbleBg,
        border: `1px solid ${config.bubbleBorder}`,
        borderRadius: '0.75rem',
        borderTopLeftRadius: message.role === 'user' ? '0.75rem' : '0.2rem',
        borderTopRightRadius: message.role === 'user' ? '0.2rem' : '0.75rem',
        padding: '0.55rem 0.75rem',
        maxWidth: '75%',
        wordBreak: 'break-word',
        opacity: message.status === 'error' ? 0.7 : 1,
      }}>
        <div style={{ fontSize: '0.875rem', color: '#111827', lineHeight: 1.5 }}>
          {renderMarkdownInline(message.content)}
          {isStreaming && (
            <span
              className="chat-cursor"
              style={{
                display: 'inline-block',
                width: '2px',
                height: '1em',
                background: '#6366f1',
                verticalAlign: 'text-bottom',
                marginLeft: '2px',
                animation: 'blink 1s step-end infinite',
              }}
              aria-hidden="true"
            />
          )}
        </div>

        {/* Attachments */}
        {density === 'expert' && message.attachments.length > 0 && (
          <div style={{ marginTop: '0.35rem' }}>
            {message.attachments.map((a) => (
              <AttachmentPill key={a.id} attachment={a} />
            ))}
          </div>
        )}

        {/* Metadata (expert only) */}
        {density === 'expert' && message.metadata && Object.keys(message.metadata).length > 0 && (
          <div style={{ marginTop: '0.35rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {Object.entries(message.metadata).map(([k, v]) => (
              <span key={k} style={{ fontSize: '0.65rem', background: '#f1f5f9', color: '#475569', borderRadius: '3px', padding: '1px 5px' }}>
                {k}: {String(v)}
              </span>
            ))}
          </div>
        )}

        {/* Why? button */}
        {density === 'expert' && message.explainElementId && (
          <button
            onClick={() => onExplain?.(message.explainElementId!)}
            aria-label="Explain this message"
            style={{ marginTop: '0.3rem', fontSize: '0.7rem', background: 'none', border: '1px solid #d1d5db', borderRadius: '3px', padding: '1px 6px', cursor: 'pointer', color: '#6b7280' }}
          >
            Why?
          </button>
        )}
      </div>

      {/* Error notice */}
      {message.status === 'error' && (
        <div style={{ fontSize: '0.65rem', color: '#ef4444', marginTop: '0.15rem' }}>
          Message failed to send. Please try again.
        </div>
      )}
    </div>
  );
}

// ── Input box ──────────────────────────────────────────────────────────────────

interface InputBarProps {
  placeholder: string;
  allowAttachments: boolean;
  onSend: (message: string) => void;
}

function InputBar({ placeholder, allowAttachments, onSend }: InputBarProps) {
  const [value, setValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        onSend(value.trim());
        setValue('');
      }
    }
  };

  const handleSendClick = () => {
    if (value.trim()) {
      onSend(value.trim());
      setValue('');
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: '0.5rem',
      padding: '0.75rem',
      borderTop: '1px solid #e5e7eb',
      background: '#fff',
    }}>
      {allowAttachments && (
        <button
          title="Attach file"
          aria-label="Attach file"
          style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: '0.375rem', padding: '0.4rem 0.5rem', cursor: 'pointer', fontSize: '1rem', color: '#6b7280', flexShrink: 0 }}
        >
          📎
        </button>
      )}
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        style={{
          flex: 1,
          resize: 'none',
          border: '1px solid #d1d5db',
          borderRadius: '0.5rem',
          padding: '0.5rem 0.75rem',
          fontSize: '0.875rem',
          fontFamily: 'inherit',
          lineHeight: 1.5,
          outline: 'none',
          maxHeight: '120px',
          overflowY: 'auto',
        }}
        aria-label="Message input"
      />
      <button
        onClick={handleSendClick}
        disabled={!value.trim()}
        style={{
          background: value.trim() ? '#6366f1' : '#e5e7eb',
          color: value.trim() ? '#fff' : '#9ca3af',
          border: 'none',
          borderRadius: '0.5rem',
          padding: '0.5rem 0.75rem',
          cursor: value.trim() ? 'pointer' : 'default',
          fontSize: '1rem',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
        aria-label="Send message"
      >
        ↑
      </button>
    </div>
  );
}

// ── Main renderer ──────────────────────────────────────────────────────────────

export function ChatRenderer({ data, density = 'operator', onExplain, onSendMessage }: ChatRendererProps) {
  const parsed = useMemo(() => {
    const result = ChatDataSchema.safeParse(data);
    return result.success ? result.data : null;
  }, [data]);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current && typeof bottomRef.current.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [parsed?.messages.length]);

  if (!parsed) {
    return (
      <div style={{ padding: '1rem', color: '#ef4444', fontSize: '0.875rem' }}>
        Invalid chat data.
      </div>
    );
  }

  const { title, messages, streamingMessageId, inputPlaceholder, allowAttachments, readOnly } = parsed;

  // Group messages by date for date separators
  const groups: { date: string; ts: number; messages: ChatMessage[] }[] = [];
  for (const msg of messages) {
    const date = new Date(msg.timestamp).toDateString();
    const last = groups[groups.length - 1];
    if (!last || last.date !== date) {
      groups.push({ date, ts: msg.timestamp, messages: [msg] });
    } else {
      last.messages.push(msg);
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', maxWidth: '100%', minHeight: '300px', maxHeight: '600px', border: '1px solid #e5e7eb', borderRadius: '0.75rem', overflow: 'hidden', background: '#fff' }}>
      {/* Header */}
      {title && (
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', margin: 0 }}>{title}</h2>
        </div>
      )}

      {/* Inline blink animation style — respects prefers-reduced-motion */}
      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .chat-cursor { animation: none !important; } }
      `}</style>

      {/* Message list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem', fontSize: '0.875rem' }}>
            No messages yet.
          </div>
        )}

        {groups.map((group) => (
          <div key={group.date}>
            {density !== 'executive' && <DateSeparator ts={group.ts} />}
            {group.messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                density={density}
                isStreaming={msg.id === streamingMessageId}
                onExplain={onExplain}
              />
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input bar (hidden in read-only or executive mode) */}
      {!readOnly && density !== 'executive' && (
        <InputBar
          placeholder={inputPlaceholder}
          allowAttachments={allowAttachments}
          onSend={(msg) => onSendMessage?.(msg)}
        />
      )}
    </div>
  );
}
