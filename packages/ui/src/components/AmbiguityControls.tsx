import React from 'react';
import type { AmbiguityControl } from '@hari/core';
import { useIntentStore } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// AmbiguityControls
//
// Renders the set of ambiguity controls emitted by the agent.
// Interactions are:
//   1. Optimistic local update (immediate UI feedback via store)
//   2. Debounced patch committed to the agent (caller handles the commit)
//
// Controls never block the main view — they appear inline above the content.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  controls: AmbiguityControl[];
  /** Called after a control value changes, with the controlId + new value */
  onModify?: (controlId: string, value: unknown) => void;
}

export function AmbiguityControls({ controls, onModify }: Props) {
  const modifyAmbiguity = useIntentStore((s) => s.modifyAmbiguity);

  if (controls.length === 0) return null;

  const handleChange = (id: string, value: AmbiguityControl['value']) => {
    modifyAmbiguity(id, value);
    onModify?.(id, value);
  };

  return (
    <div
      role="group"
      aria-label="Clarify intent"
      style={{
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '0.625rem',
        padding: '1rem 1.25rem',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          fontSize: '0.65rem',
          fontWeight: 700,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: '0.875rem',
        }}
      >
        Clarify Intent
      </div>
      {controls.map((control) => (
        <ControlItem key={control.id} control={control} onChange={handleChange} />
      ))}
    </div>
  );
}

// ─── Individual control renderers ────────────────────────────────────────────

function ControlItem({
  control,
  onChange,
}: {
  control: AmbiguityControl;
  onChange: (id: string, value: AmbiguityControl['value']) => void;
}) {
  switch (control.type) {
    case 'range_selector': {
      const inputId = `range-${control.id}`;
      return (
        <div style={{ marginBottom: '1rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '0.25rem',
            }}
          >
            <label htmlFor={inputId} style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
              {control.label}
            </label>
            <span aria-hidden="true" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {control.minLabel ?? control.min}&nbsp;←&nbsp;
              <strong style={{ color: '#475569' }}>{control.value.toFixed(1)}</strong>
              &nbsp;→&nbsp;{control.maxLabel ?? control.max}
            </span>
          </div>
          {control.description && (
            <p style={{ margin: '0 0 0.375rem', fontSize: '0.75rem', color: '#94a3b8' }}>
              {control.description}
            </p>
          )}
          <input
            id={inputId}
            type="range"
            min={control.min}
            max={control.max}
            step={control.step}
            value={control.value}
            aria-valuemin={control.min}
            aria-valuemax={control.max}
            aria-valuenow={control.value}
            aria-valuetext={`${control.value.toFixed(1)} — range ${control.minLabel ?? control.min} to ${control.maxLabel ?? control.max}`}
            onChange={(e) => onChange(control.id, parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#4f46e5' }}
          />
        </div>
      );
    }

    case 'toggle':
      return (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.875rem',
          }}
        >
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
              {control.label}
            </div>
            {control.description && (
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                {control.description}
              </div>
            )}
          </div>
          <Toggle
            checked={control.value}
            label={control.label}
            onChange={(v) => onChange(control.id, v)}
          />
        </div>
      );

    case 'multi_select':
      return (
        <div style={{ marginBottom: '0.875rem' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
            {control.label}
          </div>
          {control.description && (
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.375rem' }}>
              {control.description}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {control.options.map((opt) => {
              const active = control.value.includes(opt.value);
              return (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  active={active}
                  onClick={() => {
                    const next = active
                      ? control.value.filter((v) => v !== opt.value)
                      : [...control.value, opt.value];
                    onChange(control.id, next);
                  }}
                />
              );
            })}
          </div>
        </div>
      );

    case 'single_select':
      return (
        <div style={{ marginBottom: '0.875rem' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
            {control.label}
          </div>
          {control.description && (
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.375rem' }}>
              {control.description}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {control.options.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                active={control.value === opt.value}
                onClick={() => onChange(control.id, opt.value)}
              />
            ))}
          </div>
        </div>
      );
  }
}

// ─── Primitive components ─────────────────────────────────────────────────────

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label?: string;
  onChange: (v: boolean) => void;
}) {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        width: '2.75rem',
        height: '1.5rem',
        borderRadius: '9999px',
        border: 'none',
        backgroundColor: checked ? '#4f46e5' : '#cbd5e1',
        cursor: 'pointer',
        transition: prefersReducedMotion ? 'none' : 'background-color 0.2s',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '0.125rem',
          left: checked ? '1.375rem' : '0.125rem',
          width: '1.25rem',
          height: '1.25rem',
          borderRadius: '50%',
          backgroundColor: 'white',
          transition: prefersReducedMotion ? 'none' : 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: '0.25rem 0.75rem',
        borderRadius: '0.375rem',
        border: `1.5px solid ${active ? '#4f46e5' : '#cbd5e1'}`,
        backgroundColor: active ? '#eef2ff' : 'white',
        color: active ? '#3730a3' : '#64748b',
        fontSize: '0.875rem',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}
