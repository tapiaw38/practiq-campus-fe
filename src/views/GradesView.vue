<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import StudentLayout from "@/layouts/StudentLayout.vue";
import TeacherLayout from "@/layouts/TeacherLayout.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import StateMessage from "@/components/ui/StateMessage.vue";
import { useCampusRole } from "@/composables/useCampusRole";
import { useCourses } from "@/composables/useCourses";
import { AssignmentService } from "@/services/assignments/assignmentService";
import { SubmissionService } from "@/services/submissions/submissionService";
import { QuizService } from "@/services/quizzes/quizService";
import { campusApi } from "@/api/request/server";
import type { Course } from "@/types";

interface GradeRow {
  course: Course;
  kind: "assignment" | "quiz";
  id: string;
  title: string;
  dueAt: string | null;
  weight: number;
  // Teacher view.
  count: number;
  average: number | null;
  // Student view.
  submitted: boolean;
  score: number | null;
  maxScore: number;
  feedback: string;
}

// Role here, not the account-wide one: a teacher at one school who studies at
// another was shown the wrong grade book and then hit 403 on teacher-only
// endpoints.
const { isTeacher: teacher } = useCampusRole();
const { loadCourses } = useCourses();
const assignmentService = new AssignmentService(campusApi);
const submissionService = new SubmissionService(campusApi);
const quizService = new QuizService(campusApi);
const rows = ref<GradeRow[]>([]);
const loading = ref(true);
const selectedCourseId = ref("all");
const visibleRows = computed(() => selectedCourseId.value === "all" ? rows.value : rows.value.filter((row) => row.course.id === selectedCourseId.value));
const gradedRows = computed(() => visibleRows.value.filter((row) => row.score != null && row.maxScore > 0));
// Weighted rather than a flat mean: a row weighted 200 counts twice as much
// toward the average as one weighted 100, regardless of how many points
// each is out of.
const average = computed(() => {
  const totalWeight = gradedRows.value.reduce((sum, row) => sum + row.weight, 0);
  if (!totalWeight) return null;
  const weightedSum = gradedRows.value.reduce((sum, row) => sum + (row.score || 0) / row.maxScore * row.weight, 0);
  return Math.round(weightedSum / totalWeight * 100);
});

function percent(score: number | null, max: number) {
  return score == null || !max ? null : Math.round(score / max * 100);
}

const submittedRows = computed(() => visibleRows.value.filter((row) => row.submitted));
const missingRows = computed(() => visibleRows.value.filter((row) => !row.submitted));

async function assignmentRows(course: Course): Promise<GradeRow[]> {
  const { data } = await assignmentService.listByCourse(course.id);
  return Promise.all(data.map(async (assignment): Promise<GradeRow> => {
    if (teacher.value) {
      const { data: submissions } = await submissionService.listByAssignment(assignment.id);
      const graded = submissions.filter((s) => s.score != null);
      const average = graded.length ? Math.round(graded.reduce((sum, s) => sum + (s.score || 0) / assignment.max_score * 100, 0) / graded.length) : null;
      return { course, kind: "assignment", id: assignment.id, title: assignment.title, dueAt: assignment.due_at, weight: assignment.weight, count: submissions.length, average, submitted: false, score: null, maxScore: assignment.max_score, feedback: "" };
    }
    const { data: submission } = await submissionService.getMine(assignment.id);
    return { course, kind: "assignment", id: assignment.id, title: assignment.title, dueAt: assignment.due_at, weight: assignment.weight, count: 0, average: null, submitted: !!submission, score: submission?.score ?? null, maxScore: assignment.max_score, feedback: submission?.feedback || "" };
  }));
}

async function quizRows(course: Course): Promise<GradeRow[]> {
  const quizzes = await quizService.listByCourse(course.id);
  return Promise.all(quizzes.map(async (quiz): Promise<GradeRow> => {
    if (teacher.value) {
      const attempts = (await quizService.listAttemptsByQuiz(quiz.id)).filter((a) => a.submitted_at);
      const average = attempts.length ? Math.round(attempts.reduce((sum, a) => sum + (a.max_score ? a.score / a.max_score * 100 : 0), 0) / attempts.length) : null;
      return { course, kind: "quiz", id: quiz.id, title: quiz.title, dueAt: quiz.available_until, weight: quiz.weight, count: attempts.length, average, submitted: false, score: null, maxScore: 0, feedback: "" };
    }
    const attempts = (await quizService.listMyAttempts(quiz.id)).filter((a) => a.submitted_at);
    const best = attempts.reduce<typeof attempts[number] | null>((max, a) => !max || a.score > max.score ? a : max, null);
    return { course, kind: "quiz", id: quiz.id, title: quiz.title, dueAt: quiz.available_until, weight: quiz.weight, count: 0, average: null, submitted: !!best, score: best?.score ?? null, maxScore: best?.max_score ?? 0, feedback: "" };
  }));
}

