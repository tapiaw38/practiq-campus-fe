<script setup lang="ts">
  import { nextTick, onMounted, ref, watch } from "vue";
  import { useAuthStore } from "@/stores/authStore";
  import { useMessages } from "@/composables/useMessages";
  import { useCourses } from "@/composables/useCourses";
  import type { MessageRecipient } from "@/types";

  const authStore = useAuthStore();
  const { courses, loadCourses } = useCourses();
  const {
    conversations,
    messagesByConversation,
    loading,
    loadConversations,
    loadMessages,
    sendNew,
    reply,
    searchRecipients,
    markRead,
  } = useMessages();

  const selectedConversationId = ref<string | null>(null);
  const replyBody = ref("");
  const sendingReply = ref(false);
  const threadEnd = ref<HTMLElement | null>(null);

  const composeCourseId = ref("");
  const recipientQuery = ref("");
  const recipientResults = ref<MessageRecipient[]>([]);
  const selectedRecipient = ref<MessageRecipient | null>(null);
  const searching = ref(false);
  const newBody = ref("");
  const sendingNew = ref(false);
  let searchDebounce: ReturnType<typeof setTimeout> | null = null;

  onMounted(async () => {
    loadConversations();
    const myCourses = await loadCourses();
    if (myCourses.length && !composeCourseId.value) {
      composeCourseId.value = myCourses[0].id;
    }
  });

  watch(recipientQuery, (query) => {
    selectedRecipient.value = null;
    if (searchDebounce) clearTimeout(searchDebounce);
    if (!composeCourseId.value || !query.trim()) {
      recipientResults.value = [];
      return;
    }
    searchDebounce = setTimeout(async () => {
      searching.value = true;
      try {
        recipientResults.value = await searchRecipients(composeCourseId.value, query.trim());
      } finally {
        searching.value = false;
      }
    }, 300);
  });

  watch(composeCourseId, () => {
    recipientQuery.value = "";
    recipientResults.value = [];
    selectedRecipient.value = null;
  });

  function pickRecipient(recipient: MessageRecipient) {
    selectedRecipient.value = recipient;
    recipientQuery.value = recipient.full_name || recipient.email;
    recipientResults.value = [];
  }

  function clearRecipient() {
    selectedRecipient.value = null;
    recipientQuery.value = "";
  }

  async function scrollToBottom() {
    await nextTick();
    threadEnd.value?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  async function selectConversation(conversationId: string) {
    selectedConversationId.value = conversationId;
    await loadMessages(conversationId);
    const conv = conversations.value.find((c) => c.id === conversationId);
    if (conv?.unread) markRead(conversationId);
    scrollToBottom();
  }

  async function handleReply() {
    if (!selectedConversationId.value || !replyBody.value.trim() || sendingReply.value) return;
    sendingReply.value = true;
    try {
      await reply(selectedConversationId.value, replyBody.value.trim());
      replyBody.value = "";
      scrollToBottom();
    } catch {
      // useMessages already surfaced the error via toast
    } finally {
      sendingReply.value = false;
    }
  }

  async function handleSendNew() {
    if (!selectedRecipient.value || !newBody.value.trim() || sendingNew.value) return;
    sendingNew.value = true;
    try {
      const message = await sendNew(selectedRecipient.value.id, newBody.value.trim());
      selectedConversationId.value = message.conversation_id;
      await loadMessages(message.conversation_id);
      clearRecipient();
      newBody.value = "";
      scrollToBottom();
    } catch {
      // useMessages already surfaced the error via toast
    } finally {
      sendingNew.value = false;
    }
  }

  function isUnread(conv: { id: string; unread: boolean }) {
    return conv.unread && selectedConversationId.value !== conv.id;
  }

  function relativeTime(iso: string | null) {
    if (!iso) return "";
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return "ahora";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  function initial(name: string) {
    return (name || "?").slice(0, 1).toUpperCase();
  }
</script>

<template>
  <div class="messages-panel">
    <h1>Mensajes</h1>

    <div class="compose-card">
      <span class="compose-label">Nuevo mensaje</span>
      <div class="compose-row">
        <Select
          v-model="composeCourseId"
          :options="courses"
          option-label="title"
          option-value="id"
          placeholder="Curso"
          class="compose-course"
        />
        <div class="recipient-search">
          <InputText
            v-model="recipientQuery"
            placeholder="Buscar por nombre o email…"
            :disabled="!composeCourseId"
          />
          <ul v-if="recipientResults.length && !selectedRecipient" class="recipient-results">
            <li
              v-for="candidate in recipientResults"
              :key="candidate.id"
              class="recipient-option"
              @click="pickRecipient(candidate)"
            >
              <span class="recipient-avatar">{{ initial(candidate.full_name || candidate.email) }}</span>
              <span class="recipient-info">
                <span class="recipient-name">{{ candidate.full_name || candidate.email }}</span>
                <span v-if="candidate.full_name" class="recipient-email">{{ candidate.email }}</span>
              </span>
            </li>
          </ul>
          <p v-else-if="searching" class="search-hint">Buscando…</p>
          <p
            v-else-if="recipientQuery && !selectedRecipient && !recipientResults.length"
            class="search-hint"
          >
            Nadie coincide en ese curso.
          </p>
        </div>
      </div>
      <div v-if="selectedRecipient" class="selected-recipient">
        Para: <strong>{{ selectedRecipient.full_name || selectedRecipient.email }}</strong>
        <button type="button" class="clear-recipient" @click="clearRecipient">
          <i class="pi pi-times"></i>
        </button>
      </div>
      <form class="compose-form" @submit.prevent="handleSendNew">
        <InputText v-model="newBody" placeholder="Escribí tu mensaje…" class="body-input" />
        <Button
          type="submit"
          label="Enviar"
          size="small"
          :loading="sendingNew"
          :disabled="!selectedRecipient || !newBody.trim()"
        />
      </form>
      <p class="hint">Solo podés escribirle a alguien de un curso en común.</p>
    </div>

    <div class="messages-layout">
      <div class="conversation-list">
        <div v-if="loading" class="state-message">Cargando…</div>
        <div v-else-if="!conversations.length" class="state-message">
          Todavía no tenés conversaciones.
        </div>
        <button
          v-for="conv in conversations"
          :key="conv.id"
          type="button"
          class="conversation-item"
          :class="{ 'conversation-item--active': selectedConversationId === conv.id }"
          @click="selectConversation(conv.id)"
        >
          <span class="conversation-avatar">{{ initial(conv.other_user_name || conv.other_user_email) }}</span>
          <span class="conversation-main">
            <span class="conversation-top">
              <span class="conversation-name">
                {{ conv.other_user_name || conv.other_user_email }}
              </span>
              <span class="conversation-time">{{ relativeTime(conv.last_message_at) }}</span>
            </span>
            <span class="conversation-preview">{{ conv.last_message_body }}</span>
          </span>
          <span v-if="isUnread(conv)" class="unread-dot"></span>
        </button>
      </div>

      <div class="thread-panel">
        <div v-if="!selectedConversationId" class="state-message">
          Elegí una conversación, o escribí un mensaje nuevo arriba.
        </div>
        <template v-else>
          <ul class="message-list">
            <li
              v-for="msg in messagesByConversation[selectedConversationId] || []"
              :key="msg.id"
              class="message-item"
              :class="{ 'message-item--mine': msg.sender_id === authStore.profile?.id }"
            >
              <p class="message-body">{{ msg.body }}</p>
              <span class="message-time">{{ new Date(msg.sent_at).toLocaleString() }}</span>
            </li>
            <li ref="threadEnd"></li>
          </ul>
          <form class="reply-form" @submit.prevent="handleReply">
            <InputText v-model="replyBody" placeholder="Responder…" class="reply-input" />
            <Button type="submit" label="Enviar" size="small" :loading="sendingReply" />
          </form>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .messages-panel {
    max-width: 960px;
  }

  .messages-panel h1 {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-heading);
    margin-bottom: var(--space-3);
  }

  .compose-card {
    padding: var(--space-4);
    border-radius: var(--radius-lg);
    background: var(--surface-card);
    box-shadow: var(--shadow-card);
    margin-bottom: var(--space-5);
  }

  .compose-label {
    display: block;
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    margin-bottom: var(--space-2);
  }

  .compose-row {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }

  .compose-course {
    flex-shrink: 0;
    width: 200px;
  }

  .recipient-search {
    position: relative;
    flex: 1;
  }

  .recipient-search :deep(input) {
    width: 100%;
  }

  .recipient-results {
    position: absolute;
    z-index: 10;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    list-style: none;
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-card-lg);
    max-height: 240px;
    overflow-y: auto;
  }

  .recipient-option {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
  }

  .recipient-option:hover {
    background: var(--surface-hover);
  }

  .recipient-avatar,
  .conversation-avatar {
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--fill-primary-soft);
    color: var(--practiq-violet-dark);
    font-weight: 700;
    font-size: var(--text-xs);
  }

  .recipient-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .recipient-name {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-primary);
  }

  .recipient-email {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .search-hint {
    position: absolute;
    margin: var(--space-1) 0 0;
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .selected-recipient {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin-bottom: var(--space-2);
  }

  .clear-recipient {
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
  }

  .compose-form {
    display: flex;
    gap: var(--space-2);
  }

  .body-input {
    flex: 1;
  }

  .hint {
    font-size: var(--text-xs);
    color: var(--text-muted);
    margin: var(--space-2) 0 0;
  }

  .state-message {
    padding: var(--space-6);
    border-radius: var(--radius-lg);
    background: var(--surface-card);
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }

  .messages-layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: var(--space-4);
  }

  .conversation-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .conversation-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--surface-card);
    box-shadow: var(--shadow-card);
    border: none;
    cursor: pointer;
    text-align: left;
    position: relative;
  }

  .conversation-item--active {
    background: var(--fill-primary-soft);
  }

  .conversation-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .conversation-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .conversation-name {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .conversation-time {
    flex-shrink: 0;
    font-size: 10px;
    color: var(--text-muted);
  }

  .conversation-preview {
    font-size: var(--text-xs);
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .unread-dot {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-error);
  }

  .thread-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .message-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4);
    border-radius: var(--radius-lg);
    background: var(--surface-card);
    box-shadow: var(--shadow-card);
    min-height: 320px;
    max-height: 480px;
    overflow-y: auto;
  }

  .message-item {
    align-self: flex-start;
    max-width: 70%;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--surface-hover);
  }

  .message-item--mine {
    align-self: flex-end;
    background: var(--fill-primary-soft);
  }

  .message-body {
    font-size: var(--text-sm);
    color: var(--text-primary);
    white-space: pre-wrap;
  }

  .message-time {
    font-size: 10px;
    color: var(--text-muted);
  }

  .reply-form {
    display: flex;
    gap: var(--space-2);
  }

  .reply-input {
    flex: 1;
  }

  @media (max-width: 720px) {
    .messages-layout {
      grid-template-columns: 1fr;
    }

    .compose-row {
      flex-direction: column;
    }

    .compose-course {
      width: 100%;
    }
  }
</style>
