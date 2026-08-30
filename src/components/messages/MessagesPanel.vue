<script setup lang="ts">
  import { computed, nextTick, onMounted, ref, watch } from "vue";
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
  const conversationQuery = ref("");
  const showCompose = ref(false);
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

  const filteredConversations = computed(() => {
    const query = conversationQuery.value.trim().toLocaleLowerCase();
    if (!query) return conversations.value;
    return conversations.value.filter((conversation) =>
      [conversation.other_user_name, conversation.other_user_email, conversation.last_message_body]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase().includes(query)),
    );
  });

  const selectedConversation = computed(
    () => conversations.value.find((conversation) => conversation.id === selectedConversationId.value) || null,
  );

  onMounted(async () => {
    const loadedConversations = await loadConversations();
    if (loadedConversations.length) await selectConversation(loadedConversations[0].id);
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
      showCompose.value = false;
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

  // Without this the preview of a message you sent reads exactly like an
  // incoming one, so your own last word looks like something to answer.
  function conversationPreview(conv: { last_message_body: string; last_message_sender_id: string }) {
    const mine = conv.last_message_sender_id === authStore.profile?.id;
    return mine ? `Vos: ${conv.last_message_body}` : conv.last_message_body;
  }

  function initial(name: string) {
    return (name || "?").slice(0, 1).toUpperCase();
  }
</script>

<template>
  <div class="messages-panel">
    <header class="messages-header">
      <div>
        <p class="eyebrow">Comunicación</p>
        <h1>Mensajes</h1>
        <p class="messages-subtitle">Conversá con docentes y compañeros de tus cursos.</p>
      </div>
      <Button label="Nuevo mensaje" icon="pi pi-plus" @click="showCompose = true" />
    </header>

    <section class="messages-layout" aria-label="Conversaciones">
      <aside class="conversation-sidebar">
        <div class="conversation-sidebar__head">
          <div>
            <h2>Conversaciones</h2>
            <span>{{ conversations.length }} {{ conversations.length === 1 ? "conversación" : "conversaciones" }}</span>
          </div>
          <i class="pi pi-comments" aria-hidden="true"></i>
        </div>
        <div class="conversation-search">
          <i class="pi pi-search" aria-hidden="true"></i>
          <InputText v-model="conversationQuery" placeholder="Buscar mensajes" aria-label="Buscar conversaciones" />
        </div>
        <div class="conversation-list">
          <div v-if="loading" class="state-message state-message--compact">Cargando…</div>
          <div v-else-if="!conversations.length" class="state-message state-message--compact">
            Aún no tenés conversaciones.
          </div>
          <div v-else-if="!filteredConversations.length" class="state-message state-message--compact">
            No hay coincidencias.
          </div>
        <button
          v-for="conv in filteredConversations"
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
            <span class="conversation-preview">{{ conversationPreview(conv) }}</span>
          </span>
          <span v-if="isUnread(conv)" class="unread-dot"></span>
        </button>
        </div>
      </aside>

      <main class="thread-panel">
        <div v-if="!selectedConversationId" class="empty-thread">
          <span class="empty-thread__icon"><i class="pi pi-comments"></i></span>
          <h2>Elegí una conversación</h2>
          <p>Seleccioná un chat de la lista o iniciá uno nuevo.</p>
          <Button label="Nuevo mensaje" icon="pi pi-plus" outlined @click="showCompose = true" />
        </div>
        <template v-else>
          <header class="thread-header">
            <span class="thread-avatar">{{ initial(selectedConversation?.other_user_name || selectedConversation?.other_user_email || "?") }}</span>
            <div>
              <h2>{{ selectedConversation?.other_user_name || selectedConversation?.other_user_email }}</h2>
              <p>{{ selectedConversation?.other_user_email }}</p>
            </div>
          </header>
          <ul class="message-list">
            <li
              v-for="msg in messagesByConversation[selectedConversationId] || []"
              :key="msg.id"
              class="message-item"
              :class="{ 'message-item--mine': msg.sender_id === authStore.profile?.id }"
            >
              <p class="message-body">{{ msg.body }}</p>
              <span class="message-time">{{ new Date(msg.sent_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) }}</span>
            </li>
            <li ref="threadEnd"></li>
          </ul>
          <form class="reply-form" @submit.prevent="handleReply">
            <Textarea
              v-model="replyBody"
              class="reply-input"
              rows="2"
              auto-resize
              placeholder="Escribí tu respuesta… (Enter para enviar, Shift+Enter para saltar línea)"
              @keydown.enter.exact.prevent="handleReply"
            />
            <Button type="submit" label="Enviar" size="small" :loading="sendingReply" />
          </form>
        </template>
      </main>
    </section>

    <Dialog v-model:visible="showCompose" modal header="Nuevo mensaje" :style="{ width: 'min(560px, calc(100vw - 2rem))' }">
      <p class="dialog-lead">Elegí curso y destinatario. Solo aparecen personas con un curso en común.</p>
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
        <Textarea
          v-model="newBody"
          class="body-input"
          rows="2"
          auto-resize
          placeholder="Escribí tu mensaje…"
          @keydown.enter.exact.prevent="handleSendNew"
        />
        <Button
          type="submit"
          label="Enviar"
          size="small"
          :loading="sendingNew"
          :disabled="!selectedRecipient || !newBody.trim()"
        />
      </form>
      <p class="hint">Se abrirá conversación privada con esta persona.</p>
    </Dialog>
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
    margin-top: var(--space-5);
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

  /* Button hugs the last line so it stays put as the textarea grows. */
  .compose-form {
    display: flex;
    align-items: flex-end;
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

  /* Chat workspace: one clear area for inbox, one for current conversation. */
  .messages-panel { max-width: 1180px; }
  .messages-header { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--space-4); margin-bottom: var(--space-4); }
  .eyebrow { margin: 0 0 3px; color: var(--practiq-violet-dark); font-size: var(--text-xs); font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  .messages-panel h1 { margin: 0; font-size: 24px; }
  .messages-subtitle, .dialog-lead { margin: var(--space-1) 0 0; color: var(--text-secondary); font-size: var(--text-sm); }
  .messages-layout { grid-template-columns: minmax(270px, 340px) minmax(0, 1fr); gap: 0; min-height: 610px; border: 1px solid var(--surface-border); border-radius: var(--radius-lg); overflow: hidden; background: var(--surface-card); box-shadow: var(--shadow-card); }
  .conversation-sidebar { display: flex; min-height: 0; flex-direction: column; padding: var(--space-3); border-right: 1px solid var(--surface-border); background: var(--surface-subtle, var(--surface-card)); }
  .conversation-sidebar__head { display: flex; align-items: center; justify-content: space-between; padding: var(--space-1) var(--space-1) var(--space-3); }
  .conversation-sidebar__head h2 { margin: 0; color: var(--text-heading); font-size: var(--text-base); }
  .conversation-sidebar__head span { color: var(--text-muted); font-size: var(--text-xs); }
  .conversation-sidebar__head > i { color: var(--practiq-violet-dark); font-size: 18px; }
  .conversation-search { position: relative; margin-bottom: var(--space-3); }
  .conversation-search > i { position: absolute; z-index: 1; top: 50%; left: 11px; color: var(--text-muted); font-size: 13px; transform: translateY(-50%); }
  .conversation-search :deep(input) { width: 100%; padding-left: 32px; }
  .conversation-list { min-height: 0; flex: 1; gap: 4px; overflow-y: auto; }
  .state-message { text-align: center; }
  .state-message--compact { padding: var(--space-4) var(--space-2); background: transparent; }
  .conversation-item { padding: var(--space-2); background: transparent; box-shadow: none; }
  .conversation-item:hover:not(.conversation-item--active) { background: var(--surface-hover); }
  .thread-panel { min-width: 0; gap: 0; background: var(--surface-card); }
  .thread-header { display: flex; align-items: center; gap: var(--space-3); min-height: 76px; padding: var(--space-3) var(--space-5); border-bottom: 1px solid var(--surface-border); }
  .thread-header h2 { margin: 0; color: var(--text-heading); font-size: var(--text-base); }
  .thread-header p { margin: 2px 0 0; color: var(--text-muted); font-size: var(--text-xs); }
  .thread-avatar { display: grid; width: 38px; height: 38px; flex: 0 0 auto; border-radius: 50%; place-items: center; background: var(--fill-primary-soft); color: var(--practiq-violet-dark); font-size: var(--text-sm); font-weight: 800; }
  .message-list { flex: 1; padding: var(--space-5); min-height: 380px; max-height: none; }
  .message-item { max-width: min(75%, 580px); border: 1px solid var(--surface-border); border-radius: var(--radius-md) var(--radius-md) var(--radius-md) 3px; }
  .message-item--mine { border-color: transparent; border-radius: var(--radius-md) var(--radius-md) 3px var(--radius-md); }
  .reply-form { align-items: flex-end; padding: var(--space-3) var(--space-5) var(--space-4); border-top: 1px solid var(--surface-border); background: var(--surface-card); }
  .empty-thread { display: grid; flex: 1; place-content: center; padding: var(--space-6); text-align: center; }
  .empty-thread__icon { display: grid; width: 52px; height: 52px; margin: 0 auto var(--space-3); border-radius: 50%; place-items: center; background: var(--fill-primary-soft); color: var(--practiq-violet-dark); font-size: 21px; }
  .empty-thread h2 { margin: 0; color: var(--text-heading); font-size: 18px; }
  .empty-thread p { margin: var(--space-2) 0 var(--space-4); color: var(--text-secondary); font-size: var(--text-sm); }

  @media (max-width: 720px) {
    .messages-header { align-items: stretch; flex-direction: column; }
    .messages-header :deep(.p-button) { width: 100%; justify-content: center; }
    .messages-layout { min-height: auto; gap: 0; overflow: visible; box-shadow: none; }
    .conversation-sidebar { border-right: none; border-bottom: 1px solid var(--surface-border); }
    .conversation-list { max-height: 250px; }
    .thread-panel { min-height: 500px; }
    .thread-header, .reply-form { padding-left: var(--space-3); padding-right: var(--space-3); }
    .message-list { padding: var(--space-3); }
    .message-item { max-width: 88%; }
  }
</style>
