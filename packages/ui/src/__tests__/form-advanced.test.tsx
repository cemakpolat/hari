// ─────────────────────────────────────────────────────────────────────────────
// FormRenderer — async validators, autoSave/draft, hidden field tests
//
// Covers:
//   - asyncValidators: "Validating…" shown during check, async error displayed,
//     race condition (newer call discards stale result)
//   - autoSave: draft restored from localStorage (banner shown, Restore/Discard
//     buttons work), values saved after debounce
//   - HiddenField: no visible UI, value included in onSubmit payload
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render, screen, fireEvent, waitFor, act,
} from '@testing-library/react';
import { FormRenderer } from '../components/FormRenderer';
import type { FormSection, FormField } from '@hari/core';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSection(fields: FormSection['fields']): FormSection {
  return {
    id: 's1',
    title: 'Section',
    fields,
    collapsible: false,
    defaultCollapsed: false,
    columns: 1,
  };
}

// Cast via unknown to avoid requiring every Zod-default field in a literal object.
// Runtime behaviour is identical since FormRenderer handles missing optional fields.
const TEXT_FIELD = {
  id: 'username',
  type: 'text' as const,
  label: 'Username',
  required: false,
  disabled: false,
  inputType: 'text' as const,
  validation: [],
  sensitive: false,
  multiline: false,
} as unknown as FormField;

// ─────────────────────────────────────────────────────────────────────────────
// Async validators
// ─────────────────────────────────────────────────────────────────────────────

describe('FormRenderer — asyncValidators', () => {
  it('shows "Validating…" while the async check is pending', async () => {
    let resolveValidator: (err: string | null) => void;
    const validator = vi.fn(
      () => new Promise<string | null>((res) => { resolveValidator = res; }),
    );

    render(
      <FormRenderer
        sections={[makeSection([TEXT_FIELD])]}
        onSubmit={vi.fn()}
        asyncValidators={{ username: validator }}
      />,
    );

    const input = screen.getByLabelText('Username');
    fireEvent.change(input, { target: { value: 'alice' } });
    fireEvent.blur(input);

    expect(screen.getByText('Validating…')).toBeDefined();

    // Clean up the pending promise
    await act(async () => { resolveValidator!(null); });
  });

  it('clears "Validating…" and shows no error when validator resolves null', async () => {
    const validator = vi.fn().mockResolvedValue(null);

    render(
      <FormRenderer
        sections={[makeSection([TEXT_FIELD])]}
        onSubmit={vi.fn()}
        asyncValidators={{ username: validator }}
      />,
    );

    const input = screen.getByLabelText('Username');
    fireEvent.change(input, { target: { value: 'alice' } });
    fireEvent.blur(input);

    await waitFor(() => expect(screen.queryByText('Validating…')).toBeNull());
    expect(screen.queryByText(/already taken/i)).toBeNull();
  });

  it('shows the async error message when validator rejects with a string', async () => {
    const validator = vi.fn().mockResolvedValue('Username is already taken');

    render(
      <FormRenderer
        sections={[makeSection([TEXT_FIELD])]}
        onSubmit={vi.fn()}
        asyncValidators={{ username: validator }}
      />,
    );

    const input = screen.getByLabelText('Username');
    fireEvent.change(input, { target: { value: 'alice' } });
    fireEvent.blur(input);

    await waitFor(() => screen.getByText('Username is already taken'));
    expect(screen.getByText('Username is already taken')).toBeDefined();
  });

  it('validator is NOT called while sync validation is failing (required empty)', async () => {
    const validator = vi.fn().mockResolvedValue(null);
    const requiredField = { ...TEXT_FIELD, required: true };

    render(
      <FormRenderer
        sections={[makeSection([requiredField])]}
        onSubmit={vi.fn()}
        asyncValidators={{ username: validator }}
      />,
    );

    const input = screen.getByLabelText('Username');
    // Blur without typing → required error
    fireEvent.blur(input);

    expect(validator).not.toHaveBeenCalled();
  });

  it('discards stale async results when a newer blur fires first', async () => {
    const callOrder: number[] = [];
    let resolveFirst: (v: string | null) => void;
    let resolveSecond: (v: string | null) => void;

    const validator = vi.fn()
      .mockImplementationOnce(() => new Promise<string | null>((r) => {
        callOrder.push(1);
        resolveFirst = r;
      }))
      .mockImplementationOnce(() => new Promise<string | null>((r) => {
        callOrder.push(2);
        resolveSecond = r;
      }));

    render(
      <FormRenderer
        sections={[makeSection([TEXT_FIELD])]}
        onSubmit={vi.fn()}
        asyncValidators={{ username: validator }}
      />,
    );

    const input = screen.getByLabelText('Username');

    // First blur
    fireEvent.change(input, { target: { value: 'alice' } });
    fireEvent.blur(input);
    // Second blur (newer sequence)
    fireEvent.change(input, { target: { value: 'alice2' } });
    fireEvent.blur(input);

    // Resolve second first with no error, then first with an error
    await act(async () => { resolveSecond!(null); });
    await act(async () => { resolveFirst!('Stale error — should be ignored'); });

    // The stale error from the first call must NOT appear
    expect(screen.queryByText('Stale error — should be ignored')).toBeNull();
    expect(callOrder).toEqual([1, 2]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AutoSave / draft restore
// ─────────────────────────────────────────────────────────────────────────────

describe('FormRenderer — autoSave', () => {
  const FORM_ID = 'test-autosave-form';
  const DRAFT_KEY = `hari-form-draft-${FORM_ID}`;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('does not show restore banner when autoSave is false (default)', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ username: 'saved-value' }));
    render(
      <FormRenderer
        sections={[makeSection([TEXT_FIELD])]}
        onSubmit={vi.fn()}
        formId={FORM_ID}
      />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows restore banner on mount when autoSave=true and a draft exists', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ username: 'draft-user' }));
    render(
      <FormRenderer
        sections={[makeSection([TEXT_FIELD])]}
        onSubmit={vi.fn()}
        formId={FORM_ID}
        autoSave
      />,
    );
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText(/saved draft was found/i)).toBeDefined();
  });

  it('does NOT show banner when no draft exists in localStorage', () => {
    render(
      <FormRenderer
        sections={[makeSection([TEXT_FIELD])]}
        onSubmit={vi.fn()}
        formId={FORM_ID}
        autoSave
      />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('restores draft values when Restore button is clicked', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ username: 'draft-user' }));
    render(
      <FormRenderer
        sections={[makeSection([TEXT_FIELD])]}
        onSubmit={vi.fn()}
        formId={FORM_ID}
        autoSave
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Restore saved draft' }));
    await waitFor(() => {
      expect((screen.getByLabelText('Username') as HTMLInputElement).value).toBe('draft-user');
    });
    // Banner is dismissed after restore
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('dismisses the banner without restoring values when Discard is clicked', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ username: 'draft-user' }));
    render(
      <FormRenderer
        sections={[makeSection([TEXT_FIELD])]}
        onSubmit={vi.fn()}
        formId={FORM_ID}
        autoSave
      />,
    );

    // Before discard: no value in the input (draft not applied)
    expect((screen.getByLabelText('Username') as HTMLInputElement).value).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Discard saved draft' }));
    expect(screen.queryByRole('alert')).toBeNull();
    // Value still empty
    expect((screen.getByLabelText('Username') as HTMLInputElement).value).toBe('');
  });

  it('saves values to localStorage after the debounce when autoSave=true', async () => {
    vi.useFakeTimers();

    render(
      <FormRenderer
        sections={[makeSection([TEXT_FIELD])]}
        onSubmit={vi.fn()}
        formId={FORM_ID}
        autoSave
      />,
    );

    const input = screen.getByLabelText('Username');
    fireEvent.change(input, { target: { value: 'new-value' } });

    // Before 600ms debounce: nothing saved yet
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();

    // Advance timers past the 600ms debounce
    await act(async () => { vi.advanceTimersByTime(700); });

    const saved = localStorage.getItem(DRAFT_KEY);
    expect(saved).not.toBeNull();
    expect(JSON.parse(saved!)).toMatchObject({ username: 'new-value' });

    vi.useRealTimers();
  });

  it('clears the draft from localStorage on successful form submit', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ username: 'old' }));
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <FormRenderer
        sections={[makeSection([TEXT_FIELD])]}
        onSubmit={onSubmit}
        formId={FORM_ID}
        autoSave
      />,
    );

    // Dismiss banner then submit
    fireEvent.click(screen.getByRole('button', { name: 'Discard saved draft' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Submit/i }));
    });

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// HiddenField
// ─────────────────────────────────────────────────────────────────────────────

