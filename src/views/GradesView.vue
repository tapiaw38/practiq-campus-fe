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
import { campusApi } from "@/api/request/server";
import type { Assignment, Course, Submission } from "@/types";

type GradeRow = { course: Course; assignment: Assignment; submission: Submission | null; submissions?: Submission[] };
const auth = useAuthStore();
const teacher = computed(() => auth.profile?.profile_type === "teacher");
const { loadCourses } = useCourses();
const assignments = new AssignmentService(campusApi);
const submissions = new SubmissionService(campusApi);
const rows = ref<GradeRow[]>([]);
const loading = ref(true);
const selectedCourseId = ref("all");
const visibleRows = computed(() => selectedCourseId.value === "all" ? rows.value : rows.value.filter((row) => row.course.id === selectedCourseId.value));
const gradedRows = computed(() => visibleRows.value.filter((row) => row.submission?.score != null));
const average = computed(() => gradedRows.value.length ? Math.round(gradedRows.value.reduce((sum, row) => sum + (row.submission?.score || 0) / row.assignment.max_score * 100, 0) / gradedRows.value.length) : null);

onMounted(async () => {
  try {
    const courses = await loadCourses();
    const grouped = await Promise.all(courses.map(async (course) => {
      const { data } = await assignments.listByCourse(course.id);
      return Promise.all(data.map(async (assignment) => {
        if (teacher.value) return { course, assignment, submission: null, submissions: (await submissions.listByAssignment(assignment.id)).data };
        return { course, assignment, submission: (await submissions.getMine(assignment.id)).data };
      }));
    }));
    rows.value = grouped.flat();
  } finally { loading.value = false; }
});

const courseOptions = computed(() => [
  { id: "all", title: "Todos los cursos" },
  ...Array.from(new Map(rows.value.map((row) => [row.course.id, row.course])).values()),
]);

function percent(score: number | null, max: number) { return score == null ? null : Math.round(score / max * 100); }
function teacherAverage(row: GradeRow) { const graded = (row.submissions || []).filter((item) => item.score != null); return graded.length ? Math.round(graded.reduce((sum, item) => sum + (item.score || 0) / row.assignment.max_score * 100, 0) / graded.length) : null; }
</script>

<template>
  <component :is="teacher ? TeacherLayout : StudentLayout">
    <section class="grades-page">
      <PageHeader
        eyebrow="Seguimiento académico"
        :title="teacher ? 'Calificaciones' : 'Mis calificaciones'"
        :subtitle="teacher ? 'Revisá entregas y promedio de cada actividad.' : 'Consultá notas, devoluciones y avance por actividad.'"
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
          :description="teacher ? 'Cuando publiques una tarea, su promedio aparecerá acá.' : 'Cuando tus cursos publiquen actividades, vas a ver acá tus notas y devoluciones.'"
        />
        <ul v-else class="grade-list">
          <li v-for="row in visibleRows" :key="row.assignment.id">
            <div class="grade-title">
              <span class="course-name">{{ row.course.title }}</span>
              <strong>{{ row.assignment.title }}</strong>
              <small v-if="row.assignment.due_at">Entrega: {{ new Date(row.assignment.due_at).toLocaleDateString("es-AR") }}</small>
            </div>
            <template v-if="teacher">
              <div class="teacher-metric">
                <strong>{{ row.submissions?.length || 0 }}</strong>
                <span>entregas</span>
              </div>
              <div class="grade-value" :class="{ pending: teacherAverage(row) == null }">
                {{ teacherAverage(row) == null ? "Sin notas" : `${teacherAverage(row)}%` }}
              </div>
            </template>
            <template v-else>
              <div class="grade-feedback">
                <span v-if="row.submission?.feedback">{{ row.submission.feedback }}</span>
                <span v-else :class="{ 'grade-pending-flag': !row.submission }">
                  {{ row.submission ? "Entregada, pendiente de corrección" : "Sin entregar" }}
                </span>
              </div>
              <div class="grade-value" :class="{ pending: row.submission?.score == null }">
                {{ row.submission?.score == null ? "—" : `${row.submission.score}/${row.assignment.max_score}` }}
                <small v-if="percent(row.submission?.score ?? null, row.assignment.max_score) != null">
                  {{ percent(row.submission?.score ?? null, row.assignment.max_score) }}%
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
.grades-page{max-width:1000px}.course-select{width:230px}.summary{display:flex;align-items:center;gap:var(--space-3);padding:var(--space-4);margin-bottom:var(--space-4);border:1px solid var(--surface-border);border-radius:var(--radius-md);background:var(--surface-card);box-shadow:var(--shadow-card)}.summary-icon{display:grid;width:38px;height:38px;border-radius:var(--radius-md);place-items:center;background:var(--fill-primary-soft);color:var(--practiq-violet-dark)}.summary small,.summary span:last-child{color:var(--text-secondary);font-size:var(--text-xs)}.summary strong{display:block;color:var(--text-heading);font-size:var(--text-lg)}.summary span:last-child{margin-left:auto}.grade-list{display:flex;flex-direction:column;gap:var(--space-2);padding:0;list-style:none}.grade-list li{display:flex;align-items:center;gap:var(--space-4);padding:var(--space-4);border:1px solid var(--surface-border);border-radius:var(--radius-md);background:var(--surface-card);box-shadow:var(--shadow-card)}.grade-title{display:flex;min-width:0;flex:1;flex-direction:column;gap:3px}.grade-title strong{color:var(--text-heading);font-size:var(--text-sm)}.grade-title small,.course-name,.grade-feedback{color:var(--text-secondary);font-size:var(--text-xs)}.course-name{color:var(--practiq-violet-dark);font-weight:700}.grade-feedback{max-width:260px}.grade-pending-flag{color:var(--color-warning-dark);font-weight:700}.teacher-metric{display:flex;min-width:62px;flex-direction:column;text-align:center}.teacher-metric strong{color:var(--text-heading)}.teacher-metric span{color:var(--text-muted);font-size:10px}.grade-value{display:flex;min-width:70px;flex-direction:column;align-items:flex-end;color:var(--color-success-dark);font-size:var(--text-lg);font-weight:800}.grade-value small{font-size:var(--text-xs)}.grade-value.pending{color:var(--text-muted);font-size:var(--text-sm)}@media(max-width:650px){.course-select{width:100%}.grade-list li{align-items:flex-start;flex-wrap:wrap;gap:var(--space-2)}.grade-feedback{order:3;max-width:none;width:calc(100% - 80px)}.summary span:last-child{display:none}}
</style>
