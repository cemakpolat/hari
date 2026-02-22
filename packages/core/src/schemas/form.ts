import { z } from 'zod';
import { SelectOptionSchema } from './ambiguity';

// ─────────────────────────────────────────────────────────────────────────────
// Form Field Schemas
//
// When the agent needs structured input from the user, it emits FormField
// primitives. Unlike ambiguity controls (which refine agent interpretation),
// form fields collect *new information* the agent doesn't yet have.
//
// Examples:
//   - "I need your travel dates to search flights"
//   - "Configure these deployment parameters"
//   - "Provide authentication credentials"
//
// Form fields support validation, conditional visibility, help text, and
// the same safety/trust primitives as actions (e.g. sensitive data warnings).
// ─────────────────────────────────────────────────────────────────────────────

export const ValidationRuleSchema = z.object({
  type: z.enum(['required', 'email', 'url', 'min', 'max', 'pattern', 'custom']),
  message: z.string(),
  /** For min/max rules */
  value: z.union([z.number(), z.string()]).optional(),
  /** For pattern rules (regex string) */
  pattern: z.string().optional(),
});

export type ValidationRule = z.infer<typeof ValidationRuleSchema>;

export const BaseFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  /** Help text shown below the field */
  helpText: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().default(false),
  disabled: z.boolean().default(false),
  /** Validation rules */
  validation: z.array(ValidationRuleSchema).default([]),
  /** Default value */
  defaultValue: z.unknown().optional(),
  /** Whether this field contains sensitive data (passwords, API keys, etc.) */
  sensitive: z.boolean().default(false),
  /**
   * Conditional visibility rule.
   * Example: { dependsOn: 'deployment_type', value: 'production' }
   */
  conditionalVisibility: z
    .object({
      dependsOn: z.string(),
      value: z.unknown(),
    })
    .optional(),
});

// ─── Text Input ───────────────────────────────────────────────────────────────

export const TextInputFieldSchema = BaseFieldSchema.extend({
  type: z.literal('text'),
  multiline: z.boolean().default(false),
  rows: z.number().optional(),
  maxLength: z.number().optional(),
  autocomplete: z.string().optional(),
});

export type TextInputField = z.infer<typeof TextInputFieldSchema>;

// ─── Number Input ─────────────────────────────────────────────────────────────

export const NumberInputFieldSchema = BaseFieldSchema.extend({
  type: z.literal('number'),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  unit: z.string().optional(), // e.g., "ms", "$", "GB"
});

export type NumberInputField = z.infer<typeof NumberInputFieldSchema>;

// ─── Date/Time Input ──────────────────────────────────────────────────────────

export const DateTimeInputFieldSchema = BaseFieldSchema.extend({
  type: z.literal('datetime'),
  mode: z.enum(['date', 'time', 'datetime']).default('date'),
  minDate: z.string().optional(), // ISO 8601
  maxDate: z.string().optional(), // ISO 8601
});

export type DateTimeInputField = z.infer<typeof DateTimeInputFieldSchema>;

// ─── Select (Dropdown) ────────────────────────────────────────────────────────
// Note: Reusing SelectOptionSchema from ambiguity.ts for consistency

const FormSelectOptionSchema = SelectOptionSchema.extend({
  disabled: z.boolean().optional(),
});

export type FormSelectOption = z.infer<typeof FormSelectOptionSchema>;

export const SelectFieldSchema = BaseFieldSchema.extend({
  type: z.literal('select'),
  options: z.array(FormSelectOptionSchema),
  multiple: z.boolean().default(false),
  searchable: z.boolean().default(false),
});

export type SelectField = z.infer<typeof SelectFieldSchema>;

// ─── Checkbox ─────────────────────────────────────────────────────────────────

export const CheckboxFieldSchema = BaseFieldSchema.extend({
  type: z.literal('checkbox'),
  defaultValue: z.boolean().optional(),
});

export type CheckboxField = z.infer<typeof CheckboxFieldSchema>;

// ─── Radio Group ──────────────────────────────────────────────────────────────

export const RadioFieldSchema = BaseFieldSchema.extend({
  type: z.literal('radio'),
  options: z.array(FormSelectOptionSchema),
  layout: z.enum(['vertical', 'horizontal']).default('vertical'),
});

export type RadioField = z.infer<typeof RadioFieldSchema>;

// ─── File Upload ──────────────────────────────────────────────────────────────

export const FileUploadFieldSchema = BaseFieldSchema.extend({
  type: z.literal('file'),
  accept: z.array(z.string()).optional(), // MIME types: ['image/*', '.pdf']
  multiple: z.boolean().default(false),
  maxSizeMB: z.number().optional(),
  /** Whether uploaded file should be displayed as preview */
  showPreview: z.boolean().default(true),
});

export type FileUploadField = z.infer<typeof FileUploadFieldSchema>;

// ─── Slider ───────────────────────────────────────────────────────────────────

export const SliderFieldSchema = BaseFieldSchema.extend({
  type: z.literal('slider'),
  min: z.number().default(0),
  max: z.number().default(100),
  step: z.number().default(1),
  showValue: z.boolean().default(true),
  minLabel: z.string().optional(),
  maxLabel: z.string().optional(),
});

export type SliderField = z.infer<typeof SliderFieldSchema>;

// ─── Hidden Field ─────────────────────────────────────────────────────────────

export const HiddenFieldSchema = BaseFieldSchema.extend({
  type: z.literal('hidden'),
  /** Hidden fields always have a value */
  defaultValue: z.unknown(),
});

export type HiddenField = z.infer<typeof HiddenFieldSchema>;

// ─── Discriminated Union ──────────────────────────────────────────────────────

export const FormFieldSchema = z.discriminatedUnion('type', [
  TextInputFieldSchema,
  NumberInputFieldSchema,
  DateTimeInputFieldSchema,
  SelectFieldSchema,
  CheckboxFieldSchema,
  RadioFieldSchema,
  FileUploadFieldSchema,
  SliderFieldSchema,
  HiddenFieldSchema,
]);

export type FormField = z.infer<typeof FormFieldSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Form Section — grouping and organization
// ─────────────────────────────────────────────────────────────────────────────

export const FormSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  fields: z.array(FormFieldSchema),
  /** Whether this section is collapsible */
  collapsible: z.boolean().default(false),
  /** Default collapsed state (only if collapsible) */
  defaultCollapsed: z.boolean().default(false),
});

export type FormSection = z.infer<typeof FormSectionSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Form Submission
//
// When user submits a form, this payload is sent to the agent.
// ─────────────────────────────────────────────────────────────────────────────

export const FormSubmissionSchema = z.object({
  event: z.literal('form_submission'),
  formId: z.string(),
  intentId: z.string().uuid(),
  values: z.record(z.string(), z.unknown()),
  timestamp: z.number(),
});

export type FormSubmission = z.infer<typeof FormSubmissionSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Form Validation Response
//
// Agent can respond with validation errors after submission.
// ─────────────────────────────────────────────────────────────────────────────

export const FieldErrorSchema = z.object({
  fieldId: z.string(),
  message: z.string(),
});

export type FieldError = z.infer<typeof FieldErrorSchema>;

export const FormValidationResponseSchema = z.object({
  event: z.literal('form_validation_response'),
  formId: z.string(),
  valid: z.boolean(),
  errors: z.array(FieldErrorSchema).default([]),
  /** Global form-level error message */
  globalError: z.string().optional(),
});

export type FormValidationResponse = z.infer<typeof FormValidationResponseSchema>;
