import { ref } from "vue";
import { useToast } from "primevue/usetoast";
import { campusApi } from "@/api/request/server";
import { MessageService } from "@/services/messages/messageService";
import { useAuthStore } from "@/stores/authStore";

const messageService = new MessageService(campusApi);

const NOTIFIED_KEY = "campus_messages_notified";
const POLL_INTERVAL_MS = 20000;

function loadMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveMap(map: Record<string, string>) {
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(map));
}

const unreadCount = ref(0);
let notified = loadMap();
let intervalId: ReturnType<typeof setInterval> | null = null;

export function useMessageNotifications() {
  const toast = useToast();
  const authStore = useAuthStore();

  async function poll(withToast: boolean) {
    try {
      const { data } = await messageService.listConversations();
      unreadCount.value = data.filter((c) => c.unread).length;

      if (withToast) {
        for (const conv of data) {
          if (!conv.unread || !conv.last_message_at) continue;
          if (conv.last_message_sender_id === authStore.profile?.id) continue;
          if (notified[conv.id] && conv.last_message_at <= notified[conv.id]) continue;
          notified = { ...notified, [conv.id]: conv.last_message_at };
          saveMap(notified);
          toast.add({
            severity: "info",
            summary: conv.other_user_name || conv.other_user_email || "Nuevo mensaje",
            detail: conv.last_message_body,
            life: 5000,
          });
        }
      } else {
        for (const conv of data) {
          if (conv.last_message_at && !notified[conv.id]) {
            notified = { ...notified, [conv.id]: conv.last_message_at };
          }
        }
        saveMap(notified);
      }
    } catch {
    }
  }

  function start() {
    if (intervalId) return;
    poll(false);
    intervalId = setInterval(() => poll(true), POLL_INTERVAL_MS);
  }

  return { unreadCount, start };
}
