<script setup lang="ts">
  import { onMounted, ref } from "vue";
  import { useRoute, useRouter } from "vue-router";
  import StudentLayout from "@/layouts/StudentLayout.vue";
  import { useCourses } from "@/composables/useCourses";
  import { useCourseSections } from "@/composables/useCourseSections";
  import { useAssignments } from "@/composables/useAssignments";
  import { useSubmissions } from "@/composables/useSubmissions";
  import ForumSection from "@/components/forum/ForumSection.vue";
  import CourseMaterials from "@/components/course/CourseMaterials.vue";

  const route = useRoute();
  const router = useRouter();
  const courseId = route.params.id as string;
  type CourseTab = "materials" | "assignments" | "forum";
  const activeCourseTab = ref<CourseTab>("materials");

  const { currentCourse, loading, loadCourse } = useCourses();
  const { sections, loadSections } = useCourseSections();
  const { assignments, loadAssignments } = useAssignments();
  const { mySubmissions, loadMine, submit } = useSubmissions();

  const submissionDrafts = ref<Record<string, string>>({});
  const submitting = ref<Record<string, boolean>>({});

  onMounted(async () => {
    await loadCourse(courseId);
    await loadSections(courseId);
    const list = await loadAssignments(courseId);
    for (const a of list) {
      loadMine(a.id);
    }
  });

  function sectionTitle(sectionId: string | null) {
    if (!sectionId) return null;
    return sections.value.find((s) => s.id === sectionId)?.title ?? null;
  }

  async function handleSubmit(assignmentId: string) {
    const content = submissionDrafts.value[assignmentId]?.trim();
    if (!content || submitting.value[assignmentId]) return;
    submitting.value[assignmentId] = true;
    try {
      await submit(assignmentId, content);
      submissionDrafts.value[assignmentId] = "";
    } catch {
      // useSubmissions already surfaced the error via toast
    } finally {
      submitting.value[assignmentId] = false;
    }
  }
</script>

<template>
  <StudentLayout>
    <div class="course-detail">
      <button class="back-btn" type="button" @click="router.back()">
        <i class="pi pi-arrow-left"></i> Volver
      </button>

      <div v-if="loading || !currentCourse" class="state-message">Cargando…</div>
      <template v-else>
        <header class="course-head">
          <h1>{{ currentCourse.title }}</h1>
          <span class="course-status">{{ currentCourse.status }}</span>
        </header>
        <p v-if="currentCourse.description" class="course-description">
          {{ currentCourse.description }}
        </p>
        <p v-else class="course-description course-description--empty">
          El docente todavía no agregó una descripción.
        </p>

        <nav class="course-nav" aria-label="Contenido del curso">
          <button type="button" :class="{ active: activeCourseTab === 'materials' }" @click="activeCourseTab = 'materials'"><i class="pi pi-folder-open" /> Materiales</button>
          <button type="button" :class="{ active: activeCourseTab === 'assignments' }" @click="activeCourseTab = 'assignments'"><i class="pi pi-check-square" /> Tareas <span>{{ assignments.length }}</span></button>
          <button type="button" :class="{ active: activeCourseTab === 'forum' }" @click="activeCourseTab = 'forum'"><i class="pi pi-comments" /> Foro</button>
        </nav>

        <CourseMaterials v-if="activeCourseTab === 'materials'" :course-id="courseId" :sections="sections" />

        <section v-if="activeCourseTab === 'assignments'" class="assignments-section">
          <h2>Tareas</h2>
          <div v-if="!assignments.length" class="state-message">
            Todavía no hay tareas.
          </div>
          <ul v-else class="assignment-list">
            <li v-for="assignment in assignments" :key="assignment.id" class="assignment-item">
              <div class="assignment-title">{{ assignment.title }}</div>
              <div class="assignment-meta">
                <span v-if="sectionTitle(assignment.section_id)">
                  {{ sectionTitle(assignment.section_id) }} ·
                </span>
                <span v-if="assignment.due_at">
                  vence {{ new Date(assignment.due_at).toLocaleString() }} ·
                </span>
                <span>máx. {{ assignment.max_score }}</span>
              </div>
              <p v-if="assignment.description" class="assignment-description">
                {{ assignment.description }}
              </p>

              <div v-if="mySubmissions[assignment.id]" class="my-submission">
                <p class="submission-content">{{ mySubmissions[assignment.id]?.content }}</p>
                <span
                  class="submission-status"
                  :class="`submission-status--${mySubmissions[assignment.id]?.status}`"
                >
                  {{
                    mySubmissions[assignment.id]?.status === "graded"
                      ? `Nota: ${mySubmissions[assignment.id]?.score}`
                      : "Entregado, esperando corrección"
                  }}
                </span>
                <p v-if="mySubmissions[assignment.id]?.feedback" class="submission-feedback">
                  {{ mySubmissions[assignment.id]?.feedback }}
                </p>
              </div>
              <form v-else class="submit-form" @submit.prevent="handleSubmit(assignment.id)">
                <Textarea
                  v-model="submissionDrafts[assignment.id]"
                  rows="3"
                  placeholder="Tu respuesta o link de entrega"
                />
                <Button
                  type="submit"
                  label="Entregar"
                  size="small"
                  :loading="submitting[assignment.id]"
                  class="submit-btn"
                />
              </form>
            </li>
          </ul>
        </section>

        <ForumSection v-if="activeCourseTab === 'forum'" :course-id="courseId" />
      </template>
    </div>
  </StudentLayout>
