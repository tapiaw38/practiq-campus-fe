import { ref } from "vue";
import { campusApi } from "@/api/request/server";

const unreadCount = ref(0);
let started = false;

async function refresh() {
  try {
    const { data } = await campusApi.get<{ unread_count: number }>("/notifications/summary");
    unreadCount.value = Math.max(0, data.unread_count || 0);
  } catch {
    // A badge must never block navigation when the notification service is unavailable.
  }
}

export function useNotificationBadge() {
  function start() {
    if (started) return;
    started = true;
    void refresh();
    window.setInterval(() => void refresh(), 60_000);
  }
  return { unreadCount, start, refresh };
}
