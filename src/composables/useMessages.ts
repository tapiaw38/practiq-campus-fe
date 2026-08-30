import { ref } from "vue";
import { useToast } from "primevue/usetoast";
import { campusApi } from "@/api/request/server";
import { MessageService } from "@/services/messages/messageService";
import type { ConversationSummary, Message, MessageRecipient } from "@/types";

const messageService = new MessageService(campusApi);

export function useMessages() {
  const toast = useToast();
  const conversations = ref<ConversationSummary[]>([]);
  const messagesByConversation = ref<Record<string, Message[]>>({});
  const loading = ref(false);

  async function loadConversations() {
    loading.value = true;
    try {
      const { data } = await messageService.listConversations();
      conversations.value = data;
      return data;
    } finally {
      loading.value = false;
    }
  }

  async function loadMessages(conversationId: string) {
    const { data } = await messageService.listMessages(conversationId);
    messagesByConversation.value = { ...messagesByConversation.value, [conversationId]: data };
    return data;
  }

  async function sendNew(recipientId: string, body: string) {
    try {
      const { data } = await messageService.send(recipientId, body);
      messagesByConversation.value = {
        ...messagesByConversation.value,
        [data.conversation_id]: [
          ...(messagesByConversation.value[data.conversation_id] || []),
          data,
        ],
      };
      await loadConversations();
      return data;
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "No se pudo enviar el mensaje";
      toast.add({ severity: "error", summary: "Error", detail: message, life: 3500 });
      throw error;
    }
  }

  async function reply(conversationId: string, body: string) {
    try {
      const { data } = await messageService.reply(conversationId, body);
      messagesByConversation.value = {
        ...messagesByConversation.value,
        [conversationId]: [...(messagesByConversation.value[conversationId] || []), data],
      };
      return data;
    } catch (error) {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "No se pudo enviar la respuesta",
        life: 3000,
      });
      throw error;
    }
  }

  async function broadcast(courseId: string, body: string) {
    try {
      const { data } = await messageService.broadcast(courseId, body);
      toast.add({
        severity: "success",
        summary: `Mensaje enviado a ${data.sent} alumno(s)`,
        life: 2500,
      });
      return data;
    } catch (error) {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "No se pudo enviar el mensaje masivo",
        life: 3000,
      });
      throw error;
    }
  }

  async function searchRecipients(courseId: string, query: string): Promise<MessageRecipient[]> {
    const { data } = await messageService.searchRecipients(courseId, query);
    return data;
  }

  async function markRead(conversationId: string) {
    conversations.value = conversations.value.map((c) =>
      c.id === conversationId ? { ...c, unread: false } : c,
    );
    try {
      await messageService.markRead(conversationId);
    } catch {
      // a failed mark-read isn't worth surfacing — worst case it stays
      // marked unread until the next successful poll
    }
  }

  return {
    conversations,
    messagesByConversation,
    loading,
    loadConversations,
    loadMessages,
    sendNew,
    reply,
    broadcast,
    searchRecipients,
    markRead,
  };
}