</template>

<style scoped>
  .course-detail {
    max-width: 720px;
  }

  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
    margin-bottom: var(--space-4);
  }

  .state-message {
    padding: var(--space-6);
    border-radius: var(--radius-lg);
    background: var(--surface-card);
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }

  .course-head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }

  .course-head h1 {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-heading);
  }

  .course-status {
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    padding: 2px var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--fill-primary-soft);
    color: var(--practiq-violet-dark);
  }

  .course-description {
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }

  .course-description--empty {
    font-style: italic;
    color: var(--text-muted);
  }

  .course-nav{display:flex;gap:var(--space-2);overflow-x:auto;padding:var(--space-3);margin-top:var(--space-5);border:1px solid var(--surface-border);border-radius:var(--radius-md);background:var(--surface-card);box-shadow:var(--shadow-card)}.course-nav button{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 var(--space-3);border:0;border-radius:var(--radius-sm);background:transparent;color:var(--text-secondary);font-size:var(--text-xs);font-weight:700;white-space:nowrap;cursor:pointer}.course-nav button:hover,.course-nav button.active{background:var(--surface-hover);color:var(--practiq-violet-dark)}.course-nav span{display:grid;min-width:20px;height:20px;place-items:center;border-radius:var(--radius-pill);background:var(--surface-hover);color:var(--text-muted);font-size:var(--text-xs)}

  .assignments-section {
    margin-top: var(--space-6);
  }

  .assignments-section h2 {
    font-size: var(--text-md);
    font-weight: 700;
    color: var(--text-heading);
    margin-bottom: var(--space-3);
  }

  .assignment-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .assignment-item {
    padding: var(--space-4);
    border-radius: var(--radius-lg);
    background: var(--surface-card);
    box-shadow: var(--shadow-card);
  }

  .assignment-title {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--text-primary);
  }

  .assignment-meta {
    font-size: var(--text-xs);
    color: var(--text-muted);
    margin-top: 2px;
  }

  .assignment-description {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin-top: var(--space-2);
  }

  .my-submission {
    margin-top: var(--space-3);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--surface-hover);
  }

  .submission-content {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    white-space: pre-wrap;
    margin-bottom: var(--space-2);
  }

  .submission-status {
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--text-muted);
  }

  .submission-status--graded {
    color: var(--color-success-dark);
  }

  .submission-feedback {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin-top: var(--space-2);
    font-style: italic;
  }

  .submit-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }

  .submit-btn {
    align-self: flex-start;
  }
</style>
