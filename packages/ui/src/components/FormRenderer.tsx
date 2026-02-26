// ─────────────────────────────────────────────────────────────────────────────
// FormRenderer — Renders form intent types.
//
// When the agent needs structured input from the user, it emits an intent with
// form fields. This component renders the form with validation, conditional
// visibility, and accessibility support.
//
// Features:
//   - 9 field types: text, number, datetime, select, checkbox, radio, file, slider, hidden
//   - Client-side validation with real-time feedback
//   - Conditional field visibility based on other field values
//   - Section organization for complex forms
//   - Sensitive data handling (passwords, API keys)
//   - Full keyboard navigation and ARIA support
//
// Usage (via registry):
//   registry.register('deployment', 'form', { default: () => FormWrapper });
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { FormField, FormSection, FormStep, ValidationRule, DateRangeValue } from '@hari/core';
import { VirtualFieldList, VIRTUALIZE_THRESHOLD } from './VirtualFieldList';
import { VoiceMicButton } from './VoiceMicButton';

// ── Dark mode ─────────────────────────────────────────────────────────────────

function usePrefersDark(): boolean {
  const mq = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;
  const [dark, setDark] = useState(mq?.matches ?? false);
  useEffect(() => {
    if (!mq) return;
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mq]);
  return dark;
}

function useFormPalette() {
  const dark = usePrefersDark();
  return {
    dark,
    bg:            dark ? '#0f172a' : '#ffffff',
    bgSubtle:      dark ? '#1e293b' : '#f8fafc',
    bgDisabled:    dark ? '#0f172a' : '#f1f5f9',
    border:        dark ? '#334155' : '#e2e8f0',
    borderStrong:  dark ? '#475569' : '#cbd5e1',
    borderFocus:   dark ? '#6366f1' : '#6366f1',
    textPrimary:   dark ? '#f1f5f9' : '#1e293b',
    textLabel:     dark ? '#cbd5e1' : '#334155',
    textSecondary: dark ? '#94a3b8' : '#64748b',
    textMuted:     dark ? '#64748b' : '#94a3b8',
    textDisabled:  dark ? '#475569' : '#94a3b8',
  } as const;
}

// ── Public props ──────────────────────────────────────────────────────────────

export interface FormRendererProps {
  /** Form sections with fields */
  sections: FormSection[];
  /** Form ID for submission tracking */
  formId: string;
  /** Callback when form is submitted */
  onSubmit?: (values: Record<string, unknown>) => void;
  /** Callback when form values change */
  onChange?: (values: Record<string, unknown>) => void;
  /** Initial values (for edit forms) */
  initialValues?: Record<string, unknown>;
  /** Whether to show submit button */
  showSubmitButton?: boolean;
  /** Submit button label */
  submitButtonLabel?: string;
  /** Whether form is currently submitting */
  isSubmitting?: boolean;
  /**
   * Async validators keyed by field id.
   * Called after sync validation passes on blur.
   * Return null for valid, or an error string.
   */
  asyncValidators?: Record<string, (value: unknown) => Promise<string | null>>;
  /**
   * Server-returned validation errors (e.g. from FormValidationResponse).
   * Field errors are merged with client-side errors; globalError is shown
   * as a banner above the submit button. Both reset on the next user edit.
   */
  serverErrors?: {
    fieldErrors?: Record<string, string>;
    globalError?: string;
  };
  /**
   * Rate-limit repeated submissions.
   * Blocks submit when maxAttempts have been made within the last windowMs ms.
   */
  rateLimit?: {
    maxAttempts: number;
    windowMs: number;
  };
  /**
   * Wizard / multi-step mode.
   * When provided, the form renders one step at a time with a step indicator,
   * back/next navigation, and per-step validation before advancing.
   */
  steps?: FormStep[];
  /**
   * Auto-save form values to localStorage.
   * On mount, if a matching draft exists, a "Restore saved draft?" banner
   * is shown. Draft is cleared on successful submission.
   *
   * The localStorage key defaults to `hari-form-draft-<formId>`.
   */
  autoSave?: boolean;
}

// ── Validation helpers ────────────────────────────────────────────────────────

function validateField(
  value: unknown,
  field: FormField,
): string | null {
  // Required check
  if (field.required && (value === undefined || value === null || value === '')) {
    return `${field.label} is required`;
  }

  // Skip other validations if empty and not required
  if (!value && !field.required) return null;

  // Type-specific validations
  const stringValue = String(value);

  for (const rule of (field.validation ?? [])) {
    switch (rule.type) {
      case 'required':
        if (!value) return rule.message;
        break;

      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(stringValue)) {
          return rule.message;
        }
        break;

      case 'url':
        try {
          new URL(stringValue);
        } catch {
          return rule.message;
        }
        break;

      case 'min':
        if (field.type === 'number' && typeof value === 'number') {
          if (value < Number(rule.value)) return rule.message;
        } else if (stringValue.length < Number(rule.value)) {
          return rule.message;
        }
        break;

      case 'max':
        if (field.type === 'number' && typeof value === 'number') {
          if (value > Number(rule.value)) return rule.message;
        } else if (stringValue.length > Number(rule.value)) {
          return rule.message;
        }
        break;

      case 'pattern':
        if (rule.pattern && !new RegExp(rule.pattern).test(stringValue)) {
          return rule.message;
        }
        break;
    }
  }

  return null;
}

// ── Main component ────────────────────────────────────────────────────────────

