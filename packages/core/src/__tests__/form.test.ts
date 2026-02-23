import { describe, it, expect } from 'vitest';
import {
  ValidationRuleSchema,
  BaseFieldSchema,
  TextInputFieldSchema,
  NumberInputFieldSchema,
  DateTimeInputFieldSchema,
  SelectFieldSchema,
  CheckboxFieldSchema,
  RadioFieldSchema,
  FileUploadFieldSchema,
  SliderFieldSchema,
  HiddenFieldSchema,
  FormFieldSchema,
  FormSectionSchema,
  FormSubmissionSchema,
  FormValidationResponseSchema,
} from '../schemas/form';

// ── ValidationRuleSchema ──────────────────────────────────────────────────────

describe('ValidationRuleSchema', () => {
  it('parses a required rule', () => {
    const rule = ValidationRuleSchema.parse({ type: 'required', message: 'This field is required.' });
    expect(rule.type).toBe('required');
  });

  it('parses an email rule', () => {
    const rule = ValidationRuleSchema.parse({ type: 'email', message: 'Invalid email address.' });
    expect(rule.type).toBe('email');
  });

  it('parses a url rule', () => {
    const rule = ValidationRuleSchema.parse({ type: 'url', message: 'Must be a valid URL.' });
    expect(rule.type).toBe('url');
  });

  it('parses a min rule with numeric value', () => {
    const rule = ValidationRuleSchema.parse({ type: 'min', message: 'Too short.', value: 3 });
    expect(rule.value).toBe(3);
  });

  it('parses a max rule with string value', () => {
    const rule = ValidationRuleSchema.parse({ type: 'max', message: 'Too long.', value: '100' });
    expect(rule.value).toBe('100');
  });

  it('parses a pattern rule', () => {
    const rule = ValidationRuleSchema.parse({
      type: 'pattern',
      message: 'Must match pattern.',
      pattern: '^[a-z]+$',
    });
    expect(rule.pattern).toBe('^[a-z]+$');
  });

  it('parses a custom rule', () => {
    const rule = ValidationRuleSchema.parse({ type: 'custom', message: 'Custom validation failed.' });
    expect(rule.type).toBe('custom');
  });

  it('rejects an unknown rule type', () => {
    expect(() =>
      ValidationRuleSchema.parse({ type: 'regex', message: 'Bad.' }),
    ).toThrow();
  });
});

// ── BaseFieldSchema ───────────────────────────────────────────────────────────

describe('BaseFieldSchema', () => {
  const MIN = { id: 'f1', label: 'My Field', type: 'text' };

  it('applies defaults for required, disabled, sensitive, and validation', () => {
    const result = BaseFieldSchema.parse(MIN);
    expect(result.required).toBe(false);
    expect(result.disabled).toBe(false);
    expect(result.sensitive).toBe(false);
    expect(result.validation).toEqual([]);
  });

  it('accepts optional fields', () => {
    const result = BaseFieldSchema.parse({
      ...MIN,
      description: 'A description',
      helpText: 'Some help text',
      placeholder: 'Enter value…',
      required: true,
      sensitive: true,
    });
    expect(result.description).toBe('A description');
    expect(result.helpText).toBe('Some help text');
    expect(result.placeholder).toBe('Enter value…');
    expect(result.required).toBe(true);
    expect(result.sensitive).toBe(true);
  });

  it('parses conditionalVisibility when provided', () => {
    const result = BaseFieldSchema.parse({
      ...MIN,
      conditionalVisibility: { dependsOn: 'enable_https', value: true },
    });
    expect(result.conditionalVisibility?.dependsOn).toBe('enable_https');
    expect(result.conditionalVisibility?.value).toBe(true);
  });
});

// ── Text input ────────────────────────────────────────────────────────────────

