import React, { useState, useCallback } from 'react';
import { WorkflowDataSchema, type WorkflowStep, type WorkflowStepStatus } from '@hari/core';
import { FormRenderer } from './FormRenderer';

// ─────────────────────────────────────────────────────────────────────────────
// WorkflowRenderer — renders a multi-step guided process.
//
// The component is intentionally self-contained: it manages its own current-
// step index (seeded from data.currentStepIndex) and accumulated form values.
// When the final step is confirmed the onComplete callback receives all
// collected values.
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkflowRendererProps {
  data: unknown;
  density?: 'executive' | 'operator' | 'expert';
  onExplain?: (elementId: string) => void;
  /** Called when the user completes the final step with all accumulated values. */
  onComplete?: (values: Record<string, unknown>) => void;
  /** Called when the user navigates between steps. */
  onStepChange?: (stepIndex: number, stepId: string) => void;
}

// ── Status styling ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  WorkflowStepStatus,
  { icon: string; dotBg: string; dotBorder: string; textColor: string }
> = {
  completed:   { icon: '✓', dotBg: '#22c55e', dotBorder: '#16a34a', textColor: '#166534' },
  in_progress: { icon: '●', dotBg: '#4f46e5', dotBorder: '#4338ca', textColor: '#4338ca' },
  failed:      { icon: '✕', dotBg: '#ef4444', dotBorder: '#dc2626', textColor: '#991b1b' },
  skipped:     { icon: '–', dotBg: '#94a3b8', dotBorder: '#64748b', textColor: '#64748b' },
  pending:     { icon: '',  dotBg: '#e2e8f0', dotBorder: '#cbd5e1', textColor: '#94a3b8' },
};

// ── Step content panels ────────────────────────────────────────────────────

interface StepContentProps {
  step: WorkflowStep;
  density: 'executive' | 'operator' | 'expert';
  collectedValues: Record<string, unknown>;
  onFormChange: (values: Record<string, unknown>) => void;
  onConfirm: (confirmed: boolean) => void;
}

function StepContent({ step, density, collectedValues, onFormChange, onConfirm }: StepContentProps) {
  switch (step.type) {
    case 'info':
      return step.content ? (
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: 1.65 }}>
          {step.content}
        </p>
      ) : null;

    case 'form':
      return step.fields.length > 0 ? (
        <FormRenderer
          formId={`workflow-step-${step.id}`}
          sections={[{ id: step.id, title: '', fields: step.fields, collapsible: false, defaultCollapsed: false, columns: 1 }]}
          initialValues={collectedValues}
          onChange={onFormChange}
          showSubmitButton={false}
        />
      ) : null;

    case 'confirmation':
      return (
        <div>
          {step.content && (
            <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: '#475569', lineHeight: 1.65 }}>
              {step.content}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => onConfirm(true)}
              style={{
                padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 600,
                backgroundColor: '#4f46e5', color: 'white',
                border: 'none', borderRadius: '0.375rem', cursor: 'pointer',
              }}
            >
              Confirm
            </button>
            <button
              onClick={() => onConfirm(false)}
              style={{
                padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 600,
                backgroundColor: 'white', color: '#64748b',
                border: '1px solid #cbd5e1', borderRadius: '0.375rem', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      );

    case 'review':
      return step.reviewItems.length > 0 ? (
        <dl style={{
          display: 'grid', gridTemplateColumns: 'auto 1fr',
          gap: '0.25rem 1.25rem', margin: 0,
        }}>
          {step.reviewItems.map((item, i) => (
            <React.Fragment key={i}>
              <dt style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap', paddingTop: '0.1rem' }}>
                {item.label}
              </dt>
              <dd style={{
                margin: 0, fontSize: '0.8rem',
                color: item.highlight ? '#0f172a' : '#475569',
                fontWeight: item.highlight ? 700 : 400,
              }}>
                {item.value}
              </dd>
            </React.Fragment>
          ))}
        </dl>
      ) : null;

    default:
      return null;
  }
}

// ── Step dot (for sidebar / header) ───────────────────────────────────────

