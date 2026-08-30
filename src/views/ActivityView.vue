<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import StudentLayout from "@/layouts/StudentLayout.vue";
import TeacherLayout from "@/layouts/TeacherLayout.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import StateMessage from "@/components/ui/StateMessage.vue";
import { useAuthStore } from "@/stores/authStore";
import { useCourses } from "@/composables/useCourses";
import { AssignmentService } from "@/services/assignments/assignmentService";
import { MaterialService } from "@/services/materials/materialService";
import { ForumService } from "@/services/forums/forumService";
import { campusApi } from "@/api/request/server";
import type { Course } from "@/types";

type Activity = { id: string; course: Course; kind: "assignment" | "material" | "forum"; title: string; detail: string; at: string; to: string };
const auth = useAuthStore(); const isTeacher = computed(() => auth.profile?.profile_type === "teacher"); const role = computed(() => isTeacher.value ? "teacher" : "student");
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
function icon(kind: Activity["kind"]) { return kind === "assignment" ? "pi-file-edit" : kind === "material" ? "pi-folder-open" : "pi-comments"; }
function label(kind: Activity["kind"]) { return kind === "assignment" ? "Tarea" : kind === "material" ? "Material" : "Foro"; }
</script>
<template>
  <component :is="isTeacher ? TeacherLayout : StudentLayout">
    <section class="activity-page">
      <PageHeader
        eyebrow="Novedades"
        title="Actividad reciente"
        subtitle="Últimas tareas, materiales y foros publicados en tus cursos."
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
      <ol v-else class="feed">
        <li v-for="item in visible" :key="item.id">
          <span class="feed-icon"><i :class="`pi ${icon(item.kind)}`" aria-hidden="true"></i></span>
          <RouterLink :to="item.to">
            <small>{{ item.course.title }} · {{ label(item.kind) }}</small>
            <strong>{{ item.title }}</strong>
            <span>{{ item.detail }}</span>
            <time :datetime="item.at">{{ formatDateTime(item.at) }}</time>
          </RouterLink>
        </li>
      </ol>
    </section>
  </component>
</template>
<style scoped>.activity-page{max-width:900px}.course-filter{width:230px}@media(max-width:600px){.course-filter{width:100%}}.feed{position:relative;display:flex;flex-direction:column;gap:var(--space-2);padding:0;list-style:none}.feed:before{position:absolute;top:20px;bottom:20px;left:19px;width:1px;background:var(--surface-border);content:""}.feed li{position:relative;display:flex;gap:var(--space-3);align-items:flex-start}.feed-icon{z-index:1;display:grid;width:40px;height:40px;flex:0 0 40px;border:1px solid var(--surface-border);border-radius:50%;place-items:center;background:var(--surface-card);color:var(--practiq-violet-dark)}.feed a{display:flex;min-width:0;flex:1;flex-direction:column;gap:3px;padding:var(--space-3) var(--space-4);border:1px solid var(--surface-border);border-radius:var(--radius-md);background:var(--surface-card);box-shadow:var(--shadow-card);color:inherit}.feed a:hover{border-color:var(--practiq-violet-dark)}.feed small,time,.feed span{color:var(--text-secondary);font-size:var(--text-xs)}.feed small{color:var(--practiq-violet-dark);font-weight:700}.feed strong{color:var(--text-heading);font-size:var(--text-sm)}time{margin-top:var(--space-1);color:var(--text-muted)}</style>
