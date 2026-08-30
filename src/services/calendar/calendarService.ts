import type { AxiosInstance } from "axios";
import type { CalendarEvent, CalendarRecurrenceRule } from "@/types";

export interface CreateEventParams {
  title: string;
  description?: string;
  starts_at: string;
  ends_at?: string;
  all_day?: boolean;
  course_id?: string | null;
  attendee_ids?: string[];
  recurrence_rule?: CalendarRecurrenceRule;
  reminder_minutes?: number | null;
}

export interface ICalendarService {
  create(params: CreateEventParams): Promise<{ data: CalendarEvent }>;
  listMine(): Promise<{ data: CalendarEvent[] }>;
  update(id: string, params: CreateEventParams): Promise<{ data: CalendarEvent }>;
  remove(id: string): Promise<void>;
}

export class CalendarService implements ICalendarService {
  constructor(private readonly api: AxiosInstance) {}

  async create(params: CreateEventParams): Promise<{ data: CalendarEvent }> {
    const { data } = await this.api.post("/calendar/events", params);
    return data;
  }

  async listMine(): Promise<{ data: CalendarEvent[] }> {
    const { data } = await this.api.get("/me/calendar");
    return data;
  }

  async update(id: string, params: CreateEventParams): Promise<{ data: CalendarEvent }> {
    const { data } = await this.api.put(`/calendar/events/${id}`, params);
    return data;
  }

  async remove(id: string): Promise<void> { await this.api.delete(`/calendar/events/${id}`); }
}
