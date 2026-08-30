export type CalendarEventSource = "manual" | "assignment_due";
export type CalendarRecurrenceRule = "none" | "daily" | "weekly" | "monthly";

export interface CalendarEvent {
  id: string;
  owner_id?: string;
  course_id: string | null;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  recurrence_rule: CalendarRecurrenceRule;
  reminder_minutes: number | null;
  attendee_ids?: string[];
  source: CalendarEventSource;
}