describe('FormRenderer — HiddenField', () => {
  const HIDDEN_FIELD = {
    id: 'csrf_token',
    type: 'hidden' as const,
    label: 'CSRF Token',
    required: false,
    disabled: false,
    defaultValue: 'abc123',
    validation: [],
    sensitive: false,
  } as unknown as FormField;

  it('does not render any visible UI for hidden fields', () => {
    render(
      <FormRenderer
        sections={[makeSection([HIDDEN_FIELD])]}
        onSubmit={vi.fn()}
      />,
    );
    // The field label should not appear in the DOM
    expect(screen.queryByText('CSRF Token')).toBeNull();
    // No input element should be present for this field
    expect(screen.queryByLabelText('CSRF Token')).toBeNull();
  });

  it('includes the hidden field defaultValue in the onSubmit payload', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <FormRenderer
        sections={[makeSection([HIDDEN_FIELD])]}
        onSubmit={onSubmit}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Submit/i }));
    });

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const [submittedValues] = onSubmit.mock.calls[0];
    expect(submittedValues).toMatchObject({ csrf_token: 'abc123' });
  });

  it('includes hidden field alongside visible fields in submit payload', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <FormRenderer
        sections={[makeSection([TEXT_FIELD, HIDDEN_FIELD])]}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'bob' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Submit/i }));
    });

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const [submitted] = onSubmit.mock.calls[0];
    expect(submitted).toMatchObject({ username: 'bob', csrf_token: 'abc123' });
  });
});
