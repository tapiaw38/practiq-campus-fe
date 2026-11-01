import { ref } from "vue";
import { campusApi } from "@/api/request/server";

const unreadCount = ref(0);
let started = false;

async function refresh() {
  try {
    const { data } = await campusApi.get<{ unread_count: number }>("/notifications/summary");
    unreadCount.value = Math.max(0, data.unread_count || 0);
  } catch {
  }
}

async function acknowledge() {
  const previous = unreadCount.value;
  unreadCount.value = 0;
  try {
    const { data } = await campusApi.get<{ data: Array<{ id: string; read_at: string | null }> }>("/notifications");
    await Promise.all(
      data.data
        .filter((notification) => !notification.read_at)
        .map((notification) => campusApi.put(`/notifications/${notification.id}/read`)),
    );
  } catch {
    unreadCount.value = previous;
    void refresh();
  }
}

export function useNotificationBadge() {
  function start() {
    if (started) return;
    started = true;
    void refresh();
    window.setInterval(() => void refresh(), 60_000);
  }
  return { unreadCount, start, refresh, acknowledge };
}
