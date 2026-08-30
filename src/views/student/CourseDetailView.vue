<script setup lang="ts">
  import { onMounted, ref } from "vue";
  import { useRoute, useRouter } from "vue-router";
  import StudentLayout from "@/layouts/StudentLayout.vue";
  import { useCourses } from "@/composables/useCourses";
  import { useCourseSections } from "@/composables/useCourseSections";
  import { useAssignments } from "@/composables/useAssignments";
  import { useSubmissions } from "@/composables/useSubmissions";
  import { useRubric } from "@/composables/useRubric";
  import { campusApi } from "@/api/request/server";
  import ForumSection from "@/components/forum/ForumSection.vue";
  import CourseMaterials from "@/components/course/CourseMaterials.vue";
  import type { Assignment } from "@/types";

  const route = useRoute();
  const router = useRouter();
  const courseId = route.params.id as string;
  type CourseTab = "materials" | "assignments" | "forum";
  const activeCourseTab = ref<CourseTab>("materials");

  const { currentCourse, loading, loadCourse } = useCourses();
  const { sections, loadSections } = useCourseSections();
  const { assignments, loadAssignments } = useAssignments();
  const { mySubmissions, loadMine, submit } = useSubmissions();
  const rubric = useRubric();
  const rubrics = ref<Record<string, typeof rubric.criteria.value>>({});

  const submissionDrafts = ref<Record<string, string>>({});
  const submitting = ref<Record<string, boolean>>({});
  const resubmitting = ref<Record<string, boolean>>({});
  const submissionFiles = ref<Record<string, File | null>>({});

  onMounted(async () => {
    await loadCourse(courseId);
    await loadSections(courseId);
    const list = await loadAssignments(courseId);
    for (const a of list) {
      loadMine(a.id);
      await rubric.load(a.id); rubrics.value[a.id] = [...rubric.criteria.value];
    }
  });

  function sectionTitle(sectionId: string | null) {
    if (!sectionId) return null;
    return sections.value.find((s) => s.id === sectionId)?.title ?? null;
  }

  async function handleSubmit(assignmentId: string) {
    let content = submissionDrafts.value[assignmentId]?.trim() || "";
    const file = submissionFiles.value[assignmentId];
    if ((!content && !file) || submitting.value[assignmentId]) return;
    submitting.value[assignmentId] = true;
    try {
      if (file) {
        const body = new FormData();
        body.append("folder", "submissions");
        body.append("file", file);
        const { data } = await campusApi.post<{ data: { url: string } }>("/uploads", body);
        content = `${content}${content ? "\n\n" : ""}Archivo adjunto: ${file.name}\n${data.data.url}`;
      }
      await submit(assignmentId, content);
      submissionDrafts.value[assignmentId] = "";
      submissionFiles.value[assignmentId] = null;
      resubmitting.value[assignmentId] = false;
    } catch {
      // useSubmissions already surfaced the error via toast
    } finally {
      submitting.value[assignmentId] = false;
    }
  }

  function canResubmit(assignment: Assignment) {
    if (mySubmissions.value[assignment.id]?.graded_at) return false;
    return !assignment.due_at || new Date(assignment.due_at) > new Date();
  }

  function startResubmit(assignmentId: string) {
    submissionDrafts.value[assignmentId] = mySubmissions.value[assignmentId]?.content || "";
    resubmitting.value[assignmentId] = true;
  }

  function selectSubmissionFile(assignmentId: string, event: Event) {
    const input = event.target as HTMLInputElement;
    submissionFiles.value[assignmentId] = input.files?.[0] ?? null;
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
        <div v-if="currentCourse.labels?.length" class="course-labels">
          <span v-for="label in currentCourse.labels" :key="label">{{ label }}</span>
        </div>

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
              <ul v-if="rubrics[assignment.id]?.length" class="rubric-list"><li v-for="criterion in rubrics[assignment.id]" :key="criterion.title"><strong>{{ criterion.title }}</strong><span>{{ criterion.description }}</span><em>{{ criterion.max_score }} pts</em></li></ul>
              <CourseMaterials :course-id="courseId" :assignment-id="assignment.id" />

              <div v-if="mySubmissions[assignment.id] && !resubmitting[assignment.id]" class="my-submission">
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
                <ul v-if="mySubmissions[assignment.id]?.rubric_scores?.length" class="rubric-feedback-list">
                  <li v-for="score in mySubmissions[assignment.id]?.rubric_scores" :key="score.criterion_id">
                    <strong>{{ rubrics[assignment.id]?.find((criterion) => criterion.id === score.criterion_id)?.title }}</strong>
                    <span>{{ score.score }} / {{ rubrics[assignment.id]?.find((criterion) => criterion.id === score.criterion_id)?.max_score }}</span>
                    <p v-if="score.feedback">{{ score.feedback }}</p>
                  </li>
                </ul>
                <Button v-if="canResubmit(assignment)" label="Actualizar entrega" icon="pi pi-refresh" size="small" text @click="startResubmit(assignment.id)" />
                <small v-else class="submission-locked">{{ mySubmissions[assignment.id]?.graded_at ? "Entrega corregida: ya no se puede modificar" : "El plazo de entrega venció" }}</small>
              </div>
              <form v-else class="submit-form" @submit.prevent="handleSubmit(assignment.id)">
                <Textarea
                  v-model="submissionDrafts[assignment.id]"
                  rows="3"
                  placeholder="Tu respuesta o link de entrega"
                />
                <label class="submission-file"><i class="pi pi-paperclip" /> Adjuntar archivo<input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.txt,image/*,audio/*,video/*" @change="selectSubmissionFile(assignment.id, $event)" /><small v-if="submissionFiles[assignment.id]">{{ submissionFiles[assignment.id]?.name }}</small></label>
                <Button
                  type="submit"
                  :label="resubmitting[assignment.id] ? 'Reenviar entrega' : 'Entregar'"
                  size="small"
                  :loading="submitting[assignment.id]"
                  class="submit-btn"
                />
                <Button v-if="resubmitting[assignment.id]" type="button" label="Cancelar" severity="secondary" text size="small" @click="resubmitting[assignment.id] = false" />
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

  .course-labels{display:flex;gap:var(--space-1);flex-wrap:wrap;margin-top:var(--space-3)}.course-labels span{padding:2px 6px;border-radius:999px;background:var(--fill-primary-soft);color:var(--practiq-violet-dark);font-size:10px;font-weight:800}

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

  .submission-locked {
    display: block;
    margin-top: var(--space-2);
    color: var(--text-muted);
    font-size: var(--text-xs);
  }

  .submission-feedback {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin-top: var(--space-2);
    font-style: italic;
  }

  .rubric-feedback-list { display: grid; gap: var(--space-2); margin: var(--space-3) 0; padding: 0; list-style: none; }
  .rubric-feedback-list li { display: grid; grid-template-columns: 1fr auto; gap: 2px var(--space-3); padding: var(--space-2); border-radius: var(--radius-sm); background: var(--surface-card); font-size: var(--text-xs); }
  .rubric-feedback-list strong { color: var(--text-primary); }
  .rubric-feedback-list span { color: var(--practiq-violet-dark); font-weight: 700; }
  .rubric-feedback-list p { grid-column: 1 / -1; margin: 0; color: var(--text-secondary); }

  .submit-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }
  .submission-file { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); color: var(--practiq-violet-dark); font-size: var(--text-xs); font-weight: 700; cursor: pointer; }
  .submission-file input { max-width: 220px; color: var(--text-secondary); font-weight: 400; }
  .submission-file small { color: var(--text-muted); font-weight: 400; }

  .submit-btn {
    align-self: flex-start;
  }
</style>
