import { computed, ref } from "vue";
import { campusApi } from "@/api/request/server";
import { MessageService } from "@/services/messages/messageService";
import { CalendarService } from "@/services/calendar/calendarService";
import { PreferenceService } from "@/services/preferences/preferenceService";
import { CourseService } from "@/services/courses/courseService";
import { AssignmentService } from "@/services/assignments/assignmentService";
import { SubmissionService } from "@/services/submissions/submissionService";
import type { CalendarEvent } from "@/types";

export type CampusNotificationKind = "message" | "assignment" | "event" | "grade";
export interface CampusNotification {
  id: string;
  kind: CampusNotificationKind;
  title: string;
  detail: string;
  createdAt: string;
  to: string;
  read: boolean;
  persistent?: boolean;
}

const messages = new MessageService(campusApi);
const calendar = new CalendarService(campusApi);
const preferences = new PreferenceService(campusApi);
const courses = new CourseService(campusApi);
const assignments = new AssignmentService(campusApi);
const submissions = new SubmissionService(campusApi);
const SCOPE = "notifications";

function eventNotification(event: CalendarEvent, role: "student" | "teacher"): CampusNotification | null {
  if (!event.title?.trim()) return null;
  const startsAt = new Date(event.starts_at);
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (startsAt < now || startsAt > weekAhead) return null;
  const prefix = event.source === "assignment_due" ? "Entrega próxima" : "Evento próximo";
  const coursePath = event.course_id ? `/${role}/courses/${event.course_id}` : `/${role}/calendar`;
  return {
    id: `${event.source}:${event.id}:${event.starts_at}`,
    kind: event.source === "assignment_due" ? "assignment" : "event",
    title: `${prefix}: ${event.title}`,
    detail: startsAt.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: event.all_day ? undefined : "short" }),
    createdAt: event.starts_at,
    to: coursePath,
    read: false,
  };
}

async function academicNotifications(role: "student" | "teacher"): Promise<CampusNotification[]> {
  const { data: courseList } = await courses.list();
  const grouped = await Promise.all(courseList.map(async (course) => {
    const { data: assignmentList } = await assignments.listByCourse(course.id);
    return Promise.all(assignmentList.map(async (assignment) => {
      if (role === "teacher") {
        const { data } = await submissions.listByAssignment(assignment.id);
        return data.map((submission) => ({
          id: `submission:${submission.id}:${submission.submitted_at}`,
          kind: "assignment" as const,
          title: `Nueva entrega: ${assignment.title}`,
          detail: `${submission.user_name || "(sin nombre)"} · ${course.title}`,
          createdAt: submission.submitted_at,
          to: `/teacher/courses/${course.id}/assignments/${assignment.id}/submissions`,
          read: false,
        } as CampusNotification));
      }
      const { data: submission } = await submissions.getMine(assignment.id);
      const items: CampusNotification[] = [{ id: `assignment:${assignment.id}:${assignment.created_at}`, kind: "assignment", title: `Nueva tarea: ${assignment.title}`, detail: course.title, createdAt: assignment.created_at, to: `/student/courses/${course.id}`, read: false }];
      if (submission?.graded_at && submission.score != null) items.push({ id: `grade:${submission.id}:${submission.graded_at}`, kind: "grade", title: `Calificación publicada: ${assignment.title}`, detail: `${submission.score}/${assignment.max_score} · ${course.title}`, createdAt: submission.graded_at, to: `/student/courses/${course.id}`, read: false });
      return items;
    }));
  }));
  return grouped.flat(2);
}

export function useNotifications(role: "student" | "teacher") {
  const items = ref<CampusNotification[]>([]);
  const loading = ref(false);
  const readIds = ref<string[]>([]);
  const unreadCount = computed(() => items.value.filter((item) => !item.read).length);

  async function load() {
    loading.value = true;
    try {
      const [conversations, events, saved, academicItems, persisted] = await Promise.all([
        messages.listConversations(),
        calendar.listMine(),
        preferences.get<{ read_ids?: string[] }>(SCOPE).catch(() => ({
          scope: SCOPE,
          settings: {} as { read_ids?: string[] },
        })),
        academicNotifications(role),
        campusApi.get<{ data: { id: string; type: CampusNotificationKind; title: string; body: string; data: string; read_at: string | null; created_at: string }[] }>("/notifications").catch(() => ({ data: { data: [] } })),
      ]);
      readIds.value = saved.settings.read_ids || [];
      const messageItems = conversations.data
        .filter((conversation) => conversation.unread && conversation.last_message_at)
        .map((conversation) => ({
          id: `message:${conversation.id}:${conversation.last_message_at}`,
          kind: "message" as const,
          title: conversation.other_user_name || conversation.other_user_email || "Nuevo mensaje",
          detail: conversation.last_message_body,
          createdAt: conversation.last_message_at as string,
          to: `/${role}/messages`,
          read: false,
        }));
      const eventItems = events.data
        .map((event) => eventNotification(event, role))
        .filter((item): item is CampusNotification => item !== null);
      const persistedItems = persisted.data.data.map((item) => ({ id: item.id, kind: item.type, title: item.title, detail: item.body, createdAt: item.created_at, to: `/${role}/dashboard`, read: !!item.read_at, persistent: true } as CampusNotification));
      // Different notification sources are merged here. Ignore malformed or
      // legacy records rather than rendering empty cards in the activity feed.
      items.value = [...messageItems, ...eventItems, ...academicItems, ...persistedItems]
        .filter((item) => (item.title || "").trim() || (item.detail || "").trim())
        .map((item) => ({ ...item, read: item.read || readIds.value.includes(item.id) }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } finally {
      loading.value = false;
    }
  }

  async function markAllRead() {
    const ids = [...new Set([...readIds.value, ...items.value.map((item) => item.id)])].slice(-300);
    readIds.value = ids;
    items.value = items.value.map((item) => ({ ...item, read: true }));
    await preferences.update(SCOPE, { read_ids: ids });
  }

  async function markRead(id: string) {
    if (items.value.find((item) => item.id === id)?.persistent) { await campusApi.put(`/notifications/${id}/read`); items.value = items.value.map((item) => item.id === id ? { ...item, read: true } : item); return; }
    if (readIds.value.includes(id)) return;
    const ids = [...readIds.value, id].slice(-300);
    readIds.value = ids;
    items.value = items.value.map((item) => item.id === id ? { ...item, read: true } : item);
    await preferences.update(SCOPE, { read_ids: ids });
  }

  return { items, loading, unreadCount, load, markAllRead, markRead };
}