function StepDot({ status, index, active }: { status: WorkflowStepStatus; index: number; active: boolean }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <div style={{
      width: '1.5rem', height: '1.5rem', borderRadius: '50%', flexShrink: 0,
      backgroundColor: active ? '#4f46e5' : cfg.dotBg,
      border: `2px solid ${active ? '#4338ca' : cfg.dotBorder}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.6rem', fontWeight: 700, color: active ? 'white' : cfg.textColor,
    }}>
      {status === 'completed' ? '✓' : status === 'failed' ? '✕' : index + 1}
    </div>
  );
}

// ── Top-level ──────────────────────────────────────────────────────────────

export function WorkflowRenderer({
  data,
  density = 'operator',
  onComplete,
  onStepChange,
}: WorkflowRendererProps) {
  const result = WorkflowDataSchema.safeParse(data);

  if (!result.success) {
    return (
      <div style={{ color: '#dc2626', fontSize: '0.8rem', padding: '1rem', fontFamily: 'monospace' }}>
        <strong>WorkflowRenderer:</strong> invalid data shape.
        <pre style={{ marginTop: '0.5rem', fontSize: '0.7rem' }}>
          {JSON.stringify(result.error.flatten(), null, 2)}
        </pre>
      </div>
    );
  }

  const wf = result.data;

  const [currentIndex, setCurrentIndex] = useState(
    Math.min(wf.currentStepIndex, wf.steps.length - 1),
  );
  const [collectedValues, setCollectedValues] = useState<Record<string, unknown>>({});
  const [stepFormValues, setStepFormValues] = useState<Record<string, unknown>>({});

  const currentStep = wf.steps[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === wf.steps.length - 1;
  const completedCount = wf.steps.filter((s) => s.status === 'completed').length;
  const progressPct = wf.steps.length > 0
    ? Math.round(((completedCount + (currentStep?.status === 'in_progress' ? 0.5 : 0)) / wf.steps.length) * 100)
    : 0;

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= wf.steps.length) return;
    setCurrentIndex(index);
    onStepChange?.(index, wf.steps[index].id);
  }, [wf.steps, onStepChange]);

  const handleNext = useCallback(() => {
    // Merge current step form values into collected
    const merged = { ...collectedValues, ...stepFormValues };
    setCollectedValues(merged);
    setStepFormValues({});
    if (isLast) {
      onComplete?.(merged);
    } else {
      goTo(currentIndex + 1);
    }
  }, [collectedValues, stepFormValues, isLast, currentIndex, goTo, onComplete]);

  const handlePrev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);

  const handleSkip = useCallback(() => {
    setStepFormValues({});
    goTo(currentIndex + 1);
  }, [currentIndex, goTo]);

  const handleConfirm = useCallback((confirmed: boolean) => {
    if (confirmed) handleNext();
    else if (!isFirst) handlePrev();
  }, [handleNext, handlePrev, isFirst]);

  // Shared visually-hidden live region markup (announced when currentIndex changes)
  const stepAnnouncement = currentStep
    ? `Step ${currentIndex + 1} of ${wf.steps.length}: ${currentStep.title}`
    : '';

  // ── Executive density: slim progress bar + current step ────────────────

  if (density === 'executive') {
    return (
      <div>
        {/* Screen-reader announcement of the active step */}
        <span
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            borderWidth: 0,
          }}
        >
          {stepAnnouncement}
        </span>
        {wf.title && (
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', marginBottom: '0.5rem' }}>
            {wf.title}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <div style={{
            flex: 1, height: '0.375rem', backgroundColor: '#e2e8f0',
            borderRadius: '9999px', overflow: 'hidden',
          }}>
            <div style={{
              width: `${progressPct}%`, height: '100%',
              backgroundColor: '#4f46e5', borderRadius: '9999px',
              transition: 'width 0.3s',
            }} />
          </div>
          <span style={{ fontSize: '0.65rem', color: '#64748b', whiteSpace: 'nowrap' }}>
            {currentIndex + 1}/{wf.steps.length}
          </span>
        </div>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>
          {currentStep?.icon && <span style={{ marginRight: '0.25rem' }}>{currentStep.icon}</span>}
          {currentStep?.title}
        </div>
        {currentStep?.description && (
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: '#64748b' }}>
            {currentStep.description}
          </p>
        )}
      </div>
    );
  }

  // ── Operator / Expert density ──────────────────────────────────────────

  return (
    <div>
      {/* Screen-reader announcement of the active step */}
      <span
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          borderWidth: 0,
        }}
      >
        {stepAnnouncement}
      </span>
      {wf.title && (
        <h3 style={{
          margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a',
          paddingBottom: '0.5rem', borderBottom: '2px solid #e2e8f0',
        }}>
          {wf.title}
        </h3>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: density === 'expert' ? '200px 1fr' : '160px 1fr',
        gap: '1.25rem',
      }}>
        {/* Step list sidebar */}
        <div>
          {wf.steps.map((step, i) => {
            const isActive = i === currentIndex;
            const cfg = STATUS_CONFIG[step.status];
            const canNavigate = wf.allowSkipAhead || i <= currentIndex || step.status === 'completed';
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => canNavigate && goTo(i)}
                aria-label={`Go to step ${i + 1}: ${step.title}`}
                aria-current={isActive ? 'step' : undefined}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                  width: '100%', padding: '0.4rem 0.5rem',
                  background: isActive ? '#eff6ff' : 'none',
                  border: isActive ? '1px solid #bfdbfe' : '1px solid transparent',
                  borderRadius: '0.375rem', cursor: canNavigate ? 'pointer' : 'default',
                  marginBottom: '0.25rem', textAlign: 'left',
                }}
              >
                <StepDot status={step.status} index={i} active={isActive} />
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.75rem', fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#1e40af' : '#475569',
                    lineHeight: 1.3,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {step.icon && <span style={{ marginRight: '0.2rem' }}>{step.icon}</span>}
                    {step.title}
                  </div>
                  {density === 'expert' && step.status !== 'pending' && (
                    <div style={{ fontSize: '0.6rem', color: cfg.textColor, marginTop: '0.1rem' }}>
                      {step.status.replace('_', ' ')}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Current step content panel */}
        <div style={{
          border: '1px solid #e2e8f0', borderRadius: '0.5rem',
          padding: '1rem', backgroundColor: '#fafafa',
          minHeight: '6rem',
        }}>
          {currentStep && (
            <>
              <div style={{ marginBottom: '0.75rem' }}>
                <h4 style={{ margin: '0 0 0.2rem', fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
                  {currentStep.icon && <span style={{ marginRight: '0.3rem' }}>{currentStep.icon}</span>}
                  {currentStep.title}
                </h4>
                {currentStep.description && (
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>
                    {currentStep.description}
                  </p>
                )}
              </div>

              <StepContent
                step={currentStep}
                density={density}
                collectedValues={{ ...collectedValues, ...stepFormValues }}
                onFormChange={setStepFormValues}
                onConfirm={handleConfirm}
              />

              {/* Navigation footer (skip confirmation type — it has its own buttons) */}
              {currentStep.type !== 'confirmation' && (
                <div style={{
                  display: 'flex', gap: '0.5rem', alignItems: 'center',
                  marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0',
                  flexWrap: 'wrap',
                }}>
                  {!isFirst && (
                    <button
                      type="button"
                      onClick={handlePrev}
                      style={{
                        padding: '0.35rem 0.875rem', fontSize: '0.78rem', fontWeight: 600,
                        backgroundColor: 'white', color: '#475569',
                        border: '1px solid #cbd5e1', borderRadius: '0.375rem', cursor: 'pointer',
                      }}
                    >
                      ← Back
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleNext}
                    style={{
                      padding: '0.35rem 0.875rem', fontSize: '0.78rem', fontWeight: 600,
                      backgroundColor: '#4f46e5', color: 'white',
                      border: 'none', borderRadius: '0.375rem', cursor: 'pointer',
                    }}
                  >
                    {isLast ? wf.finishLabel : 'Next →'}
                  </button>
                  {currentStep.skippable && !isLast && (
                    <button
                      type="button"
                      onClick={handleSkip}
                      style={{
                        padding: '0.35rem 0.5rem', fontSize: '0.72rem',
                        background: 'none', color: '#94a3b8',
                        border: 'none', cursor: 'pointer',
                      }}
                    >
                      Skip
                    </button>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#94a3b8' }}>
                    Step {currentIndex + 1} of {wf.steps.length}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
