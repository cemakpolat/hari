import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Calendar Schema
//
// The calendar intent type renders a month/week/agenda view for scheduling
// and planning events. Use it for meeting schedules, project milestones,
// on-call rotas, release calendars, or any date-anchored planning view.
//
// Density mapping:
//   executive — month grid showing event counts per day, no detail
//   operator  — week view with event titles and times
//   expert    — full detail: descriptions, attendees, recurrence, metadata
// ─────────────────────────────────────────────────────────────────────────────

export const CalendarEventStatusSchema = z.enum([
  'confirmed',
  'tentative',
  'cancelled',
]);

export type CalendarEventStatus = z.infer<typeof CalendarEventStatusSchema>;

export const CalendarEventSchema = z.object({
  /** Unique event identifier */
  id: z.string(),
  /** Short event title */
  title: z.string(),
  /** Optional longer description */
  description: z.string().optional(),
  /** ISO 8601 start datetime (date-only for all-day events) */
  start: z.string(),
  /** ISO 8601 end datetime (date-only for all-day events) */
  end: z.string(),
  /** Whether this is an all-day event (no time component) */
  allDay: z.boolean().default(false),
  /** Logical category for colour-coding (e.g. "team", "release", "oncall") */
  category: z.string().optional(),
  /** Accent colour override (CSS colour string) */
  color: z.string().optional(),
  /** Attendee names / handles */
  attendees: z.array(z.string()).default([]),
  /** Physical or virtual location */
  location: z.string().optional(),
  /** Confirmation status */
  status: CalendarEventStatusSchema.default('confirmed'),
  /** Human-readable recurrence rule (e.g. "Every Monday") */
  recurrence: z.string().optional(),
  /** Extra key-value metadata shown in expert density */
  metadata: z.record(z.string(), z.unknown()).optional(),
  /** Links to an explainability entry in the parent IntentPayload */
  explainElementId: z.string().optional(),
});

export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export const CalendarDataSchema = z.object({
  /** Optional heading rendered above the calendar */
  title: z.string().optional(),
  /** The events to display */
  events: z.array(CalendarEventSchema),
  /**
   * Default view mode.
   * @default 'month'
   */
  view: z.enum(['month', 'week', 'agenda']).default('month'),
  /**
   * ISO 8601 date that is shown as the active day / "today" anchor.
   * Defaults to the current date if omitted.
   */
  focusDate: z.string().optional(),
  /**
   * Start-of-week day (0 = Sunday, 1 = Monday).
   * @default 1
   */
  weekStartsOn: z.number().int().min(0).max(1).default(1),
  /**
   * In executive density, show at most this many events per day cell.
   * @default 3
   */
  executiveCap: z.number().int().positive().default(3),
});

export type CalendarData = z.infer<typeof CalendarDataSchema>;
