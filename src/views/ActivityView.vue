<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import StudentLayout from "@/layouts/StudentLayout.vue";
import TeacherLayout from "@/layouts/TeacherLayout.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import StateMessage from "@/components/ui/StateMessage.vue";
import { useCampusRole } from "@/composables/useCampusRole";
import { useCourses } from "@/composables/useCourses";
import { AssignmentService } from "@/services/assignments/assignmentService";
import { MaterialService } from "@/services/materials/materialService";
import { ForumService } from "@/services/forums/forumService";
import { campusApi } from "@/api/request/server";
import type { Course } from "@/types";

type Activity = { id: string; course: Course; kind: "assignment" | "material" | "forum"; title: string; detail: string; at: string; to: string };
// Role in the current institution; the account-wide profile type is wrong
// for anyone who belongs to more than one school in different capacities.
const { role, isTeacher } = useCampusRole();
const { loadCourses } = useCourses(); const assignments = new AssignmentService(campusApi); const materials = new MaterialService(campusApi); const forums = new ForumService(campusApi);
const items = ref<Activity[]>([]); const loading = ref(true); const selectedCourse = ref("all");
const visible = computed(() => items.value.filter((item) => selectedCourse.value === "all" || item.course.id === selectedCourse.value));
onMounted(async () => { try { const courses = await loadCourses(); const data = await Promise.all(courses.map(async (course) => { const [as, ms, fs] = await Promise.all([assignments.listByCourse(course.id), materials.list(course.id), forums.listThreads(course.id)]); return [
  ...as.data.map((x) => ({ id:`a:${x.id}`,course,kind:"assignment" as const,title:`Nueva tarea: ${x.title}`,detail:x.due_at ? `Entrega: ${new Date(x.due_at).toLocaleDateString("es-AR")}` : "Sin fecha de entrega",at:x.created_at,to:`/${role.value}/courses/${course.id}` })),
  ...ms.map((x) => ({ id:`m:${x.id}`,course,kind:"material" as const,title:`Nuevo material: ${x.title}`,detail:x.description || (x.kind === "file" ? "Archivo compartido" : "Enlace compartido"),at:x.created_at,to:`/${role.value}/courses/${course.id}` })),
  ...fs.data.map((x) => ({ id:`f:${x.id}`,course,kind:"forum" as const,title:`Nuevo foro: ${x.title}`,detail:x.description || "Nueva discusión",at:x.created_at,to:`/${role.value}/courses/${course.id}/forum/${x.id}` }))
]; })); items.value = data.flat().sort((a,b) => new Date(b.at).getTime() - new Date(a.at).getTime()); } finally { loading.value = false; } });
const courseFilterOptions = computed(() => [
  { id: "all", title: "Todos los cursos" },
  ...Array.from(new Map(items.value.map((item) => [item.course.id, item.course])).values()),
]);
function formatDateTime(value: string) { return new Date(value).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" }); }

// A flat feed made a task published this morning look the same as one from
// three weeks ago. Grouping answers "is this still news?" before you read.
const groups = computed(() => {
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const weekAgo = startOfToday.getTime() - 6 * 24 * 3600 * 1000;
  const buckets: { label: string; items: Activity[] }[] = [
    { label: "Hoy", items: [] },
    { label: "Esta semana", items: [] },
    { label: "Antes", items: [] },
  ];
  for (const item of visible.value) {
    const at = new Date(item.at).getTime();
    const bucket = at >= startOfToday.getTime() ? 0 : at >= weekAgo ? 1 : 2;
    buckets[bucket].items.push(item);
  }
  return buckets.filter((bucket) => bucket.items.length);
});
function icon(kind: Activity["kind"]) { return kind === "assignment" ? "pi-file-edit" : kind === "material" ? "pi-folder-open" : "pi-comments"; }
function label(kind: Activity["kind"]) { return kind === "assignment" ? "Tarea" : kind === "material" ? "Material" : "Foro"; }
</script>
<template>
  <component :is="isTeacher ? TeacherLayout : StudentLayout">
    <section class="activity-page">
      <PageHeader
        eyebrow="Novedades de tus cursos"
        title="Actividad reciente"
        subtitle="Últimas tareas, materiales y foros publicados."
      >
        <template #actions>
          <Select
            v-model="selectedCourse"
            :options="courseFilterOptions"
            option-label="title"
            option-value="id"
            class="course-filter"
            aria-label="Filtrar por curso"
          />
        </template>
      </PageHeader>

      <StateMessage v-if="loading" variant="loading" loading-label="Cargando actividad" :rows="4" />
      <StateMessage
        v-else-if="!visible.length"
        icon="pi-bolt"
        title="Todavía no hay novedades"
        description="Cuando se publique una tarea, un material o un foro en tus cursos, aparecerá acá."
      />
      <template v-else>
      <section v-for="group in groups" :key="group.label" class="feed-group">
        <h2>{{ group.label }}</h2>
        <ol class="feed">
          <li v-for="item in group.items" :key="item.id">
            <span class="feed-rail">
              <span class="feed-icon" :class="`feed-icon--${item.kind}`"><i :class="`pi ${icon(item.kind)}`" aria-hidden="true"></i></span>
              <span class="feed-line" aria-hidden="true"></span>
            </span>
            <span class="feed-body">
              <strong>{{ item.title }}</strong>
              <small>{{ item.course.title }} · {{ label(item.kind) }} · {{ formatDateTime(item.at) }}</small>
              <RouterLink :to="item.to" class="feed-action">Abrir →</RouterLink>
            </span>
          </li>
        </ol>
      </section>
      </template>
    </section>
  </component>
</template>
<style scoped>
  .activity-page { max-width: 900px; }
  .course-filter { width: 230px; }
  @media (max-width: 600px) { .course-filter { width: 100%; } }

  .feed-group {
    padding: var(--space-5);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    background: var(--surface-card);
  }

  .feed-group + .feed-group { margin-top: var(--space-4); }

  .feed-group h2 {
    margin: 0 0 var(--space-4);
    color: var(--text-secondary);
    font-family: var(--font-ui-family);
    font-size: var(--text-sm);
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .feed { display: grid; margin: 0; padding: 0; list-style: none; }
  .feed li { display: flex; gap: var(--space-4); }

  .feed-rail { display: flex; flex: 0 0 34px; flex-direction: column; align-items: center; }

  .feed-icon {
    display: grid;
    width: 34px;
    height: 34px;
    place-items: center;
    border-radius: 11px;
    background: var(--practiq-violet-pale);
    color: var(--practiq-violet-dark);
  }

  .feed-icon--assignment { background: var(--color-warning-bg); color: var(--color-warning-dark); }
  .feed-line { flex: 1; width: 2px; margin: var(--space-1) 0; background: var(--surface-border); }
  .feed li:last-child .feed-line { display: none; }

  .feed-body { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 3px; padding-bottom: var(--space-6); }
  .feed li:last-child .feed-body { padding-bottom: 0; }
  .feed-body strong { color: var(--text-heading); font-size: var(--text-md); }
  .feed-body small { color: var(--text-secondary); font-size: var(--text-sm); }
  .feed-action { margin-top: var(--space-2); color: var(--practiq-violet-dark); font-size: var(--text-sm); font-weight: 700; }
</style>
