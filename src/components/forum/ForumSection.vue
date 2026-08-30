<script setup lang="ts">
  import { computed, onMounted, ref } from "vue";
  import { useRouter } from "vue-router";
  import { storeToRefs } from "pinia";
  import { useAuthStore } from "@/stores/authStore";
  import { useForum } from "@/composables/useForum";

  const props = defineProps<{ courseId: string }>();

  const { threads, loading, loadThreads, createThread } = useForum();
  const router = useRouter();
  const { isTeacher } = storeToRefs(useAuthStore());
  const showAllThreads = ref(false);
  const visibleThreads = computed(() => showAllThreads.value ? threads.value : threads.value.slice(0, 2));

  const newThreadTitle = ref("");
  const creatingThread = ref(false);

  onMounted(() => {
    loadThreads(props.courseId);
  });

  async function handleCreateThread() {
    if (!newThreadTitle.value.trim() || creatingThread.value) return;
    creatingThread.value = true;
    try {
      await createThread(props.courseId, newThreadTitle.value.trim());
      newThreadTitle.value = "";
    } catch {
      // useForum already surfaced the error via toast
    } finally {
      creatingThread.value = false;
    }
  }

  function openThread(threadId: string) {
    router.push({ name: isTeacher.value ? "teacher-forum-thread" : "student-forum-thread", params: { courseId: props.courseId, threadId } });
  }
</script>

<template>
  <section class="forum-section">
    <div class="forum-heading">
      <div>
        <h2>Foro del curso</h2>
        <p>Planteá dudas, compartí ideas y respondé a tus compañeros.</p>
      </div>
      <span class="topic-count">{{ threads.length }} {{ threads.length === 1 ? "tema" : "temas" }}</span>
    </div>

    <form v-if="isTeacher" class="inline-form" @submit.prevent="handleCreateThread">
      <InputText v-model="newThreadTitle" placeholder="¿Qué querés consultar? Escribí un nuevo tema" class="thread-input" aria-label="Título del nuevo tema" />
      <Button type="submit" label="Crear tema" :loading="creatingThread" size="small" />
    </form>
    <p v-else class="forum-note">Los temas nuevos los inicia el docente. Podés entrar a un tema y responder.</p>

    <div v-if="loading" class="state-message">Cargando…</div>
    <div v-else-if="!threads.length" class="state-message">Todavía no hay temas.</div>
    <ul v-else class="thread-list">
      <li v-for="thread in visibleThreads" :key="thread.id" class="thread-item">
        <button class="thread-head" type="button" @click="openThread(thread.id)">
          <span class="thread-main">
            <span class="thread-title">{{ thread.title }}</span>
            <span class="thread-hint">Abrir tema y responder</span>
          </span>
          <i class="pi pi-chevron-right"></i>
        </button>
      </li>
    </ul>
    <button v-if="threads.length > 2 && !showAllThreads" class="show-more" type="button" @click="showAllThreads = true">Ver todos los temas ({{ threads.length }})</button>
  </section>
</template>

<style scoped>
  .forum-section {
    margin-top: var(--space-6);
  }

  .forum-section h2 {
    font-size: var(--text-lg);
    font-weight: 700;
    color: var(--text-heading);
    margin: 0;
  }

  .forum-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-3); }
  .forum-heading p { margin-top: 3px; color: var(--text-secondary); font-size: var(--text-sm); }
  .topic-count { flex-shrink: 0; color: var(--text-muted); font-size: var(--text-xs); font-weight: 700; padding-top: 3px; }

  .inline-form {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }

  .thread-input {
    flex: 1;
  }

  .forum-note { margin: 0 0 var(--space-4); padding: var(--space-3); border-radius: var(--radius-md); background: var(--surface-hover); color: var(--text-secondary); font-size: var(--text-sm); }
  .show-more { width: 100%; margin-top: var(--space-2); padding: var(--space-3); border: 1px solid var(--surface-border); border-radius: var(--radius-md); background: var(--surface-card); color: var(--practiq-violet-dark); font-size: var(--text-sm); font-weight: 700; cursor: pointer; }

  .state-message {
    padding: var(--space-4);
    border-radius: var(--radius-lg);
    background: var(--surface-card);
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }

  .thread-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .thread-item {
    border-radius: var(--radius-md);
    background: var(--surface-card);
    box-shadow: var(--shadow-card);
    overflow: hidden;
  }

  .thread-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    border: 0;
    background: transparent;
    text-align: left;
    padding: var(--space-4);
    cursor: pointer;
    color: inherit;
  }

  .thread-head:hover { background: var(--surface-hover); }
  .thread-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; }

  .thread-title {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--text-primary);
  }

  .thread-hint { color: var(--text-muted); font-size: var(--text-xs); font-weight: 500; }

  .thread-body {
    border-top: 1px solid var(--surface-border);
    padding: var(--space-3);
  }

  .post-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .post-item {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--surface-hover);
  }

  .post-author {
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--text-muted);
  }

  .post-body {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    white-space: pre-wrap;
    margin-top: 2px;
  }

  .reply-form {
    display: flex;
    gap: var(--space-2);
  }

  .reply-input {
    flex: 1;
  }

  @media (max-width: 600px) {
    .inline-form, .reply-form { flex-direction: column; }
    .inline-form .p-button, .reply-form .p-button { align-self: stretch; }
  }
</style>
