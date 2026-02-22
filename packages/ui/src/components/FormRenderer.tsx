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

import React, { useState, useCallback, useEffect } from 'react';
import type { FormField, FormSection, ValidationRule } from '@hari/core';

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

  for (const rule of field.validation) {
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
}: FormRendererProps) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

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

  const handleFieldChange = useCallback(
    (fieldId: string, value: unknown, field: FormField) => {
      const newValues = { ...values, [fieldId]: value };
      setValues(newValues);
      onChange?.(newValues);

      // Validate on change if field was touched
      if (touched[fieldId]) {
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
      const error = validateField(values[fieldId], field);
      setErrors((prev) => ({
        ...prev,
        [fieldId]: error || '',
      }));
    },
    [values]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      // Validate all fields
      const newErrors: Record<string, string> = {};
      sections.forEach((section) => {
        section.fields.forEach((field) => {
          const error = validateField(values[field.id], field);
          if (error) newErrors[field.id] = error;
        });
      });

      setErrors(newErrors);

      if (Object.keys(newErrors).length === 0) {
        onSubmit?.(values);
      }
    },
    [sections, values, onSubmit]
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

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      {sections.map((section) => (
        <FormSectionRenderer
          key={section.id}
          section={section}
          values={values}
          errors={errors}
          touched={touched}
          onFieldChange={handleFieldChange}
          onFieldBlur={handleFieldBlur}
          isFieldVisible={isFieldVisible}
        />
      ))}

      {showSubmitButton && (
        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '0.625rem 1.5rem',
              backgroundColor: isSubmitting ? '#94a3b8' : '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
            }}
          >
            {isSubmitting ? 'Submitting...' : submitButtonLabel}
          </button>
        </div>
      )}
    </form>
  );
}

// ── Section renderer ──────────────────────────────────────────────────────────

interface FormSectionRendererProps {
  section: FormSection;
  values: Record<string, unknown>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  onFieldChange: (fieldId: string, value: unknown, field: FormField) => void;
  onFieldBlur: (fieldId: string, field: FormField) => void;
  isFieldVisible: (field: FormField) => boolean;
}

function FormSectionRenderer({
  section,
  values,
  errors,
  touched,
  onFieldChange,
  onFieldBlur,
  isFieldVisible,
}: FormSectionRendererProps) {
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
            borderBottom: '2px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
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
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
              {section.description}
            </p>
          )}
        </div>
      )}

      {(!section.collapsible || !collapsed) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {visibleFields.map((field) => (
            <FieldRenderer
              key={field.id}
              field={field}
              value={values[field.id]}
              error={touched[field.id] ? errors[field.id] : undefined}
              onChange={(value) => onFieldChange(field.id, value, field)}
              onBlur={() => onFieldBlur(field.id, field)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Field renderer ───────────────────────────────────────────────────────────

interface FieldRendererProps {
  field: FormField;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
  onBlur: () => void;
}

function FieldRenderer({ field, value, error, onChange, onBlur }: FieldRendererProps) {
  const fieldId = `field-${field.id}`;
  const hasError = !!error;

  const commonInputStyles: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    border: `1px solid ${hasError ? '#ef4444' : '#cbd5e1'}`,
    borderRadius: '0.375rem',
    backgroundColor: field.disabled ? '#f1f5f9' : 'white',
    color: '#1e293b',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  // Hidden fields are not rendered
  if (field.type === 'hidden') return null;

  return (
    <div>
      <label htmlFor={fieldId} style={{ display: 'block', marginBottom: '0.375rem' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
          {field.label}
          {field.required && <span style={{ color: '#ef4444', marginLeft: '0.25rem' }}>*</span>}
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
        </span>
      </label>

      {field.description && (
        <p style={{ margin: '0 0 0.375rem', fontSize: '0.75rem', color: '#64748b' }}>
          {field.description}
        </p>
      )}

      {renderFieldInput(field, value, onChange, onBlur, fieldId, commonInputStyles)}

      {field.helpText && !hasError && (
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: '#94a3b8' }}>
          {field.helpText}
        </p>
      )}

      {hasError && (
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#ef4444', fontWeight: 500 }}>
          {error}
        </p>
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
      return (
        <input
          id={fieldId}
          type="file"
          onChange={(e) => onChange(e.target.files)}
          onBlur={onBlur}
          disabled={field.disabled}
          accept={field.accept?.join(',')}
          multiple={field.multiple}
          style={{
            ...commonInputStyles,
            padding: '0.375rem 0.5rem',
            fontSize: '0.8rem',
          }}
        />
      );

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

    default:
      return <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>Unknown field type</div>;
  }
}
