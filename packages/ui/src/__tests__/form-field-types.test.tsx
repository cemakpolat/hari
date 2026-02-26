// ─────────────────────────────────────────────────────────────────────────────
// FormRenderer — advanced field type tests
//
// Covers:
//   - ColorField: renders native color input; swatches shown and clickable;
//     clicking swatch updates value
//   - DateRangeField: renders start/end inputs; shows error when end < start
//   - AutocompleteField: renders text input; shows suggestions on typing;
//     selecting suggestion updates value
//   - RichTextField: renders toolbar buttons; bold/italic wrap selection;
//     char count shown; toolbar buttons have accessible labels
//   - FormRenderer rate limiting: submitting too many times shows an error
//   - FormRenderer dark mode: renders without matchMedia errors in jsdom
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

import { FormRenderer } from '../components/FormRenderer';
import type { FormSection } from '@hari/core';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSection(fields: FormSection['fields'], overrides: Partial<FormSection> = {}): FormSection {
  return {
    id: 's1',
    title: 'Section',
    fields,
    collapsible: false,
    defaultCollapsed: false,
    columns: 1,
    ...overrides,
  };
}

function renderForm(fields: FormSection['fields'], extraProps: Record<string, unknown> = {}) {
  const onSubmit = vi.fn();
  return {
    ...render(
      <FormRenderer
        sections={[makeSection(fields)]}
        onSubmit={onSubmit}
        {...extraProps}
      />
    ),
    onSubmit,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ColorField
// ─────────────────────────────────────────────────────────────────────────────

describe('ColorField', () => {
  const COLOR_FIELD = {
    id: 'bg',
    type: 'color' as const,
    label: 'Background',
    required: false,
    disabled: false,
  };

  it('renders a native color input', () => {
    renderForm([COLOR_FIELD]);
    expect(screen.getByLabelText('Background')).toHaveProperty('type', 'color');
  });

  it('does not render swatch list when no swatches are provided', () => {
    renderForm([COLOR_FIELD]);
    expect(screen.queryAllByRole('button', { name: /Select colour/i })).toHaveLength(0);
  });

  it('renders swatch buttons when swatches are provided', () => {
    const fieldWithSwatches = { ...COLOR_FIELD, swatches: ['#ff0000', '#00ff00', '#0000ff'] };
    renderForm([fieldWithSwatches]);
    const swatches = screen.getAllByRole('button', { name: /Select colour/i });
    expect(swatches).toHaveLength(3);
  });

  it('clicking a swatch updates the hex value display', () => {
    const fieldWithSwatches = { ...COLOR_FIELD, swatches: ['#abcdef'] };
    renderForm([fieldWithSwatches]);
    fireEvent.click(screen.getByRole('button', { name: 'Select colour #abcdef' }));
    expect(screen.getByText('#abcdef')).toBeDefined();
  });

  it('swatch button has aria-pressed=true when it matches current value', () => {
    const fieldWithSwatches = {
      ...COLOR_FIELD,
      swatches: ['#6366f1'],
      defaultValue: '#6366f1',
    };
    renderForm([fieldWithSwatches]);
    const btn = screen.getByRole('button', { name: 'Select colour #6366f1' });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DateRangeField
// ─────────────────────────────────────────────────────────────────────────────

describe('DateRangeField', () => {
  const DATE_RANGE_FIELD = {
    id: 'period',
    type: 'date_range' as const,
    label: 'Period',
    required: false,
    disabled: false,
    startLabel: 'Start date',
    endLabel: 'End date',
  };

  it('renders start and end date inputs', () => {
    renderForm([DATE_RANGE_FIELD]);
    expect(screen.getByLabelText('Start date')).toBeDefined();
    expect(screen.getByLabelText('End date')).toBeDefined();
  });

  it('does NOT show end-before-start error when dates are valid', () => {
    renderForm([DATE_RANGE_FIELD]);
    const startInput = screen.getByLabelText('Start date');
    const endInput = screen.getByLabelText('End date');
    fireEvent.change(startInput, { target: { value: '2024-01-01' } });
    fireEvent.change(endInput, { target: { value: '2024-03-31' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows an error when end date is before start date', () => {
    renderForm([DATE_RANGE_FIELD]);
    const startInput = screen.getByLabelText('Start date');
    const endInput = screen.getByLabelText('End date');
    fireEvent.change(startInput, { target: { value: '2024-06-01' } });
    fireEvent.change(endInput, { target: { value: '2024-01-01' } });
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText(/End date must be on or after the start date/i)).toBeDefined();
  });

  it('dismisses the error once end date is corrected', () => {
    renderForm([DATE_RANGE_FIELD]);
    const startInput = screen.getByLabelText('Start date');
    const endInput = screen.getByLabelText('End date');
    fireEvent.change(startInput, { target: { value: '2024-06-01' } });
    fireEvent.change(endInput, { target: { value: '2024-01-01' } });
    // Error shown
    expect(screen.getByRole('alert')).toBeDefined();
    // Correct the end date
    fireEvent.change(endInput, { target: { value: '2024-12-31' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('uses custom start/end labels', () => {
    const customField = { ...DATE_RANGE_FIELD, startLabel: 'From', endLabel: 'To' };
    renderForm([customField]);
    expect(screen.getByLabelText('From')).toBeDefined();
    expect(screen.getByLabelText('To')).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AutocompleteField
// ─────────────────────────────────────────────────────────────────────────────

describe('AutocompleteField', () => {
  const AC_FIELD = {
    id: 'country',
    type: 'autocomplete' as const,
    label: 'Country',
    required: false,
    disabled: false,
    options: [
      { value: 'us', label: 'United States' },
      { value: 'uk', label: 'United Kingdom' },
      { value: 'de', label: 'Germany' },
      { value: 'fr', label: 'France' },
    ],
    minChars: 1,
    maxSuggestions: 8,
    allowCustomValue: false,
  };

  it('renders an input with the field label', () => {
    renderForm([AC_FIELD]);
    expect(screen.getByLabelText('Country')).toBeDefined();
  });

  it('shows no suggestions before user types', () => {
    renderForm([AC_FIELD]);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('shows matching suggestions as user types', () => {
    renderForm([AC_FIELD]);
    const input = screen.getByLabelText('Country');
    fireEvent.change(input, { target: { value: 'uni' } });
    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeDefined();
    // "United States" and "United Kingdom" both match "uni"
    expect(screen.getByText('United States')).toBeDefined();
    expect(screen.getByText('United Kingdom')).toBeDefined();
    // "Germany" should NOT appear
    expect(screen.queryByText('Germany')).toBeNull();
  });

  it('selecting a suggestion sets the value and closes the list', () => {
    renderForm([AC_FIELD]);
    const input = screen.getByLabelText('Country');
    fireEvent.change(input, { target: { value: 'ger' } });
    // The suggestion list items use onMouseDown (not onClick) so that
    // they fire before the input's onBlur closes the list.
    fireEvent.mouseDown(screen.getByText('Germany'));
    expect((input as HTMLInputElement).value).toBe('Germany');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('hides suggestions when input is cleared (below minChars)', () => {
    renderForm([AC_FIELD]);
    const input = screen.getByLabelText('Country');
    fireEvent.change(input, { target: { value: 'fr' } });
    expect(screen.getByRole('listbox')).toBeDefined();
    // Clear input — minChars=1 means empty string shows nothing
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RichTextField
// ─────────────────────────────────────────────────────────────────────────────

describe('RichTextField', () => {
  const RICH_FIELD = {
    id: 'notes',
    type: 'rich_text' as const,
    label: 'Notes',
    required: false,
    disabled: false,
    toolbar: ['bold', 'italic', 'link', 'unordered-list'] as const,
    rows: 5,
  };

  it('renders a textarea with the field label', () => {
    renderForm([RICH_FIELD]);
    // The textarea has an aria-label containing the field label
    expect(screen.getByRole('textbox', { name: /Notes/i })).toBeDefined();
  });

  it('renders toolbar buttons for each configured format action', () => {
    renderForm([RICH_FIELD]);
    expect(screen.getByRole('button', { name: 'Format: bold' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Format: italic' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Format: link' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Format: unordered-list' })).toBeDefined();
  });

  it('does NOT render toolbar buttons for unconfigured actions', () => {
    renderForm([RICH_FIELD]);
    // 'underline' is not in the toolbar array
    expect(screen.queryByRole('button', { name: 'Format: underline' })).toBeNull();
  });

  it('typing in the textarea updates the displayed value', () => {
    renderForm([RICH_FIELD]);
    const textarea = screen.getByRole('textbox', { name: /Notes/i }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Hello world' } });
    expect(textarea.value).toBe('Hello world');
  });

  it('shows character count when maxLength is set', () => {
    const fieldWithMax = { ...RICH_FIELD, maxLength: 100 };
    renderForm([fieldWithMax]);
    const textarea = screen.getByRole('textbox', { name: /Notes/i }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'abc' } });
    expect(screen.getByText('3 / 100')).toBeDefined();
  });

  it('shows min character hint when below minLength', () => {
    const fieldWithMin = { ...RICH_FIELD, minLength: 50 };
    renderForm([fieldWithMin]);
    const textarea = screen.getByRole('textbox', { name: /Notes/i }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'hi' } });
    expect(screen.getByText(/min 50/i)).toBeDefined();
  });

  it('does not show character count when neither minLength nor maxLength is set', () => {
    renderForm([RICH_FIELD]);
    expect(screen.queryByText(/\/ \d+/)).toBeNull();
  });

  it('toolbar buttons are disabled when field is disabled', () => {
    const disabledField = { ...RICH_FIELD, disabled: true };
    renderForm([disabledField]);
    const boldBtn = screen.getByRole('button', { name: 'Format: bold' });
    expect(boldBtn).toHaveProperty('disabled', true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiting
// ─────────────────────────────────────────────────────────────────────────────

describe('FormRenderer — rate limiting', () => {
  const TEXT_FIELD = {
    id: 'msg',
    type: 'text' as const,
    label: 'Message',
    required: false,
    disabled: false,
    inputType: 'text' as const,
  };

  it('blocks submit and shows error after maxAttempts within windowMs', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <FormRenderer
        sections={[makeSection([TEXT_FIELD])]}
        onSubmit={onSubmit}
        rateLimit={{ maxAttempts: 2, windowMs: 60_000 }}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Submit/i });

    // First submit
    await act(async () => { fireEvent.click(submitBtn); });
    // Second submit
    await act(async () => { fireEvent.click(submitBtn); });
    // Third submit should be rate-limited
    await act(async () => { fireEvent.click(submitBtn); });

    await waitFor(() => {
      expect(screen.queryByText(/Too many/i) ?? screen.queryByText(/wait/i)).not.toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dark mode — FormRenderer in jsdom
// ─────────────────────────────────────────────────────────────────────────────

describe('FormRenderer — dark mode safety in jsdom', () => {
  const TEXT_FIELD = {
    id: 'q',
    type: 'text' as const,
    label: 'Question',
    required: false,
    disabled: false,
    inputType: 'text' as const,
  };

  it('renders without throwing when window.matchMedia is unavailable', () => {
    // jsdom does not implement window.matchMedia — the usePrefersDark guard must hold.
    render(
      <FormRenderer
        sections={[makeSection([TEXT_FIELD])]}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Question')).toBeDefined();
  });

  it('renders all field types without crashing in jsdom (no matchMedia)', () => {
    const allFieldTypes = [
      { id: 'f1', type: 'text' as const, label: 'Text', required: false, disabled: false, inputType: 'text' as const },
      { id: 'f2', type: 'number' as const, label: 'Number', required: false, disabled: false },
      { id: 'f3', type: 'checkbox' as const, label: 'Check', required: false, disabled: false },
      { id: 'f4', type: 'color' as const, label: 'Colour', required: false, disabled: false },
      { id: 'f5', type: 'date_range' as const, label: 'Range', required: false, disabled: false, startLabel: 'Start date', endLabel: 'End date' },
      { id: 'f6', type: 'rich_text' as const, label: 'Notes', required: false, disabled: false, toolbar: ['bold' as const], rows: 3 },
      { id: 'f7', type: 'autocomplete' as const, label: 'City', required: false, disabled: false, options: [{ value: 'nyc', label: 'New York' }], minChars: 1, maxSuggestions: 5, allowCustomValue: false },
    ];
    render(
      <FormRenderer
        sections={[makeSection(allFieldTypes as FormSection['fields'])]}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Text')).toBeDefined();
    expect(screen.getByLabelText('Colour')).toBeDefined();
    expect(screen.getByRole('textbox', { name: /Notes/i })).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SliderField
// ─────────────────────────────────────────────────────────────────────────────

describe('SliderField', () => {
  const SLIDER_FIELD = {
    id: 'volume',
    type: 'slider' as const,
    label: 'Volume',
    required: false,
    disabled: false,
    min: 0,
    max: 100,
    step: 5,
    showValue: true,
  };

  it('renders a range input', () => {
    renderForm([SLIDER_FIELD]);
    const input = screen.getByLabelText('Volume');
    expect((input as HTMLInputElement).type).toBe('range');
  });

  it('respects min, max, and step attributes', () => {
    renderForm([SLIDER_FIELD]);
    const input = screen.getByLabelText('Volume') as HTMLInputElement;
    expect(input.min).toBe('0');
    expect(input.max).toBe('100');
    expect(input.step).toBe('5');
  });

  it('displays the current value when showValue=true', () => {
    renderForm([{ ...SLIDER_FIELD, defaultValue: 42 }]);
    expect(screen.getByText('42')).toBeDefined();
  });

  it('does not display value when showValue=false', () => {
    renderForm([{ ...SLIDER_FIELD, showValue: false, defaultValue: 42 }]);
    expect(screen.queryByText('42')).toBeNull();
  });

  it('renders minLabel and maxLabel when provided', () => {
    renderForm([{ ...SLIDER_FIELD, minLabel: 'Silent', maxLabel: 'Loud' }]);
    expect(screen.getByText('Silent')).toBeDefined();
    expect(screen.getByText('Loud')).toBeDefined();
  });

  it('does not render labels when not provided', () => {
    renderForm([SLIDER_FIELD]);
    expect(screen.queryByText('Silent')).toBeNull();
    expect(screen.queryByText('Loud')).toBeNull();
  });

  it('fires onChange when slider is moved', () => {
    renderForm([SLIDER_FIELD]);
    const input = screen.getByLabelText('Volume');
    fireEvent.change(input, { target: { value: '75' } });
    // The displayed value updates
    expect(screen.getByText('75')).toBeDefined();
  });

  it('is disabled when field.disabled=true', () => {
    renderForm([{ ...SLIDER_FIELD, disabled: true }]);
    expect(screen.getByLabelText('Volume')).toHaveProperty('disabled', true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FileField
// ─────────────────────────────────────────────────────────────────────────────

describe('FileField', () => {
  const FILE_FIELD = {
    id: 'upload',
    type: 'file' as const,
    label: 'Upload',
    required: false,
    disabled: false,
    multiple: false,
    showPreview: true,
  };

  it('renders a file input', () => {
    renderForm([FILE_FIELD]);
    const input = screen.getByLabelText('Upload');
    expect((input as HTMLInputElement).type).toBe('file');
  });

  it('sets the multiple attribute when field.multiple=true', () => {
    renderForm([{ ...FILE_FIELD, multiple: true }]);
    const input = screen.getByLabelText('Upload') as HTMLInputElement;
    expect(input.multiple).toBe(true);
  });

  it('sets accept attribute from the accept array', () => {
    renderForm([{ ...FILE_FIELD, accept: ['image/*', '.pdf'] }]);
    const input = screen.getByLabelText('Upload') as HTMLInputElement;
    expect(input.accept).toBe('image/*,.pdf');
  });

  it('is disabled when field.disabled=true', () => {
    renderForm([{ ...FILE_FIELD, disabled: true }]);
    expect(screen.getByLabelText('Upload')).toHaveProperty('disabled', true);
  });

  it('shows size error when an oversized file is selected', () => {
    renderForm([{ ...FILE_FIELD, maxSizeMB: 1 }]);
    const input = screen.getByLabelText('Upload');
    // Create a mock File of 2 MB
    const bigFile = new File(['x'.repeat(2 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' });
    Object.defineProperty(bigFile, 'size', { value: 2 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [bigFile] } });
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText(/exceeds the 1 MB limit/i)).toBeDefined();
  });

  it('does NOT show size error when files are within the limit', () => {
    renderForm([{ ...FILE_FIELD, maxSizeMB: 5 }]);
    const input = screen.getByLabelText('Upload');
    const smallFile = new File(['hello'], 'small.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [smallFile] } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('clears the size error on a subsequent valid file selection', () => {
    renderForm([{ ...FILE_FIELD, maxSizeMB: 1 }]);
    const input = screen.getByLabelText('Upload');
    const bigFile = new File(['x'], 'big.bin', { type: 'application/octet-stream' });
    Object.defineProperty(bigFile, 'size', { value: 2 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [bigFile] } });
    expect(screen.getByRole('alert')).toBeDefined();
    const smallFile = new File(['ok'], 'ok.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [smallFile] } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not enforce size when maxSizeMB is not set', () => {
    renderForm([FILE_FIELD]);
    const input = screen.getByLabelText('Upload');
    const bigFile = new File(['x'], 'huge.bin', { type: 'application/octet-stream' });
    Object.defineProperty(bigFile, 'size', { value: 100 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [bigFile] } });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
