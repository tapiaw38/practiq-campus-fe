<script setup lang="ts">
  import StateMessage from "@/components/ui/StateMessage.vue";
  import { formatDateTime } from "@/utils/datetime";
  import { computed, onMounted, ref } from "vue";
  import { useRoute, useRouter } from "vue-router";
  import StudentLayout from "@/layouts/StudentLayout.vue";
  import TeacherLayout from "@/layouts/TeacherLayout.vue";
  import { storeToRefs } from "pinia";
  import { useAuthStore } from "@/stores/authStore";
  import { useForum } from "@/composables/useForum";
  import ForumPostTree from "@/components/forum/ForumPostTree.vue";

  const route = useRoute();
  const router = useRouter();
  const courseId = route.params.courseId as string;
  const threadId = route.params.threadId as string;
  const { threads, postsByThread, loadThreads, loadPosts, createPost, updateThread } = useForum();
  const { isTeacher } = storeToRefs(useAuthStore());
  const reply = ref("");
  const posting = ref(false);
  const loadingMore = ref(false);
  const hasMorePosts = ref(false);
  const rootOffset = ref(0);
  const editingThread = ref(false);
  const threadTitleDraft = ref("");
  const threadDescriptionDraft = ref("");
  const savingThread = ref(false);
  const thread = computed(() => threads.value.find((item) => item.id === threadId));
  const posts = computed(() => postsByThread.value[threadId] || []);
  const rootPosts = computed(() => posts.value.filter((post) => !post.parent_post_id));

  onMounted(async () => {
    await loadThreads(courseId);
    const result = await loadPosts(threadId, { limit: 20, offset: 0 });
    hasMorePosts.value = result.has_more;
  });

  async function submitReply() {
    if (!reply.value.trim() || posting.value) return;
    posting.value = true;
    try {
      await createPost(threadId, reply.value.trim());
      reply.value = "";
      await refreshPosts();
    } finally {
      posting.value = false;
    }
  }

  async function loadOlderPosts() {
    if (loadingMore.value || !hasMorePosts.value) return;
    loadingMore.value = true;
    try {
      rootOffset.value += 20;
      const result = await loadPosts(threadId, { limit: 20, offset: rootOffset.value, prepend: true });
      hasMorePosts.value = result.has_more;
    } finally { loadingMore.value = false; }
  }

  async function refreshPosts() {
    rootOffset.value = 0;
    const result = await loadPosts(threadId, { limit: 20, offset: 0 });
    hasMorePosts.value = result.has_more;
  }

  function beginThreadEdit() {
    if (!thread.value) return;
    threadTitleDraft.value = thread.value.title;
    threadDescriptionDraft.value = thread.value.description || "";
    editingThread.value = true;
  }

  async function saveThread() {
    if (!thread.value || !threadTitleDraft.value.trim() || savingThread.value) return;
    savingThread.value = true;
    try {
      await updateThread(thread.value.id, { title: threadTitleDraft.value.trim(), description: threadDescriptionDraft.value.trim() });
      editingThread.value = false;
    } finally { savingThread.value = false; }
  }
</script>

