<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import StudentLayout from "@/layouts/StudentLayout.vue";
import TeacherLayout from "@/layouts/TeacherLayout.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import StateMessage from "@/components/ui/StateMessage.vue";
import { useAuthStore } from "@/stores/authStore";
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
  // Teacher view.
  count: number;
  average: number | null;
  // Student view.
  submitted: boolean;
  score: number | null;
  maxScore: number;
  feedback: string;
}

const auth = useAuthStore();
const teacher = computed(() => auth.profile?.profile_type === "teacher");
const { loadCourses } = useCourses();
const assignmentService = new AssignmentService(campusApi);
const submissionService = new SubmissionService(campusApi);
const quizService = new QuizService(campusApi);
const rows = ref<GradeRow[]>([]);
const loading = ref(true);
const selectedCourseId = ref("all");
const visibleRows = computed(() => selectedCourseId.value === "all" ? rows.value : rows.value.filter((row) => row.course.id === selectedCourseId.value));
const gradedRows = computed(() => visibleRows.value.filter((row) => row.score != null));
const average = computed(() => gradedRows.value.length ? Math.round(gradedRows.value.reduce((sum, row) => sum + (row.score || 0) / row.maxScore * 100, 0) / gradedRows.value.length) : null);

function percent(score: number | null, max: number) {
  return score == null || !max ? null : Math.round(score / max * 100);
}

async function assignmentRows(course: Course): Promise<GradeRow[]> {
  const { data } = await assignmentService.listByCourse(course.id);
  return Promise.all(data.map(async (assignment): Promise<GradeRow> => {
    if (teacher.value) {
      const { data: submissions } = await submissionService.listByAssignment(assignment.id);
      const graded = submissions.filter((s) => s.score != null);
      const average = graded.length ? Math.round(graded.reduce((sum, s) => sum + (s.score || 0) / assignment.max_score * 100, 0) / graded.length) : null;
      return { course, kind: "assignment", id: assignment.id, title: assignment.title, dueAt: assignment.due_at, count: submissions.length, average, submitted: false, score: null, maxScore: assignment.max_score, feedback: "" };
    }
    const { data: submission } = await submissionService.getMine(assignment.id);
    return { course, kind: "assignment", id: assignment.id, title: assignment.title, dueAt: assignment.due_at, count: 0, average: null, submitted: !!submission, score: submission?.score ?? null, maxScore: assignment.max_score, feedback: submission?.feedback || "" };
  }));
}

async function quizRows(course: Course): Promise<GradeRow[]> {
  const quizzes = await quizService.listByCourse(course.id);
  return Promise.all(quizzes.map(async (quiz): Promise<GradeRow> => {
    if (teacher.value) {
      const attempts = (await quizService.listAttemptsByQuiz(quiz.id)).filter((a) => a.submitted_at);
      const average = attempts.length ? Math.round(attempts.reduce((sum, a) => sum + (a.max_score ? a.score / a.max_score * 100 : 0), 0) / attempts.length) : null;
      return { course, kind: "quiz", id: quiz.id, title: quiz.title, dueAt: quiz.available_until, count: attempts.length, average, submitted: false, score: null, maxScore: 0, feedback: "" };
    }
    const attempts = (await quizService.listMyAttempts(quiz.id)).filter((a) => a.submitted_at);
    const best = attempts.reduce<typeof attempts[number] | null>((max, a) => !max || a.score > max.score ? a : max, null);
    return { course, kind: "quiz", id: quiz.id, title: quiz.title, dueAt: quiz.available_until, count: 0, average: null, submitted: !!best, score: best?.score ?? null, maxScore: best?.max_score ?? 0, feedback: "" };
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
        eyebrow="Seguimiento académico"
        :title="teacher ? 'Calificaciones' : 'Mis calificaciones'"
        :subtitle="teacher ? 'Revisá entregas y promedio de cada actividad, tareas y evaluaciones.' : 'Consultá notas, devoluciones y avance por actividad.'"
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
        <div v-if="!teacher && visibleRows.length" class="summary">
          <span class="summary-icon"><i class="pi pi-chart-line" aria-hidden="true"></i></span>
          <div>
            <small>Promedio actual</small>
            <strong>{{ average == null ? "Sin notas" : `${average}%` }}</strong>
          </div>
          <span>{{ gradedRows.length }} de {{ visibleRows.length }} actividades calificadas</span>
        </div>
        <StateMessage
          v-if="!visibleRows.length"
          icon="pi-chart-bar"
          title="Todavía no hay actividades"
          :description="teacher ? 'Cuando publiques una tarea o evaluación, su promedio aparecerá acá.' : 'Cuando tus cursos publiquen actividades, vas a ver acá tus notas y devoluciones.'"
        />
        <ul v-else class="grade-list">
          <li v-for="row in visibleRows" :key="`${row.kind}:${row.id}`">
            <div class="grade-title">
              <span class="course-name">{{ row.course.title }} <i class="pi" :class="row.kind === 'quiz' ? 'pi-verified' : 'pi-check-square'" :title="row.kind === 'quiz' ? 'Evaluación' : 'Tarea'" /></span>
              <strong>{{ row.title }}</strong>
              <small v-if="row.dueAt">Entrega: {{ new Date(row.dueAt).toLocaleDateString("es-AR") }}</small>
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
.grades-page{max-width:1000px}.course-select{width:230px}.summary{display:flex;align-items:center;gap:var(--space-3);padding:var(--space-4);margin-bottom:var(--space-4);border:1px solid var(--surface-border);border-radius:var(--radius-md);background:var(--surface-card);box-shadow:var(--shadow-card)}.summary-icon{display:grid;width:38px;height:38px;border-radius:var(--radius-md);place-items:center;background:var(--fill-primary-soft);color:var(--practiq-violet-dark)}.summary small,.summary span:last-child{color:var(--text-secondary);font-size:var(--text-xs)}.summary strong{display:block;color:var(--text-heading);font-size:var(--text-lg)}.summary span:last-child{margin-left:auto}.grade-list{display:flex;flex-direction:column;gap:var(--space-2);padding:0;list-style:none}.grade-list li{display:flex;align-items:center;gap:var(--space-4);padding:var(--space-4);border:1px solid var(--surface-border);border-radius:var(--radius-md);background:var(--surface-card);box-shadow:var(--shadow-card)}.grade-title{display:flex;min-width:0;flex:1;flex-direction:column;gap:3px}.grade-title strong{color:var(--text-heading);font-size:var(--text-sm)}.grade-title small,.course-name,.grade-feedback{color:var(--text-secondary);font-size:var(--text-xs)}.course-name{display:inline-flex;align-items:center;gap:4px;color:var(--practiq-violet-dark);font-weight:700}.grade-feedback{max-width:260px}.grade-pending-flag{color:var(--color-warning-dark);font-weight:700}.teacher-metric{display:flex;min-width:62px;flex-direction:column;text-align:center}.teacher-metric strong{color:var(--text-heading)}.teacher-metric span{color:var(--text-muted);font-size:10px}.grade-value{display:flex;min-width:70px;flex-direction:column;align-items:flex-end;color:var(--color-success-dark);font-size:var(--text-lg);font-weight:800}.grade-value small{font-size:var(--text-xs)}.grade-value.pending{color:var(--text-muted);font-size:var(--text-sm)}@media(max-width:650px){.course-select{width:100%}.grade-list li{align-items:flex-start;flex-wrap:wrap;gap:var(--space-2)}.grade-feedback{order:3;max-width:none;width:calc(100% - 80px)}.summary span:last-child{display:none}}
</style>