export function FormRenderer({
  sections,
  formId,
  onSubmit,
  onChange,
  initialValues = {},
  showSubmitButton = true,
  submitButtonLabel = 'Submit',
  isSubmitting = false,
  asyncValidators = {},
  serverErrors,
  rateLimit,
  steps,
  autoSave = false,
}: FormRendererProps) {
  const p = useFormPalette();
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>(serverErrors?.fieldErrors ?? {});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [validating, setValidating] = useState<Record<string, boolean>>({});
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  // Wizard state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  // Auto-save: show restore banner when a saved draft is found on mount
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);
  // Track pending async calls so stale results are discarded
  const asyncSeq = useRef<Record<string, number>>({});
  // Track submission timestamps for rate limiting
  const submitTimestamps = useRef<number[]>([]);
  // Auto-save draft key
  const draftKey = `hari-form-draft-${formId}`;

  // Initialize with default values
  useEffect(() => {
    const defaults: Record<string, unknown> = {};
    sections.forEach((section) => {
      section.fields.forEach((field) => {
        if (field.defaultValue !== undefined && values[field.id] === undefined) {
          defaults[field.id] = field.defaultValue;
        }
      });
    });
    if (Object.keys(defaults).length > 0) {
      setValues((prev) => ({ ...defaults, ...prev }));
    }
  }, [sections]);

  // Auto-save: check for a saved draft on mount
  useEffect(() => {
    if (!autoSave) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          setShowRestoreBanner(true);
        }
      }
    } catch {
      // localStorage unavailable or parse error — ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save: write draft to localStorage when values change (debounced 600 ms)
  useEffect(() => {
    if (!autoSave) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(values));
      } catch {
        // quota exceeded or private mode — ignore
      }
    }, 600);
    return () => clearTimeout(id);
  }, [autoSave, draftKey, values]);

  const handleFieldChange = useCallback(
    (fieldId: string, value: unknown, field: FormField) => {
      const newValues = { ...values, [fieldId]: value };
      setValues(newValues);
      onChange?.(newValues);
      // Clear rate-limit error on any change
      setRateLimitError(null);

      // Validate on change if field was touched
      if (touched[fieldId]) {
        // Prefer client error; clear server error for this field on edit
        const error = validateField(value, field);
        setErrors((prev) => ({
          ...prev,
          [fieldId]: error || '',
        }));
      }
    },
    [values, touched, onChange]
  );

  const handleFieldBlur = useCallback(
    (fieldId: string, field: FormField) => {
      setTouched((prev) => ({ ...prev, [fieldId]: true }));
      const syncError = validateField(values[fieldId], field);
      setErrors((prev) => ({ ...prev, [fieldId]: syncError || '' }));

      // Run async validator only when sync validation passes
      if (!syncError && asyncValidators[fieldId]) {
        const seq = (asyncSeq.current[fieldId] ?? 0) + 1;
        asyncSeq.current[fieldId] = seq;
        setValidating((prev) => ({ ...prev, [fieldId]: true }));
        asyncValidators[fieldId](values[fieldId]).then((asyncError) => {
          // Discard if a newer call has been triggered
          if (asyncSeq.current[fieldId] !== seq) return;
          setValidating((prev) => ({ ...prev, [fieldId]: false }));
          if (asyncError) setErrors((prev) => ({ ...prev, [fieldId]: asyncError }));
        }).catch(() => {
          if (asyncSeq.current[fieldId] !== seq) return;
          setValidating((prev) => ({ ...prev, [fieldId]: false }));
        });
      }
    },
    [values, asyncValidators]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      // Rate limiting
      if (rateLimit) {
        const now = Date.now();
        submitTimestamps.current = submitTimestamps.current.filter(
          (ts) => now - ts < rateLimit.windowMs,
        );
        if (submitTimestamps.current.length >= rateLimit.maxAttempts) {
          const oldest = submitTimestamps.current[0];
          const waitSec = Math.ceil((rateLimit.windowMs - (now - oldest)) / 1000);
          setRateLimitError(`Too many attempts. Please wait ${waitSec}s before retrying.`);
          return;
        }
        submitTimestamps.current.push(now);
      }

      setRateLimitError(null);

      // Validate all fields
      const newErrors: Record<string, string> = {};
      sections.forEach((section) => {
        section.fields.forEach((field) => {
          const error = validateField(values[field.id], field);
          if (error) newErrors[field.id] = error;
        });
      });

      // Merge server-side field errors for untouched fields
      if (serverErrors?.fieldErrors) {
        Object.entries(serverErrors.fieldErrors).forEach(([fieldId, msg]) => {
          if (!newErrors[fieldId]) newErrors[fieldId] = msg;
        });
      }

      setErrors(newErrors);

      if (Object.keys(newErrors).length === 0) {
        // Clear saved draft on successful submission
        if (autoSave) {
          try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
        }
        onSubmit?.(values);
      }
    },
    [sections, values, onSubmit, rateLimit, serverErrors, autoSave, draftKey]
  );

  // Check if field should be visible based on conditional visibility
  const isFieldVisible = useCallback(
    (field: FormField): boolean => {
      if (!field.conditionalVisibility) return true;
      const { dependsOn, value: expectedValue } = field.conditionalVisibility;
      return values[dependsOn] === expectedValue;
    },
    [values]
  );

  // ── Wizard helpers ────────────────────────────────────────────────────────
  const isWizard = steps && steps.length > 0;
  const currentStep = isWizard ? steps![currentStepIndex] : null;
  const isLastStep = isWizard ? currentStepIndex === steps!.length - 1 : true;

  // Sections visible in the current wizard step (all sections when not wizard)
  const visibleSections = isWizard && currentStep
    ? sections.filter((s) => currentStep.sectionIds.includes(s.id))
    : sections;

  // Validate only the fields in the current visible sections
  const validateCurrentStep = useCallback((): Record<string, string> => {
    const stepErrors: Record<string, string> = {};
    visibleSections.forEach((section) => {
      section.fields.forEach((field) => {
        if (!isFieldVisible(field)) return;
        const error = validateField(values[field.id], field);
        if (error) stepErrors[field.id] = error;
      });
    });
    return stepErrors;
  }, [visibleSections, values, isFieldVisible]);

  const handleNext = useCallback(() => {
    const stepErrors = validateCurrentStep();
    // Mark all current-step fields as touched so errors become visible
    const nowTouched: Record<string, boolean> = {};
    visibleSections.forEach((s) => s.fields.forEach((f) => { nowTouched[f.id] = true; }));
    setTouched((prev) => ({ ...prev, ...nowTouched }));
    setErrors((prev) => ({ ...prev, ...stepErrors }));
    if (Object.keys(stepErrors).length === 0) {
      setCurrentStepIndex((i) => i + 1);
    }
  }, [validateCurrentStep, visibleSections]);

  const handleBack = useCallback(() => {
    setCurrentStepIndex((i) => Math.max(0, i - 1));
  }, []);

  // ── Restore draft handler ──────────────────────────────────────────────────
  const handleRestoreDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setValues(parsed);
        onChange?.(parsed);
      }
    } catch { /* ignore */ }
    setShowRestoreBanner(false);
  }, [draftKey, onChange]);

  const handleDiscardDraft = useCallback(() => {
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    setShowRestoreBanner(false);
  }, [draftKey]);

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%', color: p.textPrimary }}>
      {/* Restore draft banner */}
      {showRestoreBanner && (
        <div role="alert" style={{
          marginBottom: '1rem',
          padding: '0.625rem 0.875rem',
          backgroundColor: p.dark ? '#1e3a5f' : '#eff6ff',
          border: `1px solid ${p.dark ? '#3b82f6' : '#93c5fd'}`,
          borderRadius: '0.375rem',
          fontSize: '0.8rem',
          color: p.dark ? '#93c5fd' : '#1d4ed8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}>
          <span>A saved draft was found. Would you like to restore it?</span>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleRestoreDraft}
              aria-label="Restore saved draft"
              style={{
                padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 600,
                backgroundColor: '#4f46e5', color: 'white',
                border: 'none', borderRadius: '0.375rem', cursor: 'pointer',
              }}
            >
              Restore
            </button>
            <button
              type="button"
              onClick={handleDiscardDraft}
              aria-label="Discard saved draft"
              style={{
                padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 600,
                backgroundColor: p.bgSubtle, color: p.textSecondary,
                border: `1px solid ${p.borderStrong}`, borderRadius: '0.375rem', cursor: 'pointer',
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Wizard step indicator */}
      {isWizard && steps && (
        <WizardStepIndicator steps={steps} currentIndex={currentStepIndex} />
      )}

      {visibleSections.map((section) => (
        <FormSectionRenderer
          key={section.id}
          section={section}
          values={values}
          errors={errors}
          touched={touched}
          validating={validating}
          onFieldChange={handleFieldChange}
          onFieldBlur={handleFieldBlur}
          isFieldVisible={isFieldVisible}
        />
      ))}

      {/* Footer: wizard nav or normal submit */}
      <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: `1px solid ${p.border}` }}>
        {/* Server-level global error */}
        {serverErrors?.globalError && (
          <div role="alert" style={{
            marginBottom: '0.75rem',
            padding: '0.625rem 0.875rem',
            backgroundColor: p.dark ? '#3b1114' : '#fef2f2',
            border: `1px solid ${p.dark ? '#ef4444' : '#fca5a5'}`,
            borderRadius: '0.375rem',
            fontSize: '0.8rem',
            color: p.dark ? '#fca5a5' : '#991b1b',
          }}>
            {serverErrors.globalError}
          </div>
        )}

        {/* Rate-limit error */}
        {rateLimitError && (
          <div role="alert" style={{
            marginBottom: '0.75rem',
            padding: '0.625rem 0.875rem',
            backgroundColor: p.dark ? '#3b2600' : '#fffbeb',
            border: `1px solid ${p.dark ? '#f59e0b' : '#fcd34d'}`,
            borderRadius: '0.375rem',
            fontSize: '0.8rem',
            color: p.dark ? '#fcd34d' : '#92400e',
          }}>
            {rateLimitError}
          </div>
        )}

        {isWizard ? (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={handleBack}
                aria-label="Go to previous step"
                style={{
                  padding: '0.625rem 1.25rem',
                  backgroundColor: p.bgSubtle,
                  color: p.textSecondary,
                  border: `1px solid ${p.borderStrong}`,
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ← Back
              </button>
            )}
            {!isLastStep && (
              <button
                type="button"
                onClick={handleNext}
                aria-label="Go to next step"
                style={{
                  padding: '0.625rem 1.5rem',
                  backgroundColor: '#4f46e5',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Next →
              </button>
            )}
            {isLastStep && showSubmitButton && (
              <button
                type="submit"
                disabled={isSubmitting || !!rateLimitError}
                style={{
                  padding: '0.625rem 1.5rem',
                  backgroundColor: isSubmitting || rateLimitError ? p.textMuted : '#4f46e5',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: isSubmitting || rateLimitError ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting ? 'Submitting...' : submitButtonLabel}
              </button>
            )}
            <span style={{ fontSize: '0.7rem', color: p.textMuted, marginLeft: 'auto' }}>
              Step {currentStepIndex + 1} of {steps!.length}
            </span>
          </div>
        ) : showSubmitButton && (
          <button
            type="submit"
            disabled={isSubmitting || !!rateLimitError}
            style={{
              padding: '0.625rem 1.5rem',
              backgroundColor: isSubmitting || rateLimitError ? p.textMuted : '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: isSubmitting || rateLimitError ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
            }}
          >
            {isSubmitting ? 'Submitting...' : submitButtonLabel}
          </button>
        )}
      </div>
    </form>
  );
}

// ── Wizard step indicator ─────────────────────────────────────────────────────

function WizardStepIndicator({
  steps,
  currentIndex,
}: {
  steps: FormStep[];
  currentIndex: number;
}) {
  const p = useFormPalette();
  return (
    <nav aria-label="Form steps" style={{ marginBottom: '1.5rem' }}>
      <ol style={{
        display: 'flex',
        listStyle: 'none',
        margin: 0,
        padding: 0,
        gap: 0,
        alignItems: 'center',
      }}>
        {steps.map((step, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <React.Fragment key={step.id}>
              <li style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' }}>
                <div style={{
                  width: '2rem', height: '2rem',
                  borderRadius: '50%',
                  border: `2px solid ${active || done ? '#4f46e5' : p.borderStrong}`,
                  backgroundColor: done ? '#4f46e5' : active ? (p.dark ? '#1e1b4b' : '#eff6ff') : p.bg,
                  color: done ? 'white' : active ? '#6366f1' : p.textMuted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700,
                  transition: 'all 0.2s',
                }}>
                  {done ? '✓' : i + 1}
                </div>
                <div style={{
                  marginTop: '0.3rem',
                  fontSize: '0.65rem',
                  fontWeight: active ? 700 : 400,
                  color: active ? '#6366f1' : done ? p.textSecondary : p.textMuted,
                  whiteSpace: 'nowrap',
                  maxWidth: '6rem',
                  textAlign: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {step.title}
                </div>
              </li>
              {i < steps.length - 1 && (
                <li style={{
                  flex: '1 1 auto',
                  height: '2px',
                  marginBottom: '1.2rem',
                  backgroundColor: i < currentIndex ? '#4f46e5' : p.border,
                  transition: 'background-color 0.3s',
                  minWidth: '1rem',
                }} aria-hidden="true" />
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

// ── Section renderer ──────────────────────────────────────────────────────────

interface FormSectionRendererProps {
  section: FormSection;
  values: Record<string, unknown>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  validating: Record<string, boolean>;
  onFieldChange: (fieldId: string, value: unknown, field: FormField) => void;
  onFieldBlur: (fieldId: string, field: FormField) => void;
  isFieldVisible: (field: FormField) => boolean;
}

function FormSectionRenderer({
  section,
  values,
  errors,
  touched,
  validating,
  onFieldChange,
  onFieldBlur,
  isFieldVisible,
}: FormSectionRendererProps) {
  const p = useFormPalette();
  const [collapsed, setCollapsed] = useState(section.defaultCollapsed);

  const visibleFields = section.fields.filter(isFieldVisible);

  if (visibleFields.length === 0) return null;

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {section.title && (
        <div
          style={{
            marginBottom: '1rem',
            paddingBottom: '0.5rem',
            borderBottom: `2px solid ${p.border}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: p.textPrimary }}>
              {section.title}
            </h3>
            {section.collapsible && (
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '0.75rem',
                  color: '#6366f1',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {collapsed ? 'Expand ▼' : 'Collapse ▲'}
              </button>
            )}
          </div>
          {section.description && (
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: p.textSecondary }}>
              {section.description}
            </p>
          )}
        </div>
      )}

      {(!section.collapsible || !collapsed) && (
        (() => {
          const gridCols =
            section.columns && section.columns > 1
              ? `repeat(${section.columns}, 1fr)`
              : undefined;

          // For sections with many fields, lazily mount off-screen fields via
          // IntersectionObserver to avoid mounting hundreds of DOM nodes upfront.
          const useVirtual = visibleFields.length > VIRTUALIZE_THRESHOLD;

          if (useVirtual) {
            return (
              <VirtualFieldList
                items={visibleFields}
                gap="1rem"
                gridTemplateColumns={gridCols}
                renderItem={(field) => (
                  <FieldRenderer
                    key={field.id}
                    field={field}
                    value={values[field.id]}
                    error={touched[field.id] ? errors[field.id] : undefined}
                    isValidating={!!validating[field.id]}
                    onChange={(value) => onFieldChange(field.id, value, field)}
                    onBlur={() => onFieldBlur(field.id, field)}
                  />
                )}
              />
            );
          }

          return (
            <div
              style={
                gridCols
                  ? { display: 'grid', gridTemplateColumns: gridCols, gap: '1rem' }
                  : { display: 'flex', flexDirection: 'column', gap: '1rem' }
              }
            >
              {visibleFields.map((field) => (
                <FieldRenderer
                  key={field.id}
                  field={field}
                  value={values[field.id]}
                  error={touched[field.id] ? errors[field.id] : undefined}
                  isValidating={!!validating[field.id]}
                  onChange={(value) => onFieldChange(field.id, value, field)}
                  onBlur={() => onFieldBlur(field.id, field)}
                />
              ))}
            </div>
          );
        })()
      )}
    </div>
  );
}

// ── Field renderer ───────────────────────────────────────────────────────────

interface FieldRendererProps {
  field: FormField;
  value: unknown;
  error?: string;
  isValidating?: boolean;
  onChange: (value: unknown) => void;
  onBlur: () => void;
}

// ── Rich text field ───────────────────────────────────────────────────────────

const RICH_TEXT_TOOLBAR_LABELS: Record<string, string> = {
  'bold': 'B',
  'italic': 'I',
  'underline': 'U',
  'link': '🔗',
  'ordered-list': '1.',
  'unordered-list': '•',
};

function RichTextField({
  field, value, onChange, onBlur, commonInputStyles, fieldId,
}: {
  field: Extract<FormField, { type: 'rich_text' }>;
  value: unknown;
  onChange: (value: unknown) => void;
  onBlur: () => void;
  commonInputStyles: React.CSSProperties;
  fieldId: string;
}) {
  const p = useFormPalette();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const text = typeof value === 'string' ? value : '';
  const charCount = text.length;

  const wrapSelection = (before: string, after: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = text.slice(start, end);
    const newText = text.slice(0, start) + before + selected + after + text.slice(end);
    onChange(newText);
    // Restore cursor/selection after React re-renders
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const insertAtLineStart = (prefix: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const newText = text.slice(0, lineStart) + prefix + text.slice(lineStart);
    onChange(newText);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  };

  const handleToolbar = (action: string) => {
    switch (action) {
      case 'bold': return wrapSelection('**', '**');
      case 'italic': return wrapSelection('_', '_');
      case 'underline': return wrapSelection('<u>', '</u>');
      case 'link': {
        const url = window.prompt('Enter URL:', 'https://');
        if (!url) return;
        const el = textareaRef.current;
        if (!el) return;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const selected = text.slice(start, end) || 'link text';
        const newText = text.slice(0, start) + `[${selected}](${url})` + text.slice(end);
        onChange(newText);
        return;
      }
      case 'ordered-list': return insertAtLineStart('1. ');
      case 'unordered-list': return insertAtLineStart('- ');
    }
  };

  const atMax = field.maxLength !== undefined && charCount > field.maxLength;

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: '0.25rem', flexWrap: 'wrap',
        padding: '0.25rem 0.375rem',
        border: `1px solid ${p.border}`,
        borderBottom: 'none',
        borderRadius: '0.375rem 0.375rem 0 0',
        backgroundColor: p.bgSubtle,
      }}>
        {field.toolbar.map((action) => (
          <button
            key={action}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handleToolbar(action); }}
            aria-label={`Format: ${action}`}
            title={action}
            style={{
              padding: '0.15rem 0.4rem',
              fontSize: '0.72rem',
              fontWeight: action === 'bold' ? 700 : action === 'italic' ? 400 : 600,
              fontStyle: action === 'italic' ? 'italic' : 'normal',
              border: `1px solid ${p.border}`,
              borderRadius: '0.25rem',
              backgroundColor: p.bg,
              color: p.textSecondary,
              cursor: 'pointer',
              lineHeight: 1.4,
              fontFamily: action === 'link' ? 'inherit' : 'monospace',
            }}
            disabled={field.disabled}
          >
            {RICH_TEXT_TOOLBAR_LABELS[action] ?? action}
          </button>
        ))}
      </div>
      {/* Textarea */}
      <textarea
        ref={textareaRef}
        id={fieldId}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={field.placeholder ?? 'Write here… supports **bold**, _italic_, [links](url)'}
        disabled={field.disabled}
        rows={field.rows}
        aria-label={`${field.label} — rich text input, supports Markdown formatting`}
        style={{
          ...commonInputStyles,
          borderRadius: '0 0 0.375rem 0.375rem',
          resize: 'vertical',
          fontFamily: 'monospace',
          fontSize: '0.82rem',
          lineHeight: 1.6,
          borderColor: atMax ? '#ef4444' : commonInputStyles.borderColor,
        }}
      />
      {/* Character count */}
      {(field.minLength !== undefined || field.maxLength !== undefined) && (
        <div style={{
          display: 'flex', justifyContent: 'flex-end',
          fontSize: '0.65rem',
          color: atMax ? '#ef4444' : p.textMuted,
          marginTop: '0.2rem',
        }}>
          {charCount}{field.maxLength !== undefined && ` / ${field.maxLength}`}
          {field.minLength !== undefined && charCount < field.minLength && (
            <span style={{ marginLeft: '0.5rem' }}>min {field.minLength}</span>
          )}
        </div>
      )}
    </div>
  );
}

function FieldRenderer({ field, value, error, isValidating, onChange, onBlur }: FieldRendererProps) {
  const p = useFormPalette();
  const fieldId = `field-${field.id}`;
  const hasError = !!error;

  const commonInputStyles: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    border: `1px solid ${hasError ? '#ef4444' : p.borderStrong}`,
    borderRadius: '0.375rem',
    backgroundColor: field.disabled ? p.bgDisabled : p.bg,
    color: field.disabled ? p.textDisabled : p.textPrimary,
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  // Hidden fields are not rendered
  if (field.type === 'hidden') return null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.375rem' }}>
        <label htmlFor={fieldId} style={{ display: 'inline' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: p.textLabel }}>
            {field.label}
          </span>
        </label>
        {field.required && (
          <span aria-hidden="true" style={{ color: '#ef4444', marginLeft: '0.25rem', fontSize: '0.875rem' }}>*</span>
        )}
        {field.sensitive && (
          <span style={{
            marginLeft: '0.5rem',
            fontSize: '0.65rem',
            color: '#f59e0b',
            fontWeight: 700,
            border: '1px solid #f59e0b',
            borderRadius: '0.25rem',
            padding: '0.1rem 0.3rem',
          }}>
            SENSITIVE
          </span>
        )}
      </div>

      {field.description && (
        <p style={{ margin: '0 0 0.375rem', fontSize: '0.75rem', color: p.textSecondary }}>
          {field.description}
        </p>
      )}

      {renderFieldInput(field, value, onChange, onBlur, fieldId, commonInputStyles)}

      {field.helpText && !hasError && !isValidating && (
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: p.textMuted }}>
          {field.helpText}
        </p>
      )}

      {isValidating && (
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: '#6366f1', fontWeight: 500 }}>
          Validating…
        </p>
      )}

      {hasError && !isValidating && (
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#ef4444', fontWeight: 500 }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ── File field with preview ───────────────────────────────────────────────────

function FileField({
  field, onChange, onBlur, commonInputStyles, fieldId,
}: {
  field: Extract<FormField, { type: 'file' }>;
  onChange: (value: unknown) => void;
  onBlur: () => void;
  commonInputStyles: React.CSSProperties;
  fieldId: string;
}) {
  const [previews, setPreviews] = useState<Array<{ name: string; url: string; isImage: boolean }>>([]);
  const [sizeError, setSizeError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;

    // Enforce maxSizeMB when provided
    if (files && field.maxSizeMB !== undefined) {
      const maxBytes = field.maxSizeMB * 1024 * 1024;
      const oversized = Array.from(files).filter((f) => f.size > maxBytes);
      if (oversized.length > 0) {
        const names = oversized.map((f) => f.name).join(', ');
        setSizeError(
          `${oversized.length === 1 ? 'File' : 'Files'} exceeds the ${field.maxSizeMB} MB limit: ${names}`,
        );
        e.target.value = '';
        return;
      }
    }
    setSizeError(null);
    onChange(files);

    if (field.showPreview && files) {
      const list = Array.from(files).map((f) => ({
        name: f.name,
        url: URL.createObjectURL(f),
        isImage: f.type.startsWith('image/'),
      }));
      // Revoke old object URLs
      setPreviews((old) => {
        old.forEach((p) => URL.revokeObjectURL(p.url));
        return list;
      });
    }
  };

  return (
    <div>
      <input
        id={fieldId}
        type="file"
        onChange={handleChange}
        onBlur={onBlur}
        disabled={field.disabled}
        accept={field.accept?.join(',')}
        multiple={field.multiple}
        style={{ ...commonInputStyles, padding: '0.375rem 0.5rem', fontSize: '0.8rem' }}
      />
      {field.showPreview && previews.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
          {previews.map((p, i) => (
            <div key={i} style={{
              border: '1px solid #e2e8f0', borderRadius: '0.375rem',
              overflow: 'hidden', fontSize: '0.7rem', color: '#64748b',
              maxWidth: '120px',
            }}>
              {p.isImage ? (
                <img
                  src={p.url}
                  alt={p.name}
                  style={{ width: '120px', height: '80px', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div style={{
                  width: '120px', height: '80px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: '#f8fafc', fontSize: '1.5rem',
                }}>
                  📄
                </div>
              )}
              <div style={{ padding: '0.25rem 0.375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
              </div>
            </div>
          ))}
        </div>
      )}
      {sizeError && (
        <div
          role="alert"
          style={{
            marginTop: '0.4rem',
            fontSize: '0.72rem',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.3rem',
          }}
        >
          ⚠ {sizeError}
        </div>
      )}
    </div>
  );
}

// ── Color field ───────────────────────────────────────────────────────────────

function ColorField({
  field, value, onChange, onBlur, fieldId,
}: {
  field: Extract<FormField, { type: 'color' }>;
  value: unknown;
  onChange: (value: unknown) => void;
  onBlur: () => void;
  fieldId: string;
}) {
  const hex = typeof value === 'string' ? value : '#6366f1';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
      <input
        id={fieldId}
        type="color"
        value={hex}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={field.disabled}
        style={{
          width: '2.5rem', height: '2.5rem',
          border: '1px solid #cbd5e1', borderRadius: '0.375rem',
          padding: '0.125rem', cursor: field.disabled ? 'not-allowed' : 'pointer',
        }}
      />
      <span style={{ fontSize: '0.8rem', color: '#475569', fontFamily: 'monospace' }}>{hex}</span>
      {field.swatches && field.swatches.length > 0 && (
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          {field.swatches.map((swatch) => (
            <button
              key={swatch}
              type="button"
              onClick={() => onChange(swatch)}
              title={swatch}
              style={{
                width: '1.25rem', height: '1.25rem',
                backgroundColor: swatch,
                border: hex === swatch ? '2px solid #1e293b' : '2px solid transparent',
                borderRadius: '0.25rem',
                cursor: 'pointer',
                padding: 0,
                outline: hex === swatch ? '2px solid #4f46e5' : 'none',
                outlineOffset: '1px',
              }}
              aria-label={`Select colour ${swatch}`}
              aria-pressed={hex === swatch}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Date range field ──────────────────────────────────────────────────────────

function DateRangeField({
  field, value, onChange, onBlur, commonInputStyles, fieldId,
}: {
  field: Extract<FormField, { type: 'date_range' }>;
  value: unknown;
  onChange: (value: unknown) => void;
  onBlur: () => void;
  commonInputStyles: React.CSSProperties;
  fieldId: string;
}) {
  const range = (value && typeof value === 'object' && !Array.isArray(value))
    ? (value as DateRangeValue)
    : { start: '', end: '' };

  const handleStart = (start: string) => onChange({ ...range, start });
  const handleEnd = (end: string) => onChange({ ...range, end });

  const endBeforeStart = !!(range.start && range.end && range.end < range.start);

  return (
    <div>
    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 140px' }}>
        <label
          htmlFor={`${fieldId}-start`}
          style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem' }}
        >
          {field.startLabel}
        </label>
        <input
          id={`${fieldId}-start`}
          type="date"
          value={range.start}
          onChange={(e) => handleStart(e.target.value)}
          onBlur={onBlur}
          disabled={field.disabled}
          min={field.minDate}
          max={range.end || field.maxDate}
          style={commonInputStyles}
        />
      </div>
      <div style={{ flex: '1 1 140px' }}>
        <label
          htmlFor={`${fieldId}-end`}
          style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem' }}
        >
          {field.endLabel}
        </label>
        <input
          id={`${fieldId}-end`}
          type="date"
          value={range.end}
          onChange={(e) => handleEnd(e.target.value)}
          onBlur={onBlur}
          disabled={field.disabled}
          min={range.start || field.minDate}
          max={field.maxDate}
          style={commonInputStyles}
        />
      </div>
    </div>
    {endBeforeStart && (
      <div
        role="alert"
        style={{
          marginTop: '0.35rem',
          fontSize: '0.72rem',
          color: '#dc2626',
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
        }}
      >
        ⚠ End date must be on or after the start date
      </div>
    )}
    </div>
  );
}

// ── Autocomplete field ────────────────────────────────────────────────────────

function AutocompleteField({
  field, value, onChange, onBlur, commonInputStyles, fieldId,
}: {
  field: Extract<FormField, { type: 'autocomplete' }>;
  value: unknown;
  onChange: (value: unknown) => void;
  onBlur: () => void;
  commonInputStyles: React.CSSProperties;
  fieldId: string;
}) {
  const [inputText, setInputText] = useState(typeof value === 'string' ? value : '');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions =
    inputText.length >= field.minChars
      ? field.options
          .filter(
            (opt) =>
              opt.label.toLowerCase().includes(inputText.toLowerCase()) ||
              String(opt.value).toLowerCase().includes(inputText.toLowerCase()),
          )
          .slice(0, field.maxSuggestions)
      : [];

  const selectOption = (optValue: string, optLabel: string) => {
    setInputText(optLabel);
    onChange(optValue);
    setOpen(false);
    setActiveIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      const opt = suggestions[activeIdx];
      selectOption(String(opt.value), opt.label);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Close dropdown when focus leaves the container
  const handleBlur = () => {
    // Small delay so click on option registers first
    setTimeout(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        setOpen(false);
        onBlur();
      }
    }, 150);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        id={fieldId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={`${fieldId}-listbox`}
        aria-activedescendant={activeIdx >= 0 ? `${fieldId}-opt-${activeIdx}` : undefined}
        value={inputText}
        onChange={(e) => {
          const text = e.target.value;
          setInputText(text);
          setOpen(true);
          setActiveIdx(-1);
          if (field.allowCustomValue) onChange(text);
          else onChange('');
        }}
        onFocus={() => { if (inputText.length >= field.minChars) setOpen(true); }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={field.placeholder}
        disabled={field.disabled}
        style={commonInputStyles}
      />
      {open && suggestions.length > 0 && (
        <ul
          id={`${fieldId}-listbox`}
          role="listbox"
          aria-label={field.label}
          style={{
            position: 'absolute',
            top: '100%', left: 0, right: 0,
            margin: '0.125rem 0 0',
            padding: '0.25rem 0',
            listStyle: 'none',
            backgroundColor: 'white',
            border: '1px solid #cbd5e1',
            borderRadius: '0.375rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            zIndex: 50,
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          {suggestions.map((opt, i) => (
            <li
              key={String(opt.value)}
              id={`${fieldId}-opt-${i}`}
              role="option"
              aria-selected={i === activeIdx}
              onMouseDown={(e) => { e.preventDefault(); selectOption(String(opt.value), opt.label); }}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                padding: '0.45rem 0.75rem',
                fontSize: '0.85rem',
                cursor: 'pointer',
                backgroundColor: i === activeIdx ? '#eff6ff' : 'transparent',
                color: '#1e293b',
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function renderFieldInput(
  field: FormField,
  value: unknown,
  onChange: (value: unknown) => void,
  onBlur: () => void,
  fieldId: string,
  commonInputStyles: React.CSSProperties,
): React.ReactNode {
  switch (field.type) {
    case 'text':
      if (field.multiline) {
        return (
          <textarea
            id={fieldId}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={field.placeholder}
            disabled={field.disabled}
            rows={field.rows ?? 4}
            maxLength={field.maxLength}
            style={{ ...commonInputStyles, resize: 'vertical' }}
          />
        );
      }
      return (
        <input
          id={fieldId}
          type={field.sensitive ? 'password' : 'text'}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={field.placeholder}
          disabled={field.disabled}
          maxLength={field.maxLength}
          autoComplete={field.autocomplete}
          style={commonInputStyles}
        />
      );

    case 'number':
      return (
        <div style={{ position: 'relative' }}>
          <input
            id={fieldId}
            type="number"
            value={value !== undefined ? Number(value) : ''}
            onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
            onBlur={onBlur}
            placeholder={field.placeholder}
            disabled={field.disabled}
            min={field.min}
            max={field.max}
            step={field.step}
            style={commonInputStyles}
          />
          {field.unit && (
            <span style={{
              position: 'absolute',
              right: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '0.75rem',
              color: '#64748b',
            }}>
              {field.unit}
            </span>
          )}
        </div>
      );

    case 'datetime':
      return (
        <input
          id={fieldId}
          type={field.mode === 'time' ? 'time' : field.mode === 'datetime' ? 'datetime-local' : 'date'}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={field.disabled}
          min={field.minDate}
          max={field.maxDate}
          style={commonInputStyles}
        />
      );

    case 'select':
      if (field.multiple) {
        return (
          <select
            id={fieldId}
            multiple
            value={Array.isArray(value) ? value : []}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
              onChange(selected);
            }}
            onBlur={onBlur}
            disabled={field.disabled}
            style={{ ...commonInputStyles, height: 'auto', minHeight: '120px' }}
          >
            {field.options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      }
      return (
        <select
          id={fieldId}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={field.disabled}
          style={commonInputStyles}
        >
          <option value="">{field.placeholder ?? 'Select an option...'}</option>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
      );

    case 'checkbox':
      return (
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            id={fieldId}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            onBlur={onBlur}
            disabled={field.disabled}
            style={{ width: '1rem', height: '1rem', accentColor: '#4f46e5' }}
          />
          <span style={{ fontSize: '0.875rem', color: '#334155' }}>{field.label}</span>
        </label>
      );

    case 'radio':
      return (
        <div style={{
          display: 'flex',
          flexDirection: field.layout === 'horizontal' ? 'row' : 'column',
          gap: '0.5rem',
        }}>
          {field.options.map((opt) => (
            <label
              key={opt.value}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
            >
              <input
                type="radio"
                name={fieldId}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                onBlur={onBlur}
                disabled={field.disabled || opt.disabled}
                style={{ width: '1rem', height: '1rem', accentColor: '#4f46e5' }}
              />
              <span style={{ fontSize: '0.875rem', color: '#334155' }}>{opt.label}</span>
            </label>
          ))}
        </div>
      );

    case 'file':
      return <FileField field={field} onChange={onChange} onBlur={onBlur} commonInputStyles={commonInputStyles} fieldId={fieldId} />;

    case 'color':
      return <ColorField field={field} value={value} onChange={onChange} onBlur={onBlur} fieldId={fieldId} />;

    case 'date_range':
      return <DateRangeField field={field} value={value} onChange={onChange} onBlur={onBlur} commonInputStyles={commonInputStyles} fieldId={fieldId} />;

    case 'autocomplete':
      return <AutocompleteField field={field} value={value} onChange={onChange} onBlur={onBlur} commonInputStyles={commonInputStyles} fieldId={fieldId} />;

    case 'voice': {
      // The voice field renders a mic button; the captured transcript is stored
      // as a plain string value just like a text field.
      const currentText = typeof value === 'string' ? value : '';
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {/* Mic button — updates the field value when speech is captured */}
          <VoiceMicButton
            language={field.language}
            continuous={field.continuous}
            interimResults={field.interimResults}
            appendMode={field.appendMode}
            maxDurationSeconds={field.maxDurationSeconds}
            onTranscript={(transcript) => onChange(transcript)}
            prompt={field.prompt}
            disabled={field.disabled}
          />
          {/* Plain textarea so the user can also type / correct the transcript */}
          <textarea
            id={fieldId}
            value={currentText}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={field.placeholder ?? 'Speak or type here…'}
            disabled={field.disabled}
            rows={3}
            aria-label={`${field.label} — voice or text input`}
            style={{
              ...commonInputStyles,
              resize: 'vertical',
              fontStyle: currentText ? 'normal' : 'italic',
            }}
          />
          {currentText && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => onChange('')}
                style={{
                  fontSize: '0.65rem',
                  color: '#94a3b8',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  padding: '0.1rem 0.25rem',
                }}
                aria-label="Clear transcript"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      );
    }

    case 'slider':
      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            {field.minLabel && (
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{field.minLabel}</span>
            )}
            {field.showValue && (
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                {value !== undefined ? Number(value) : field.min}
              </span>
            )}
            {field.maxLabel && (
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{field.maxLabel}</span>
            )}
          </div>
          <input
            id={fieldId}
            type="range"
            min={field.min}
            max={field.max}
            step={field.step}
            value={value !== undefined ? Number(value) : field.min}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            onBlur={onBlur}
            disabled={field.disabled}
            style={{ width: '100%', accentColor: '#4f46e5' }}
          />
        </div>
      );

    case 'rich_text':
      return (
        <RichTextField
          field={field}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          commonInputStyles={commonInputStyles}
          fieldId={fieldId}
        />
      );

    default:
      return <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>Unknown field type</div>;
  }
}
