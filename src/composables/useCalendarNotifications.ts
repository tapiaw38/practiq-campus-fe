import { useToast } from "primevue/usetoast";
import { CalendarService } from "@/services/calendar/calendarService";
import { campusApi } from "@/api/request/server";
import type { CalendarEvent } from "@/types";

const calendarService = new CalendarService(campusApi);
const KEY = "campus_calendar_reminders";
const INTERVAL = 60_000;
let timer: ReturnType<typeof setInterval> | null = null;

function occurrenceAt(event: CalendarEvent, now: Date): Date | null {
  const start = new Date(event.starts_at);
  if (event.recurrence_rule === "none" || !event.recurrence_rule) return start;
  const candidate = new Date(start);
  while (candidate < now) {
    if (event.recurrence_rule === "daily") candidate.setDate(candidate.getDate() + 1);
    else if (event.recurrence_rule === "weekly") candidate.setDate(candidate.getDate() + 7);
    else candidate.setMonth(candidate.getMonth() + 1);
  }
  return candidate;
}

export function useCalendarNotifications() {
  const toast = useToast();
  async function check() {
    try {
      const { data } = await calendarService.listMine();
      const now = new Date();
      const notified = JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, boolean>;
      for (const event of data) {
        if (event.source !== "manual" || event.reminder_minutes == null) continue;
        const occurrence = occurrenceAt(event, now);
        if (!occurrence) continue;
        const reminderAt = occurrence.getTime() - event.reminder_minutes * 60_000;
        const key = `${event.id}:${occurrence.toISOString()}`;
        if (notified[key] || now.getTime() < reminderAt || now.getTime() > occurrence.getTime()) continue;
        notified[key] = true;
        toast.add({ severity: "info", summary: `Recordatorio: ${event.title}`, detail: `Empieza a las ${occurrence.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`, life: 8000 });
      }
      localStorage.setItem(KEY, JSON.stringify(notified));
    } catch { /* notifications must not interrupt navigation */ }
  }
  function start() { if (timer) return; check(); timer = setInterval(check, INTERVAL); }
  return { start };
}