describe('TextInputFieldSchema', () => {
  const BASE = { id: 'name', label: 'Name', type: 'text' as const };

  it('parses a minimal text field', () => {
    const result = TextInputFieldSchema.parse(BASE);
    expect(result.type).toBe('text');
    expect(result.multiline).toBe(false);
  });

  it('parses a multiline text field', () => {
    const result = TextInputFieldSchema.parse({ ...BASE, multiline: true, rows: 5 });
    expect(result.multiline).toBe(true);
    expect(result.rows).toBe(5);
  });

  it('parses maxLength and autocomplete', () => {
    const result = TextInputFieldSchema.parse({ ...BASE, maxLength: 255, autocomplete: 'email' });
    expect(result.maxLength).toBe(255);
    expect(result.autocomplete).toBe('email');
  });

  it('parses a sensitive password-style field', () => {
    const result = TextInputFieldSchema.parse({ ...BASE, id: 'pwd', label: 'Password', sensitive: true });
    expect(result.sensitive).toBe(true);
  });
});

// ── Number input ──────────────────────────────────────────────────────────────

describe('NumberInputFieldSchema', () => {
  const BASE = { id: 'replicas', label: 'Replicas', type: 'number' as const };

  it('parses a minimal number field', () => {
    const result = NumberInputFieldSchema.parse(BASE);
    expect(result.type).toBe('number');
  });

  it('parses min, max, step and unit', () => {
    const result = NumberInputFieldSchema.parse({ ...BASE, min: 1, max: 10, step: 1, unit: 'pods' });
    expect(result.min).toBe(1);
    expect(result.max).toBe(10);
    expect(result.step).toBe(1);
    expect(result.unit).toBe('pods');
  });
});

// ── DateTime input ────────────────────────────────────────────────────────────

describe('DateTimeInputFieldSchema', () => {
  const BASE = { id: 'deploy_at', label: 'Deploy at', type: 'datetime' as const };

  it('defaults mode to date', () => {
    const result = DateTimeInputFieldSchema.parse(BASE);
    expect(result.mode).toBe('date');
  });

  it.each(['date', 'time', 'datetime'] as const)('accepts mode=%s', (mode) => {
    const result = DateTimeInputFieldSchema.parse({ ...BASE, mode });
    expect(result.mode).toBe(mode);
  });

  it('rejects unknown mode', () => {
    expect(() => DateTimeInputFieldSchema.parse({ ...BASE, mode: 'month' })).toThrow();
  });

  it('parses minDate and maxDate', () => {
    const result = DateTimeInputFieldSchema.parse({
      ...BASE,
      minDate: '2026-01-01',
      maxDate: '2026-12-31',
    });
    expect(result.minDate).toBe('2026-01-01');
    expect(result.maxDate).toBe('2026-12-31');
  });
});

// ── Select field ──────────────────────────────────────────────────────────────

describe('SelectFieldSchema', () => {
  const OPTIONS = [
    { value: 'us-east-1', label: 'US East' },
    { value: 'eu-west-1', label: 'EU West' },
  ];
  const BASE = { id: 'region', label: 'Region', type: 'select' as const, options: OPTIONS };

  it('parses a single-select field', () => {
    const result = SelectFieldSchema.parse(BASE);
    expect(result.type).toBe('select');
    expect(result.options).toHaveLength(2);
    expect(result.multiple).toBe(false);
    expect(result.searchable).toBe(false);
  });

  it('parses a multi-select searchable field', () => {
    const result = SelectFieldSchema.parse({ ...BASE, multiple: true, searchable: true });
    expect(result.multiple).toBe(true);
    expect(result.searchable).toBe(true);
  });

  it('accepts disabled option flag', () => {
    const result = SelectFieldSchema.parse({
      ...BASE,
      options: [{ value: 'x', label: 'X', disabled: true }],
    });
    expect(result.options[0].disabled).toBe(true);
  });
});

// ── Checkbox field ────────────────────────────────────────────────────────────

