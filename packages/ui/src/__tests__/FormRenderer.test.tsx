// ─────────────────────────────────────────────────────────────────────────────
// FormRenderer integration tests
//
// Covers:
//   - Rendering field types (text, number, checkbox, select, radio)
//   - Required field validation shown after blur
//   - Email/pattern validation rules shown after blur
//   - Submit is blocked when validation errors exist
//   - Conditional field visibility (show/hide based on another field's value)
//   - Form submission with collected values
//   - Server-side error display (global error banner)
//   - Collapsible sections
//   - Default values pre-populate fields
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormRenderer } from '../components/FormRenderer';
import type { FormSection } from '@hari/core';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSection(overrides: Partial<FormSection> = {}): FormSection {
  return {
    id: 'basic',
    title: 'Basic',
    fields: [],
    collapsible: false,
    defaultCollapsed: false,
    columns: 1,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────────────────────────

describe('FormRenderer — rendering', () => {
  it('renders a text input with label', () => {
    const section = makeSection({
      fields: [{ id: 'service_name', label: 'Service Name', type: 'text', required: false, disabled: false, sensitive: false, validation: [], multiline: false }],
    });
    render(<FormRenderer formId="test" sections={[section]} />);
    expect(screen.getByLabelText(/service name/i)).toBeInTheDocument();
  });

  it('renders a number input', () => {
    const section = makeSection({
      fields: [{ id: 'replicas', label: 'Replicas', type: 'number', required: false, disabled: false, sensitive: false, validation: [] }],
    });
    render(<FormRenderer formId="test" sections={[section]} />);
    expect(screen.getByLabelText(/replicas/i)).toBeInTheDocument();
  });

  it('renders a checkbox', () => {
    const section = makeSection({
      fields: [{ id: 'agree', label: 'I agree', type: 'checkbox', required: false, disabled: false, sensitive: false, validation: [] }],
    });
    render(<FormRenderer formId="test" sections={[section]} />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('renders select options', () => {
    const section = makeSection({
      fields: [{
        id: 'region',
        label: 'Region',
        type: 'select',
        required: false,
        disabled: false,
        sensitive: false,
        validation: [],
        multiple: false,
        searchable: false,
        options: [
          { value: 'us-east-1', label: 'US East' },
          { value: 'eu-west-1', label: 'EU West' },
        ],
      }],
    });
    render(<FormRenderer formId="test" sections={[section]} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('US East')).toBeInTheDocument();
    expect(screen.getByText('EU West')).toBeInTheDocument();
  });

  it('renders radio buttons', () => {
    const section = makeSection({
      fields: [{
        id: 'env',
        label: 'Environment',
        type: 'radio',
        required: false,
        disabled: false,
        sensitive: false,
        validation: [],
        layout: 'vertical',
        options: [
          { value: 'staging', label: 'Staging' },
          { value: 'production', label: 'Production' },
        ],
      }],
    });
    render(<FormRenderer formId="test" sections={[section]} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
  });

  it('renders the submit button with custom label', () => {
    render(<FormRenderer formId="test" sections={[]} submitButtonLabel="Deploy Service" />);
    expect(screen.getByRole('button', { name: /deploy service/i })).toBeInTheDocument();
  });

  it('does not render submit button when showSubmitButton=false', () => {
    render(<FormRenderer formId="test" sections={[]} showSubmitButton={false} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders section title when section has visible fields', () => {
    const section = makeSection({
      title: 'Network Configuration',
      fields: [{ id: 'host', label: 'Host', type: 'text', required: false, disabled: false, sensitive: false, validation: [], multiline: false }],
    });
    render(<FormRenderer formId="test" sections={[section]} />);
    expect(screen.getByText('Network Configuration')).toBeInTheDocument();
  });

  it('renders help text when provided', () => {
    const section = makeSection({
      fields: [{
        id: 'name',
        label: 'Name',
        type: 'text',
        helpText: 'Must be lowercase alphanumeric.',
        required: false,
        disabled: false,
        sensitive: false,
        validation: [],
        multiline: false,
      }],
    });
    render(<FormRenderer formId="test" sections={[section]} />);
    expect(screen.getByText('Must be lowercase alphanumeric.')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Validation — errors shown after blur (touched)
//
// The FormRenderer displays validation errors only after a field is touched
// (blurred). This is intentional: errors are suppressed until the user
// has interacted with the field so as not to show errors on initial load.
// ─────────────────────────────────────────────────────────────────────────────

describe('FormRenderer — validation on blur', () => {
  it('shows required error after blurring an empty required field', async () => {
    const section = makeSection({
      fields: [{
        id: 'service_name',
        label: 'Service Name',
        type: 'text',
        required: true,
        disabled: false,
        sensitive: false,
        validation: [],
        multiline: false,
      }],
    });
    render(<FormRenderer formId="test" sections={[section]} />);

    const input = screen.getByLabelText(/service name/i);
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.getByText(/service name is required/i)).toBeInTheDocument();
    });
  });

  it('shows email validation error after blurring with an invalid email', async () => {
    const section = makeSection({
      fields: [{
        id: 'email',
        label: 'Email',
        type: 'text',
        required: true,
        disabled: false,
        sensitive: false,
        validation: [{ type: 'email', message: 'Must be a valid email.' }],
        multiline: false,
      }],
    });
    render(<FormRenderer formId="test" sections={[section]} />);

    const input = screen.getByLabelText(/email/i);
    await userEvent.type(input, 'not-an-email');
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.getByText(/must be a valid email/i)).toBeInTheDocument();
    });
  });

  it('clears validation error once a valid email is entered', async () => {
    const section = makeSection({
      fields: [{
        id: 'email',
        label: 'Email',
        type: 'text',
        required: true,
        disabled: false,
        sensitive: false,
        validation: [{ type: 'email', message: 'Must be a valid email.' }],
        multiline: false,
      }],
    });
    render(<FormRenderer formId="test" sections={[section]} />);

    const input = screen.getByLabelText(/email/i);
    // First: trigger error
    await userEvent.type(input, 'bad');
    fireEvent.blur(input);
    await waitFor(() => expect(screen.getByText(/must be a valid email/i)).toBeInTheDocument());

    // Then: fix the value
    await userEvent.clear(input);
    await userEvent.type(input, 'good@example.com');
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.queryByText(/must be a valid email/i)).not.toBeInTheDocument();
    });
  });

  it('shows pattern validation error after blurring with a non-matching value', async () => {
    const section = makeSection({
      fields: [{
        id: 'slug',
        label: 'Slug',
        type: 'text',
        required: true,
        disabled: false,
        sensitive: false,
        validation: [{ type: 'pattern', message: 'Only lowercase letters.', pattern: '^[a-z]+$' }],
        multiline: false,
      }],
    });
    render(<FormRenderer formId="test" sections={[section]} />);

    const input = screen.getByLabelText(/slug/i);
    await userEvent.type(input, 'INVALID123');
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.getByText(/only lowercase letters/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Submit behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe('FormRenderer — submit behaviour', () => {
  it('calls onSubmit when all required fields are filled', async () => {
    const section = makeSection({
      fields: [{
        id: 'service_name',
        label: 'Service Name',
        type: 'text',
        required: true,
        disabled: false,
        sensitive: false,
        validation: [],
        multiline: false,
      }],
    });
    const onSubmit = vi.fn();
    render(<FormRenderer formId="test" sections={[section]} onSubmit={onSubmit} />);

    const input = screen.getByLabelText(/service name/i);
    await userEvent.type(input, 'my-api');
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ service_name: 'my-api' }));
    });
  });

  it('accepts valid email and submits', async () => {
    const section = makeSection({
      fields: [{
        id: 'email',
        label: 'Email',
        type: 'text',
        required: true,
        disabled: false,
        sensitive: false,
        validation: [{ type: 'email', message: 'Must be a valid email.' }],
        multiline: false,
      }],
    });
    const onSubmit = vi.fn();
    render(<FormRenderer formId="test" sections={[section]} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ email: 'user@example.com' }));
    });
  });

  it('does not call onSubmit when required fields are empty', async () => {
    const section = makeSection({
      fields: [
        { id: 'a', label: 'Field A', type: 'text', required: true, disabled: false, sensitive: false, validation: [], multiline: false },
        { id: 'b', label: 'Field B', type: 'text', required: true, disabled: false, sensitive: false, validation: [], multiline: false },
      ],
    });
    const onSubmit = vi.fn();
    render(<FormRenderer formId="test" sections={[section]} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    // Wait a tick then verify onSubmit was never called
    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  it('collects values from multiple sections on submit', async () => {
    const sections: FormSection[] = [
      makeSection({
        id: 'sec-a',
        fields: [{ id: 'name', label: 'Name', type: 'text', required: false, disabled: false, sensitive: false, validation: [], multiline: false }],
      }),
      {
        id: 'sec-b',
        title: 'Resources',
        fields: [{ id: 'replicas', label: 'Replicas', type: 'number', required: false, disabled: false, sensitive: false, validation: [] }],
        collapsible: false,
        defaultCollapsed: false,
        columns: 1,
      },
    ];
    const onSubmit = vi.fn();
    render(<FormRenderer formId="test" sections={sections} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/name/i), 'gateway');
    fireEvent.change(screen.getByLabelText(/replicas/i), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'gateway' }),
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Conditional field visibility
// ─────────────────────────────────────────────────────────────────────────────

describe('FormRenderer — conditional field visibility', () => {
  function buildSections(): FormSection[] {
    return [
      makeSection({
        fields: [
          {
            id: 'enable_tls',
            label: 'Enable TLS',
            type: 'checkbox',
            required: false,
            disabled: false,
            sensitive: false,
            validation: [],
            defaultValue: false,
          },
          {
            id: 'tls_cert',
            label: 'TLS Certificate',
            type: 'text',
            required: false,
            disabled: false,
            sensitive: false,
            validation: [],
            multiline: false,
            conditionalVisibility: { dependsOn: 'enable_tls', value: true },
          },
        ],
      }),
    ];
  }

  it('hides conditional field when dependency is not satisfied', () => {
    render(<FormRenderer formId="cond" sections={buildSections()} />);
    // 'TLS Certificate' should not be visible when 'Enable TLS' is unchecked
    expect(screen.queryByLabelText(/tls certificate/i)).not.toBeInTheDocument();
  });

  it('shows conditional field when dependency is satisfied', async () => {
    render(<FormRenderer formId="cond" sections={buildSections()} />);

    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);

    await waitFor(() => {
      expect(screen.getByLabelText(/tls certificate/i)).toBeInTheDocument();
    });
  });

  it('hides the field again when dependency reverts', async () => {
    render(<FormRenderer formId="cond" sections={buildSections()} />);

    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox); // check → field appears
    await waitFor(() => expect(screen.getByLabelText(/tls certificate/i)).toBeInTheDocument());

    await userEvent.click(checkbox); // uncheck → field disappears
    await waitFor(() => expect(screen.queryByLabelText(/tls certificate/i)).not.toBeInTheDocument());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Server-side errors
// ─────────────────────────────────────────────────────────────────────────────

describe('FormRenderer — server-side errors', () => {
  it('displays a global server error above the submit button', () => {
    const section = makeSection({
      fields: [{ id: 'x', label: 'X', type: 'text', required: false, disabled: false, sensitive: false, validation: [], multiline: false }],
    });
    render(
      <FormRenderer
        formId="test"
        sections={[section]}
        serverErrors={{ globalError: 'Quota exceeded for this account.' }}
      />,
    );
    expect(screen.getByText(/quota exceeded/i)).toBeInTheDocument();
  });

  it('merges server field errors on submit (prevents re-submission)', async () => {
    // When a server error exists for a field and the form is submitted again,
    // the error is merged into the validation error set and blocks submission.
    const section = makeSection({
      fields: [{
        id: 'service_name',
        label: 'Service Name',
        type: 'text',
        required: false,
        disabled: false,
        sensitive: false,
        validation: [],
        multiline: false,
      }],
    });
    const onSubmit = vi.fn();
    render(
      <FormRenderer
        formId="test"
        sections={[section]}
        onSubmit={onSubmit}
        serverErrors={{ fieldErrors: { service_name: 'Name already taken.' } }}
      />,
    );

    // Submit with the server error present — it should block the call
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Default values
// ─────────────────────────────────────────────────────────────────────────────

describe('FormRenderer — default values', () => {
  it('pre-populates text field from defaultValue', async () => {
    const section = makeSection({
      fields: [{
        id: 'region',
        label: 'Region',
        type: 'text',
        required: false,
        disabled: false,
        sensitive: false,
        validation: [],
        multiline: false,
        defaultValue: 'us-east-1',
      }],
    });
    render(<FormRenderer formId="test" sections={[section]} />);
    await waitFor(() => {
      expect((screen.getByLabelText(/region/i) as HTMLInputElement).value).toBe('us-east-1');
    });
  });

  it('submits with default value when field is untouched', async () => {
    const section = makeSection({
      fields: [{
        id: 'region',
        label: 'Region',
        type: 'text',
        required: false,
        disabled: false,
        sensitive: false,
        validation: [],
        multiline: false,
        defaultValue: 'eu-west-1',
      }],
    });
    const onSubmit = vi.fn();
    render(<FormRenderer formId="test" sections={[section]} onSubmit={onSubmit} />);

    await waitFor(() => {
      expect((screen.getByLabelText(/region/i) as HTMLInputElement).value).toBe('eu-west-1');
    });

    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ region: 'eu-west-1' }));
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Collapsible sections
// ─────────────────────────────────────────────────────────────────────────────

describe('FormRenderer — collapsible sections', () => {
  it('renders fields and toggle when section is expanded by default', () => {
    const section = makeSection({
      title: 'Advanced Settings',
      collapsible: true,
      defaultCollapsed: false,
      fields: [{ id: 'debug', label: 'Debug Mode', type: 'checkbox', required: false, disabled: false, sensitive: false, validation: [] }],
    });
    render(<FormRenderer formId="test" sections={[section]} />);
    expect(screen.getByText('Advanced Settings')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('hides fields when section starts collapsed', () => {
    const section = makeSection({
      title: 'Advanced Settings',
      collapsible: true,
      defaultCollapsed: true,
      fields: [{ id: 'debug', label: 'Debug Mode', type: 'checkbox', required: false, disabled: false, sensitive: false, validation: [] }],
    });
    render(<FormRenderer formId="test" sections={[section]} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('toggles section open when collapse button is clicked', async () => {
    const section = makeSection({
      title: 'Advanced Settings',
      collapsible: true,
      defaultCollapsed: true,
      fields: [{ id: 'debug', label: 'Debug Mode', type: 'checkbox', required: false, disabled: false, sensitive: false, validation: [] }],
    });
    render(<FormRenderer formId="test" sections={[section]} />);

    // Initially collapsed
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    // Click expand
    fireEvent.click(screen.getByText(/expand/i));
    await waitFor(() => {
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });
  });
});
