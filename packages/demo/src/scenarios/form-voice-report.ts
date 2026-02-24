import { v4 as uuid } from 'uuid';
import type { IntentPayloadInput } from '@hari/core';

// ─────────────────────────────────────────────────────────────────────────────
// Voice-Input Form scenario: "File an incident report"
//
// Demonstrates the 'voice' field type:
//   - One-shot voice recording (press mic → speak → transcript fills field)
//   - Continuous dictation mode for long narrative fields
//   - Language selection, confidence display, manual-correction textarea
//   - Mixed voice + standard fields in the same form
// ─────────────────────────────────────────────────────────────────────────────

export const formVoiceReportIntent: IntentPayloadInput = {
  version: '1.0.0',
  intentId: uuid(),
  type: 'form',
  domain: 'incident',
  primaryGoal: 'Collect incident report via voice + structured fields',
  confidence: 0.93,
  density: 'operator',
  layoutHint: 'form',

  data: {
    formId: 'incident-voice-001',
    title: 'Incident Report — Voice Input',
    description:
      'Use the microphone buttons to dictate field content. Transcripts are editable before submission.',
    sections: [
      {
        id: 'meta',
        title: 'Incident Overview',
        description: 'Basic classification and timing',
        fields: [
          {
            type: 'text',
            id: 'incident_title',
            label: 'Incident Title',
            placeholder: 'e.g. API Gateway 502 storm in eu-west-1',
            required: true,
            validation: [
              { type: 'required', message: 'Title is required' },
              { type: 'min', value: 5, message: 'At least 5 characters' },
            ],
          },
          {
            type: 'select',
            id: 'severity',
            label: 'Severity',
            required: true,
            options: [
              { value: 'sev1', label: 'SEV-1 — Critical (system down)' },
              { value: 'sev2', label: 'SEV-2 — High (major degradation)' },
              { value: 'sev3', label: 'SEV-3 — Medium (partial impact)' },
              { value: 'sev4', label: 'SEV-4 — Low (minor / cosmetic)' },
            ],
            defaultValue: 'sev2',
            validation: [{ type: 'required', message: 'Severity is required' }],
          },
          {
            type: 'select',
            id: 'affected_service',
            label: 'Affected Service',
            required: true,
            options: [
              { value: 'api-gateway',  label: 'API Gateway'       },
              { value: 'auth-service', label: 'Auth Service'       },
              { value: 'data-pipeline', label: 'Data Pipeline'     },
              { value: 'web-frontend', label: 'Web Frontend'       },
              { value: 'mobile-api',  label: 'Mobile API'         },
              { value: 'notifications', label: 'Notification Hub'  },
            ],
            validation: [{ type: 'required', message: 'Affected service is required' }],
          },
        ],
      },
      {
        id: 'voice_fields',
        title: 'Voice-Captured Narrative',
        description:
          'Click the microphone icon on any field and speak. The transcript appears in the text area below it. Edit freely before submitting.',
        fields: [
          {
            type: 'voice',
            id: 'initial_symptoms',
            label: 'Initial Symptoms',
            prompt: 'Describe what you first noticed — error messages, alerts, user reports…',
            language: 'en-US',
            continuous: false,
            interimResults: true,
            appendMode: 'replace',
            maxDurationSeconds: 90,
            required: true,
            validation: [
              { type: 'required', message: 'Please describe the initial symptoms' },
              { type: 'min', value: 10, message: 'At least 10 characters' },
            ],
          },
          {
            type: 'voice',
            id: 'timeline_of_events',
            label: 'Timeline of Events',
            prompt: 'Walk through what happened chronologically — when did the alerts fire, what was your first action…',
            language: 'en-US',
            continuous: true,
            interimResults: true,
            appendMode: 'append-space',
            maxDurationSeconds: 180,
            helpText: 'Continuous mode: mic stays open until you press Stop.',
            required: false,
          },
          {
            type: 'voice',
            id: 'root_cause_hypothesis',
            label: 'Root Cause Hypothesis',
            prompt: 'What do you believe caused this incident?',
            language: 'en-US',
            continuous: false,
            interimResults: true,
            appendMode: 'replace',
            maxDurationSeconds: 60,
            required: false,
          },
          {
            type: 'voice',
            id: 'resolution_steps',
            label: 'Resolution Steps Taken',
            prompt: 'What actions did you or your team take to mitigate or resolve the incident?',
            language: 'en-US',
            continuous: true,
            interimResults: true,
            appendMode: 'append-space',
            maxDurationSeconds: 180,
            helpText: 'Dictate each remediation action in sequence.',
            required: true,
            validation: [
              { type: 'required', message: 'Please describe resolution steps' },
            ],
          },
        ],
      },
      {
        id: 'follow_up',
        title: 'Follow-Up Actions',
        description: 'Structured fields for tracking post-incident work',
        fields: [
          {
            type: 'checkbox',
            id: 'pager_acknowledged',
            label: 'PagerDuty alert acknowledged',
            required: false,
          },
          {
            type: 'checkbox',
            id: 'status_page_updated',
            label: 'Status page updated',
            required: false,
          },
          {
            type: 'checkbox',
            id: 'postmortem_scheduled',
            label: 'Post-mortem meeting scheduled',
            required: false,
          },
          {
            type: 'text',
            id: 'jira_ticket',
            label: 'Jira Ticket',
            placeholder: 'OPS-1234',
            required: false,
            validation: [
              {
                type: 'pattern',
                pattern: '^[A-Z]+-\\d+$',
                message: 'Format: PROJECT-NUMBER (e.g. OPS-1234)',
              },
            ],
          },
          {
            type: 'voice',
            id: 'additional_notes',
            label: 'Additional Notes (optional)',
            prompt: 'Any other context, workarounds, or stakeholder communications…',
            language: 'en-US',
            continuous: false,
            interimResults: true,
            appendMode: 'replace',
            maxDurationSeconds: 60,
            required: false,
          },
        ],
      },
    ],
  },
};
