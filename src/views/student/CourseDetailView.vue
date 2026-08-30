<script setup lang="ts">
  import { onMounted, ref } from "vue";
  import { useRoute, useRouter } from "vue-router";
  import StudentLayout from "@/layouts/StudentLayout.vue";
  import StateMessage from "@/components/ui/StateMessage.vue";
  import SubmissionBody from "@/components/ui/SubmissionBody.vue";
  import { formatDateTime } from "@/utils/datetime";
  import { useCourses } from "@/composables/useCourses";
  import { useCourseSections } from "@/composables/useCourseSections";
  import { useAssignments } from "@/composables/useAssignments";
  import { useSubmissions } from "@/composables/useSubmissions";
  import { useRubric } from "@/composables/useRubric";
  import { useQuizzes } from "@/composables/useQuizzes";
  import { useQuizAttempts } from "@/composables/useQuizAttempts";
  import { campusApi } from "@/api/request/server";
  import ForumSection from "@/components/forum/ForumSection.vue";
  import CourseMaterials from "@/components/course/CourseMaterials.vue";
  import type { Assignment } from "@/types";
  import type { Quiz } from "@/types/quiz";

  const route = useRoute();
  const router = useRouter();
  const courseId = route.params.id as string;
  const courseTabs = ["materials", "assignments", "quizzes", "forum"] as const;
  type CourseTab = (typeof courseTabs)[number];
  const requestedTab = route.query.tab as CourseTab;
  const activeCourseTab = ref<CourseTab>(courseTabs.includes(requestedTab) ? requestedTab : "materials");

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

  const quizzes = useQuizzes();
  const quizAttempts = useQuizAttempts();
  const takingQuiz = ref<Quiz | null>(null);
  const myAnswers = ref<Record<string, string>>({});
  const blankAnswers = ref<Record<string, Record<string, string>>>({});
  const submittingQuiz = ref(false);
  const showQuizResults = ref(false);

  onMounted(async () => {
    await loadCourse(courseId);
    await loadSections(courseId);
    const list = await loadAssignments(courseId);
    for (const a of list) {
      loadMine(a.id);
      await rubric.load(a.id); rubrics.value[a.id] = [...rubric.criteria.value];
    }
    const quizList = await quizzes.loadQuizzes(courseId);
    for (const q of quizList) quizAttempts.loadMyAttempts(q.id);
  });

  function blankIds(statement: string): string[] {
    return [...statement.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => m[1]);
  }
  function attemptsUsed(quiz: Quiz) {
    return quizAttempts.myAttempts.value[quiz.id]?.length ?? 0;
  }
  function attemptsLabel(quiz: Quiz) {
    return quiz.max_attempts === 0 ? `${attemptsUsed(quiz)} intentos realizados` : `${attemptsUsed(quiz)}/${quiz.max_attempts} intentos`;
  }
  function canAttempt(quiz: Quiz) {
    return quiz.max_attempts === 0 || attemptsUsed(quiz) < quiz.max_attempts;
  }
  function bestScore(quiz: Quiz) {
    const submitted = (quizAttempts.myAttempts.value[quiz.id] || []).filter((a) => a.submitted_at);
    if (!submitted.length) return null;
    const best = submitted.reduce((max, a) => a.score > max.score ? a : max, submitted[0]);
    return `${best.score}/${best.max_score}`;
  }

  async function openQuiz(quiz: Quiz) {
    takingQuiz.value = quiz;
    myAnswers.value = {};
    blankAnswers.value = {};
    showQuizResults.value = false;
    await quizAttempts.start(quiz.id);
  }
  function closeQuiz() {
    takingQuiz.value = null;
  }
  async function submitQuiz() {
    if (!quizAttempts.activeAttempt.value || submittingQuiz.value) return;
    submittingQuiz.value = true;
    try {
      const answers = quizAttempts.activeQuestions.value.map((q) => ({
        question_id: q.id,
        answer_text: q.type === "fill_blanks" ? JSON.stringify(blankAnswers.value[q.id] || {}) : myAnswers.value[q.id] || "",
      }));
      await quizAttempts.submit(quizAttempts.activeAttempt.value.id, answers);
      showQuizResults.value = true;
      if (takingQuiz.value) await quizAttempts.loadMyAttempts(takingQuiz.value.id);
    } finally {
      submittingQuiz.value = false;
    }
  }

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
  // The badge printed the raw API value ("published"), and in English, on a
  // screen a student reads. Same student-facing wording as the dashboard: the
  // draft/published split is authoring state they have no use for.
  function studentCourseStatus(status: string) {
    return status === "archived" ? "Finalizado" : "Activo";
  }
</script>