describe('CheckboxFieldSchema', () => {
  it('parses a checkbox field', () => {
    const result = CheckboxFieldSchema.parse({ id: 'agree', label: 'I agree', type: 'checkbox' });
    expect(result.type).toBe('checkbox');
    expect(result.required).toBe(false);
  });

  it('parses defaultValue as boolean', () => {
    const result = CheckboxFieldSchema.parse({
      id: 'https', label: 'Enable HTTPS', type: 'checkbox', defaultValue: true,
    });
    expect(result.defaultValue).toBe(true);
  });
});

// ── Radio field ───────────────────────────────────────────────────────────────

describe('RadioFieldSchema', () => {
  const OPTIONS = [{ value: 'small', label: 'Small' }, { value: 'large', label: 'Large' }];

  it('parses a radio field with default vertical layout', () => {
    const result = RadioFieldSchema.parse({ id: 'size', label: 'Size', type: 'radio', options: OPTIONS });
    expect(result.type).toBe('radio');
    expect(result.layout).toBe('vertical');
  });

  it('parses horizontal layout', () => {
    const result = RadioFieldSchema.parse({
      id: 'env', label: 'Environment', type: 'radio', options: OPTIONS, layout: 'horizontal',
    });
    expect(result.layout).toBe('horizontal');
  });

  it('rejects unknown layout', () => {
    expect(() =>
      RadioFieldSchema.parse({ id: 'x', label: 'X', type: 'radio', options: OPTIONS, layout: 'grid' }),
    ).toThrow();
  });
});

// ── File upload field ─────────────────────────────────────────────────────────

describe('FileUploadFieldSchema', () => {
  it('parses a file field with defaults', () => {
    const result = FileUploadFieldSchema.parse({ id: 'cert', label: 'Certificate', type: 'file' });
    expect(result.type).toBe('file');
    expect(result.multiple).toBe(false);
    expect(result.showPreview).toBe(true);
  });

  it('parses accept types, multiple, and maxSizeMB', () => {
    const result = FileUploadFieldSchema.parse({
      id: 'img',
      label: 'Image',
      type: 'file',
      accept: ['image/*', '.png'],
      multiple: true,
      maxSizeMB: 10,
    });
    expect(result.accept).toEqual(['image/*', '.png']);
    expect(result.multiple).toBe(true);
    expect(result.maxSizeMB).toBe(10);
  });
});

// ── Slider field ──────────────────────────────────────────────────────────────

describe('SliderFieldSchema', () => {
  it('applies defaults for min, max, step, and showValue', () => {
    const result = SliderFieldSchema.parse({ id: 'vol', label: 'Volume', type: 'slider' });
    expect(result.min).toBe(0);
    expect(result.max).toBe(100);
    expect(result.step).toBe(1);
    expect(result.showValue).toBe(true);
  });

  it('parses custom range with labels', () => {
    const result = SliderFieldSchema.parse({
      id: 'weight',
      label: 'Price weight',
      type: 'slider',
      min: 0,
      max: 1,
      step: 0.1,
      minLabel: 'Speed',
      maxLabel: 'Price',
    });
    expect(result.min).toBe(0);
    expect(result.max).toBe(1);
    expect(result.step).toBe(0.1);
    expect(result.minLabel).toBe('Speed');
    expect(result.maxLabel).toBe('Price');
  });
});

// ── Hidden field ──────────────────────────────────────────────────────────────

describe('HiddenFieldSchema', () => {
  it('parses a hidden field with a string default', () => {
    const result = HiddenFieldSchema.parse({
      id: 'tenant_id', label: 'Tenant', type: 'hidden', defaultValue: 'acme-corp',
    });
    expect(result.type).toBe('hidden');
    expect(result.defaultValue).toBe('acme-corp');
  });

  it('parses a hidden field with an object default', () => {
    const result = HiddenFieldSchema.parse({
      id: 'meta', label: 'Meta', type: 'hidden', defaultValue: { env: 'prod' },
    });
    expect(result.defaultValue).toEqual({ env: 'prod' });
  });
});

// ── FormFieldSchema (discriminated union) ─────────────────────────────────────