<template>
  <component :is="isTeacher ? TeacherLayout : StudentLayout">
    <div class="thread-page">
      <button class="back-btn" type="button" @click="router.push(isTeacher ? `/teacher/courses/${courseId}?tab=foro` : `/student/courses/${courseId}?tab=forum`)">
        <i class="pi pi-arrow-left"></i> Volver al foro
      </button>
      <StateMessage v-if="!thread" variant="loading" :rows="3" loading-label="Cargando tema del foro" />
      <template v-else>
        <header class="thread-header">
          <span class="eyebrow">Tema del foro</span>
          <template v-if="editingThread">
            <form class="thread-edit-form" @submit.prevent="saveThread">
              <InputText v-model="threadTitleDraft" aria-label="Título del tema" required />
              <Textarea v-model="threadDescriptionDraft" rows="3" placeholder="Descripción del tema (opcional)" />
              <div><Button type="button" label="Cancelar" text severity="secondary" :disabled="savingThread" @click="editingThread = false" /><Button type="submit" label="Guardar" :loading="savingThread" /></div>
            </form>
          </template>
          <template v-else>
            <div class="thread-title-row"><h1>{{ thread.title }}</h1><Button v-if="isTeacher" type="button" label="Editar" icon="pi pi-pencil" size="small" text @click="beginThreadEdit" /></div>
            <p v-if="thread.description" class="thread-description">{{ thread.description }}</p>
            <p v-else-if="isTeacher" class="thread-description thread-description--empty">Sin descripción. Agregá contexto para orientar el debate.</p>
          </template>
          <span class="thread-date">{{ formatDateTime(thread.created_at) }}</span>
        </header>
        <section class="replies" aria-label="Respuestas del tema">
          <div class="replies-heading"><h2>Mensajes</h2><span>{{ rootPosts.length }}</span></div>
          <p v-if="!rootPosts.length" class="state-message">Todavía no hay mensajes. Sé el primero en participar.</p>
          <ForumPostTree v-for="post in rootPosts" :key="post.id" :post="post" :posts="posts" :thread-id="threadId" @posted="refreshPosts" />
          <button v-if="hasMorePosts" class="show-all" type="button" :disabled="loadingMore" @click="loadOlderPosts">{{ loadingMore ? "Cargando…" : "Cargar 20 mensajes anteriores" }}</button>
        </section>
        <form class="reply-form" @submit.prevent="submitReply">
          <label for="reply">Nuevo mensaje</label>
          <Textarea id="reply" v-model="reply" rows="4" placeholder="Escribí una respuesta para este tema…" />
          <Button type="submit" label="Publicar respuesta" :loading="posting" />
        </form>
      </template>
    </div>
  </component>
</template>

<style scoped>
  .thread-page { max-width: 760px; }
  .back-btn { display: inline-flex; gap: var(--space-1); align-items: center; border: 0; background: transparent; color: var(--text-secondary); font-weight: 600; cursor: pointer; margin-bottom: var(--space-5); }
  .thread-header, .reply-form, .state-message { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: var(--radius-md); }
  .thread-header { padding: var(--space-5); margin-bottom: var(--space-5); }
  .eyebrow { color: var(--practiq-violet-dark); font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
  h1 { margin: var(--space-2) 0; color: var(--text-heading); font-size: clamp(22px, 4vw, 30px); }.thread-title-row{display:flex;align-items:center;justify-content:space-between;gap:var(--space-3)}.thread-description{margin:0 0 var(--space-2);color:var(--text-secondary);font-size:var(--text-sm);line-height:1.5;white-space:pre-wrap}.thread-description--empty{font-style:italic;color:var(--text-muted)}.thread-edit-form{display:flex;flex-direction:column;gap:var(--space-2);margin:var(--space-2) 0}.thread-edit-form>div{display:flex;justify-content:flex-end;gap:var(--space-2)}
  .thread-date, .reply-meta, .reply-form label { color: var(--text-muted); font-size: var(--text-xs); }
  .replies-heading { display:flex; align-items:center; gap: var(--space-2); margin-bottom: var(--space-3); }
  .replies-heading h2 { margin:0; color: var(--text-heading); font-size: var(--text-lg); }
  .replies-heading span { min-width: 24px; padding: 2px 7px; border-radius: 999px; background: var(--fill-primary-soft); color: var(--practiq-violet-dark); text-align:center; font-size: var(--text-xs); font-weight:700; }
  .show-all { display:block; width:100%; margin: var(--space-2) 0 var(--space-3); padding: var(--space-3); border: 1px solid var(--surface-border); border-radius: var(--radius-md); background: var(--surface-card); color: var(--practiq-violet-dark); font-size: var(--text-sm); font-weight: 700; cursor:pointer; }
  .show-all:hover { background: var(--surface-hover); }
  .reply-form { display:flex; flex-direction:column; gap: var(--space-2); padding: var(--space-4); margin-top: var(--space-5); }
  .reply-form .p-button { align-self:flex-start; }
  .state-message { padding: var(--space-5); color: var(--text-secondary); font-size: var(--text-sm); }
  @media (max-width: 600px) { .reply-form .p-button { width:100%; } }
</style>