<template>
  <StudentLayout>
    <div class="course-detail">
      <button class="back-btn" type="button" @click="router.push('/student/dashboard')">
        <i class="pi pi-arrow-left"></i> Volver a mis cursos
      </button>

      <StateMessage v-if="loading || !currentCourse" variant="loading" :rows="4" loading-label="Cargando curso" />
      <template v-else>
        <header class="course-head">
          <h1>{{ currentCourse.title }}</h1>
          <span class="course-status">{{ studentCourseStatus(currentCourse.status) }}</span>
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
          <button type="button" :class="{ active: activeCourseTab === 'materials' }" :aria-pressed="activeCourseTab === 'materials'" @click="activeCourseTab = 'materials'"><i class="pi pi-folder-open" aria-hidden="true" /> Materiales</button>
          <button type="button" :class="{ active: activeCourseTab === 'assignments' }" :aria-pressed="activeCourseTab === 'assignments'" @click="activeCourseTab = 'assignments'"><i class="pi pi-check-square" aria-hidden="true" /> Tareas <span v-if="assignments.length">{{ assignments.length }}</span></button>
          <button type="button" :class="{ active: activeCourseTab === 'quizzes' }" :aria-pressed="activeCourseTab === 'quizzes'" @click="activeCourseTab = 'quizzes'"><i class="pi pi-verified" aria-hidden="true" /> Evaluaciones <span v-if="quizzes.quizzes.value.length">{{ quizzes.quizzes.value.length }}</span></button>
          <button type="button" :class="{ active: activeCourseTab === 'forum' }" :aria-pressed="activeCourseTab === 'forum'" @click="activeCourseTab = 'forum'"><i class="pi pi-comments" aria-hidden="true" /> Foro</button>
        </nav>

        <CourseMaterials v-if="activeCourseTab === 'materials'" :course-id="courseId" :sections="sections" />

        <section v-if="activeCourseTab === 'assignments'" class="assignments-section">
          <h2>Tareas</h2>
          <StateMessage
            v-if="!assignments.length"
            dense
            icon="pi-file-edit"
            title="Todavía no hay tareas"
            description="Cuando tu docente publique una actividad, la vas a ver acá."
          />
          <ul v-else class="assignment-list">
            <li v-for="assignment in assignments" :key="assignment.id" class="assignment-item">
              <div class="assignment-title">{{ assignment.title }}</div>
              <div class="assignment-meta">
                <span v-if="sectionTitle(assignment.section_id)">
                  {{ sectionTitle(assignment.section_id) }} ·
                </span>
                <span v-if="assignment.due_at">
                  vence {{ formatDateTime(assignment.due_at) }} ·
                </span>
                <span>máx. {{ assignment.max_score }}</span>
              </div>
              <p v-if="assignment.description" class="assignment-description">
                {{ assignment.description }}
              </p>
              <ul v-if="rubrics[assignment.id]?.length" class="rubric-list"><li v-for="criterion in rubrics[assignment.id]" :key="criterion.title"><strong>{{ criterion.title }}</strong><span>{{ criterion.description }}</span><em>{{ criterion.max_score }} pts</em></li></ul>
              <CourseMaterials :course-id="courseId" :assignment-id="assignment.id" />

              <div v-if="mySubmissions[assignment.id] && !resubmitting[assignment.id]" class="my-submission">
                <SubmissionBody
                  class="submission-content"
                  :content="mySubmissions[assignment.id]?.content || ''"
                  :attachments="mySubmissions[assignment.id]?.attachments"
                />
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

        <section v-if="activeCourseTab === 'quizzes'" class="quizzes-section">
          <StateMessage
            v-if="!quizzes.quizzes.value.length"
            dense
            icon="pi-verified"
            title="Todavía no hay evaluaciones"
            description="Tu docente no publicó evaluaciones en este curso."
          />
          <ul v-else class="quiz-list">
            <li v-for="quiz in quizzes.quizzes.value" :key="quiz.id" class="quiz-item">
              <div class="quiz-main">
                <strong>{{ quiz.title }}</strong>
                <p v-if="quiz.description">{{ quiz.description }}</p>
                <span class="quiz-meta">{{ attemptsLabel(quiz) }}<template v-if="quiz.time_limit_secs"> · {{ Math.round(quiz.time_limit_secs / 60) }} min</template><template v-if="bestScore(quiz)"> · mejor nota {{ bestScore(quiz) }}</template></span>
              </div>
              <Button label="Comenzar" size="small" :disabled="!canAttempt(quiz)" @click="openQuiz(quiz)" />
            </li>
          </ul>
        </section>

        <Dialog :visible="!!takingQuiz" modal :closable="showQuizResults" :close-on-escape="showQuizResults" :header="takingQuiz?.title" :style="{ width: 'min(640px, calc(100vw - 32px))' }" @update:visible="(visible) => { if (!visible && showQuizResults) closeQuiz(); }">
          <div v-if="!showQuizResults" class="quiz-attempt">
            <div v-for="question in quizAttempts.activeQuestions.value" :key="question.id" class="quiz-question">
              <p class="quiz-statement">{{ question.statement }}</p>
              <Select v-if="question.type === 'multiple_choice'" :model-value="myAnswers[question.id]" :options="question.options.map((o) => ({ label: o, value: o }))" option-label="label" option-value="value" placeholder="Elegí una opción" @update:model-value="myAnswers[question.id] = $event" />
              <Select v-else-if="question.type === 'true_false'" :model-value="myAnswers[question.id]" :options="[{ label: 'Verdadero', value: 'true' }, { label: 'Falso', value: 'false' }]" option-label="label" option-value="value" placeholder="Elegí una opción" @update:model-value="myAnswers[question.id] = $event" />
              <div v-else-if="question.type === 'fill_blanks'" class="blanks-inputs">
                <div v-for="id in blankIds(question.statement)" :key="id" class="blank-field"><label>Espacio {{ id }}</label><InputText :model-value="blankAnswers[question.id]?.[id] || ''" @update:model-value="blankAnswers[question.id] = { ...(blankAnswers[question.id] || {}), [id]: String($event) }" /></div>
              </div>
              <span class="quiz-points">{{ question.points }} pto(s)</span>
            </div>
            <Button label="Entregar" :loading="submittingQuiz" @click="submitQuiz" />
          </div>
          <div v-else class="quiz-results">
            <p class="quiz-score">Nota: {{ quizAttempts.activeAttempt.value?.score }}/{{ quizAttempts.activeAttempt.value?.max_score }}</p>
            <div v-for="result in quizAttempts.lastResults.value" :key="result.question_id" class="quiz-result-row" :class="{ correct: result.is_correct, incorrect: !result.is_correct }">
              <p>{{ result.statement }}</p>
              <span>Tu respuesta: {{ result.answer_text || "(sin responder)" }}</span>
              <span v-if="!result.is_correct">Correcta: {{ result.correct_answer }}</span>
            </div>
            <Button label="Cerrar" text @click="closeQuiz" />
          </div>
        </Dialog>

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

  .course-nav{display:flex;gap:var(--space-2);overflow-x:auto;padding:var(--space-3);margin-top:var(--space-5);border:1px solid var(--surface-border);border-radius:var(--radius-md);background:var(--surface-card);box-shadow:var(--shadow-card);mask-image:linear-gradient(to right,transparent,black var(--space-3),black calc(100% - var(--space-3)),transparent);-webkit-mask-image:linear-gradient(to right,transparent,black var(--space-3),black calc(100% - var(--space-3)),transparent)}.course-nav button{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 var(--space-3);border:0;border-radius:var(--radius-sm);background:transparent;color:var(--text-secondary);font-size:var(--text-xs);font-weight:700;white-space:nowrap;cursor:pointer}.course-nav button:hover{background:var(--surface-hover);color:var(--text-primary)}.course-nav button.active{background:var(--fill-primary-soft);color:var(--practiq-violet-dark)}.course-nav button.active span{background:var(--surface-card);color:var(--practiq-violet-dark)}.course-nav span{display:grid;min-width:20px;height:20px;padding:0 5px;place-items:center;border-radius:var(--radius-pill);background:var(--surface-hover);color:var(--text-secondary);font-size:var(--text-xs);font-weight:700}

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
    margin-bottom: var(--space-3);
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

  .quiz-list { display: flex; flex-direction: column; gap: var(--space-2); list-style: none; padding: 0; }
  .quiz-item { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-4); border: 1px solid var(--surface-border); border-radius: var(--radius-md); background: var(--surface-card); box-shadow: var(--shadow-card); }
  .quiz-item :deep(.p-button) { flex-shrink: 0; }
  .quiz-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .quiz-main strong { color: var(--text-heading); }
  .quiz-main p { margin: 0; color: var(--text-secondary); font-size: var(--text-sm); }
  .quiz-meta { color: var(--text-muted); font-size: var(--text-xs); }
  .quiz-attempt { display: flex; flex-direction: column; gap: var(--space-4); }
  .quiz-question { display: flex; flex-direction: column; gap: var(--space-2); padding-bottom: var(--space-3); border-bottom: 1px solid var(--surface-border); }
  .quiz-statement { margin: 0; font-weight: 700; color: var(--text-heading); }
  .quiz-points { color: var(--text-muted); font-size: var(--text-xs); }
  .blanks-inputs { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .blank-field { display: flex; flex-direction: column; gap: 2px; font-size: var(--text-xs); color: var(--text-muted); }
  .quiz-results { display: flex; flex-direction: column; gap: var(--space-3); }
  .quiz-score { margin: 0; font-size: var(--text-lg); font-weight: 800; color: var(--text-heading); }
  .quiz-result-row { padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); border-left: 3px solid transparent; }
  .quiz-result-row p { margin: 0 0 3px; font-weight: 700; }
  .quiz-result-row span { display: block; font-size: var(--text-xs); color: var(--text-secondary); }
  .quiz-result-row.correct { border-left-color: var(--color-success-dark); background: var(--fill-success-subtle); }
  .quiz-result-row.incorrect { border-left-color: var(--color-error-dark); background: var(--fill-error-subtle); }

  @media (max-width: 640px) {
    .course-detail { max-width: none; }
    .course-nav { margin-inline: calc(var(--space-1) * -1); border-inline: 0; border-radius: 0; }
    .quiz-item { flex-direction: column; align-items: stretch; }
    .quiz-item :deep(.p-button) { width: 100%; }
  }
</style>