describe('FormFieldSchema', () => {
  it('routes text type to TextInputField', () => {
    const result = FormFieldSchema.parse({ id: 'x', label: 'X', type: 'text' });
    expect(result.type).toBe('text');
  });

  it('routes number type to NumberInputField', () => {
    const result = FormFieldSchema.parse({ id: 'n', label: 'N', type: 'number' });
    expect(result.type).toBe('number');
  });

  it('routes all 9 field types without throwing', () => {
    const fixtures: unknown[] = [
      { id: 'a', label: 'A', type: 'text' },
      { id: 'b', label: 'B', type: 'number' },
      { id: 'c', label: 'C', type: 'datetime' },
      { id: 'd', label: 'D', type: 'select', options: [{ value: 'x', label: 'X' }] },
      { id: 'e', label: 'E', type: 'checkbox' },
      { id: 'f', label: 'F', type: 'radio', options: [{ value: 'y', label: 'Y' }] },
      { id: 'g', label: 'G', type: 'file' },
      { id: 'h', label: 'H', type: 'slider' },
      { id: 'i', label: 'I', type: 'hidden', defaultValue: 'x' },
    ];
    for (const fixture of fixtures) {
      expect(() => FormFieldSchema.parse(fixture)).not.toThrow();
    }
  });

  it('rejects an unknown field type', () => {
    expect(() =>
      FormFieldSchema.parse({ id: 'z', label: 'Z', type: 'color_picker' }),
    ).toThrow();
  });
});

// ── Conditional visibility ────────────────────────────────────────────────────

describe('Conditional field visibility (BaseField.conditionalVisibility)', () => {
  it('parses a string-valued dependency rule', () => {
    const field = FormFieldSchema.parse({
      id: 'custom_domain',
      label: 'Custom Domain',
      type: 'text',
      conditionalVisibility: { dependsOn: 'enable_https', value: 'true' },
    });
    expect(field.conditionalVisibility?.dependsOn).toBe('enable_https');
    expect(field.conditionalVisibility?.value).toBe('true');
  });

  it('parses a boolean-valued dependency rule', () => {
    const field = FormFieldSchema.parse({
      id: 'ssl_cert',
      label: 'SSL Certificate',
      type: 'file',
      conditionalVisibility: { dependsOn: 'enable_tls', value: true },
    });
    expect(field.conditionalVisibility?.value).toBe(true);
  });

  it('parses a number-valued dependency rule', () => {
    const field = FormFieldSchema.parse({
      id: 'max_conn',
      label: 'Max Connections',
      type: 'number',
      conditionalVisibility: { dependsOn: 'connection_mode', value: 2 },
    });
    expect(field.conditionalVisibility?.value).toBe(2);
  });

  it('allows omitting conditionalVisibility entirely', () => {
    const field = FormFieldSchema.parse({ id: 'name', label: 'Name', type: 'text' });
    expect(field.conditionalVisibility).toBeUndefined();
  });
});

// ── FormSectionSchema ─────────────────────────────────────────────────────────