onMounted(async () => {
  try {
    const courses = await loadCourses();
    const grouped = await Promise.all(courses.map(async (course) => [...(await assignmentRows(course)), ...(await quizRows(course))]));
    rows.value = grouped.flat();
  } finally { loading.value = false; }
});

const courseOptions = computed(() => [
  { id: "all", title: "Todos los cursos" },
  ...Array.from(new Map(rows.value.map((row) => [row.course.id, row.course])).values()),
]);

function exportCsv() {
  const header = ["Curso", "Actividad", "Tipo", "Entregas", "Promedio %"];
  const lines = visibleRows.value.map((row) => [
    row.course.title,
    row.title,
    row.kind === "assignment" ? "Tarea" : "Evaluación",
    String(row.count),
    row.average == null ? "" : String(row.average),
  ]);
  const csv = [header, ...lines].map((cols) => cols.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "calificaciones.csv";
  link.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <component :is="teacher ? TeacherLayout : StudentLayout">
    <section class="grades-page">
      <PageHeader
        :eyebrow="teacher ? 'Seguimiento académico' : 'Tu rendimiento'"
        :title="teacher ? 'Calificaciones' : 'Mis calificaciones'"
        :subtitle="teacher ? 'Revisá entregas y promedio de cada actividad, tareas y evaluaciones.' : 'Notas, devoluciones y avance por actividad.'"
      >
        <template #actions>
          <Select
            v-model="selectedCourseId"
            :options="courseOptions"
            option-label="title"
            option-value="id"
            class="course-select"
            aria-label="Filtrar por curso"
          />
          <Button v-if="teacher" label="Exportar CSV" icon="pi pi-download" outlined size="small" :disabled="!visibleRows.length" @click="exportCsv" />
        </template>
      </PageHeader>

      <StateMessage v-if="loading" variant="loading" loading-label="Cargando calificaciones" :rows="4" />
      <template v-else>
        <div v-if="!teacher && visibleRows.length" class="stat-grid">
          <div class="stat-card stat-card--average">
            <span class="stat-label">Promedio general</span>
            <strong>{{ average == null ? "—" : `${average}%` }}</strong>
            <span class="stat-note">{{ gradedRows.length }} {{ gradedRows.length === 1 ? "actividad calificada" : "actividades calificadas" }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Actividades corregidas</span>
            <strong>{{ gradedRows.length }}</strong>
            <span class="stat-note">de {{ submittedRows.length }} entregadas</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Sin entregar</span>
            <strong :class="{ 'stat-warning': missingRows.length }">{{ missingRows.length }}</strong>
            <span class="stat-note">de {{ visibleRows.length }} actividades</span>
          </div>
        </div>
        <StateMessage
          v-if="!visibleRows.length"
          icon="pi-chart-bar"
          title="Todavía no hay actividades"
          :description="teacher ? 'Cuando publiques una tarea o evaluación, su promedio aparecerá acá.' : 'Cuando tus cursos publiquen actividades, vas a ver acá tus notas y devoluciones.'"
        />
        <ul v-else class="grade-list">
          <li v-for="row in visibleRows" :key="`${row.kind}:${row.id}`" :class="{ 'grade-row--missing': !teacher && !row.submitted }">
            <span class="grade-icon" :class="{ 'grade-icon--missing': !teacher && !row.submitted }">
              <i class="pi" :class="!teacher && !row.submitted ? 'pi-clock' : row.kind === 'quiz' ? 'pi-verified' : 'pi-check-square'" aria-hidden="true"></i>
            </span>
            <div class="grade-title">
              <strong>{{ row.title }}</strong>
              <small>
                {{ row.course.title }} · {{ row.kind === "quiz" ? "Evaluación" : "Tarea" }}
                <template v-if="row.dueAt"> · entrega {{ new Date(row.dueAt).toLocaleDateString("es-AR") }}</template>
                <template v-if="row.weight !== 100"> · peso {{ row.weight }}</template>
              </small>
            </div>
            <template v-if="teacher">
              <div class="teacher-metric">
                <strong>{{ row.count }}</strong>
                <span>{{ row.kind === "quiz" ? "intentos" : "entregas" }}</span>
              </div>
              <div class="grade-value" :class="{ pending: row.average == null }">
                {{ row.average == null ? "Sin notas" : `${row.average}%` }}
              </div>
            </template>
            <template v-else>
              <div class="grade-feedback">
                <span v-if="row.feedback">{{ row.feedback }}</span>
                <span v-else-if="row.kind === 'quiz'" :class="{ 'grade-pending-flag': !row.submitted }">
                  {{ row.submitted ? "Corrección automática" : "Sin rendir" }}
                </span>
                <span v-else :class="{ 'grade-pending-flag': !row.submitted }">
                  {{ row.submitted ? "Entregada, pendiente de corrección" : "Sin entregar" }}
                </span>
              </div>
              <div class="grade-value" :class="{ pending: row.score == null }">
                {{ row.score == null ? "—" : `${row.score}/${row.maxScore}` }}
                <small v-if="percent(row.score, row.maxScore) != null">
                  {{ percent(row.score, row.maxScore) }}%
                </small>
              </div>
            </template>
          </li>
        </ul>
      </template>
    </section>
  </component>
</template>

<style scoped>
  .grades-page { max-width: 1000px; }
  .course-select { width: 230px; }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--space-3);
    margin-bottom: var(--space-5);
  }

  .stat-card {
    padding: var(--space-5);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    background: var(--surface-card);
  }

  .stat-card--average { border-color: var(--practiq-violet-200); background: var(--practiq-violet-pale); }
  .stat-card--average .stat-label { color: var(--practiq-violet-dark); }

  .stat-label { display: block; color: var(--text-secondary); font-size: var(--text-sm); font-weight: 600; }

  .stat-card strong {
    display: block;
    margin-top: var(--space-1);
    color: var(--text-heading);
    font-family: var(--font-ui-family);
    font-size: 32px;
    font-weight: 900;
    letter-spacing: -0.04em;
  }

  .stat-warning { color: var(--color-warning-dark); }
  .stat-note { font-size: var(--text-sm); color: var(--text-secondary); }

  .grade-list { display: flex; flex-direction: column; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }

  .grade-list li {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    background: var(--surface-card);
  }

  .grade-row--missing { background: var(--color-warning-bg); border-color: var(--color-warning-bg); }

  .grade-icon {
    display: grid;
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    place-items: center;
    border-radius: var(--radius-lg);
    background: var(--practiq-violet-pale);
    color: var(--practiq-violet-dark);
  }

  .grade-icon--missing { background: var(--surface-card); color: var(--color-warning-dark); }

  .grade-title { display: flex; min-width: 180px; flex: 1; flex-direction: column; gap: 2px; }
  .grade-title strong { color: var(--text-heading); font-size: var(--text-md); }
  .grade-title small, .grade-feedback { color: var(--text-secondary); font-size: var(--text-sm); }
  .grade-feedback { flex: 1; min-width: 150px; }
  .grade-pending-flag { color: var(--color-warning-dark); font-weight: 700; }

  .teacher-metric { display: flex; min-width: 62px; flex-direction: column; text-align: center; }
  .teacher-metric strong { color: var(--text-heading); }
  .teacher-metric span { color: var(--text-muted); font-size: 10px; }

  .grade-value {
    display: flex;
    min-width: 70px;
    flex-direction: column;
    align-items: flex-end;
    color: var(--color-success-dark);
    font-family: var(--font-ui-family);
    font-size: 19px;
    font-weight: 900;
  }

  .grade-value small { color: var(--text-secondary); font-family: var(--font-body-family); font-size: var(--text-sm); font-weight: 400; }
  .grade-value.pending { color: var(--text-muted); font-size: var(--text-md); }

  @media (max-width: 650px) {
    .course-select { width: 100%; }
    .grade-list li { align-items: flex-start; flex-wrap: wrap; gap: var(--space-2); }
    .grade-feedback { order: 3; width: 100%; }
  }
</style>