describe('FormSectionSchema', () => {
  it('parses a minimal section', () => {
    const result = FormSectionSchema.parse({ id: 'basic', title: 'Basic', fields: [] });
    expect(result.id).toBe('basic');
    expect(result.collapsible).toBe(false);
    expect(result.defaultCollapsed).toBe(false);
    expect(result.columns).toBe(1);
  });

  it('parses a collapsible section that starts collapsed', () => {
    const result = FormSectionSchema.parse({
      id: 'advanced',
      title: 'Advanced',
      fields: [],
      collapsible: true,
      defaultCollapsed: true,
    });
    expect(result.collapsible).toBe(true);
    expect(result.defaultCollapsed).toBe(true);
  });

  it.each([1, 2, 3] as const)('accepts columns=%d', (columns) => {
    const result = FormSectionSchema.parse({ id: 's', title: 'S', fields: [], columns });
    expect(result.columns).toBe(columns);
  });

  it('rejects columns=4', () => {
    expect(() =>
      FormSectionSchema.parse({ id: 's', title: 'S', fields: [], columns: 4 }),
    ).toThrow();
  });

  it('includes an optional description', () => {
    const result = FormSectionSchema.parse({
      id: 'sec',
      title: 'Security',
      description: 'Configure TLS settings',
      fields: [],
    });
    expect(result.description).toBe('Configure TLS settings');
  });

  it('parses a section with nested fields', () => {
    const result = FormSectionSchema.parse({
      id: 'resources',
      title: 'Resources',
      fields: [
        { id: 'cpu', label: 'CPU', type: 'number', min: 1, max: 64 },
        { id: 'memory', label: 'Memory', type: 'slider', min: 256, max: 32768, step: 256 },
      ],
    });
    expect(result.fields).toHaveLength(2);
    expect(result.fields[0].type).toBe('number');
    expect(result.fields[1].type).toBe('slider');
  });
});

// ── FormSubmissionSchema ──────────────────────────────────────────────────────

describe('FormSubmissionSchema', () => {
  it('parses a valid form submission', () => {
    const submission = {
      event: 'form_submission' as const,
      formId: 'deploy-config',
      intentId: crypto.randomUUID(),
      values: { service_name: 'api-gateway', replicas: 3 },
      timestamp: Date.now(),
    };
    const result = FormSubmissionSchema.parse(submission);
    expect(result.event).toBe('form_submission');
    expect(result.formId).toBe('deploy-config');
    expect(result.values).toEqual({ service_name: 'api-gateway', replicas: 3 });
  });

  it('rejects wrong event literal', () => {
    expect(() =>
      FormSubmissionSchema.parse({
        event: 'form_update',
        formId: 'x',
        intentId: crypto.randomUUID(),
        values: {},
        timestamp: Date.now(),
      }),
    ).toThrow();
  });

  it('rejects non-UUID intentId', () => {
    expect(() =>
      FormSubmissionSchema.parse({
        event: 'form_submission',
        formId: 'x',
        intentId: 'not-a-uuid',
        values: {},
        timestamp: Date.now(),
      }),
    ).toThrow();
  });

  it('accepts complex nested values', () => {
    const result = FormSubmissionSchema.parse({
      event: 'form_submission',
      formId: 'advanced-form',
      intentId: crypto.randomUUID(),
      values: {
        config: { nested: true },
        tags: ['a', 'b'],
        count: 42,
      },
      timestamp: Date.now(),
    });
    expect(result.values.config).toEqual({ nested: true });
    expect(result.values.tags).toEqual(['a', 'b']);
  });
});

// ── FormValidationResponseSchema ──────────────────────────────────────────────

describe('FormValidationResponseSchema', () => {
  it('parses a valid response with no errors', () => {
    const result = FormValidationResponseSchema.parse({
      event: 'form_validation_response',
      formId: 'deploy-config',
      valid: true,
      errors: [],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('defaults errors to empty array when omitted', () => {
    const result = FormValidationResponseSchema.parse({
      event: 'form_validation_response',
      formId: 'x',
      valid: true,
    });
    expect(result.errors).toEqual([]);
  });

  it('parses an invalid response with field errors and global error', () => {
    const result = FormValidationResponseSchema.parse({
      event: 'form_validation_response',
      formId: 'deploy-config',
      valid: false,
      errors: [
        { fieldId: 'service_name', message: 'Name already taken.' },
        { fieldId: 'replicas', message: 'Must be between 1 and 10.' },
      ],
      globalError: 'Deployment quota exceeded.',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].fieldId).toBe('service_name');
    expect(result.globalError).toBe('Deployment quota exceeded.');
  });

  it('rejects wrong event literal', () => {
    expect(() =>
      FormValidationResponseSchema.parse({
        event: 'form_error',
        formId: 'x',
        valid: false,
      }),
    ).toThrow();
  });
});
