<script setup lang="ts">
import { onMounted, ref } from "vue";
import StudentLayout from "@/layouts/StudentLayout.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import StateMessage from "@/components/ui/StateMessage.vue";
import { useCourses } from "@/composables/useCourses";
import { useEnrollments } from "@/composables/useEnrollments";

const { courses, loading, loadCourses } = useCourses();
const { myEnrollments, loadMine, enrollSelf } = useEnrollments();
const enrolling = ref<string | null>(null);
onMounted(() => { loadCourses({ publishedOnly: true }); loadMine(); });
function enrolled(id: string) { return myEnrollments.value.some((e) => e.course_id === id && e.status === "active"); }
async function enroll(id: string) { if (enrolling.value) return; enrolling.value = id; try { await enrollSelf(id); } finally { enrolling.value = null; } }
</script>
<template>
  <StudentLayout>
    <div class="explore">
      <PageHeader
        eyebrow="Catálogo"
        title="Explorar cursos"
        subtitle="Cursos publicados disponibles para vos."
      />

      <StateMessage v-if="loading" variant="loading" loading-label="Cargando cursos" :rows="3" />
      <StateMessage
        v-else-if="!courses.length"
        icon="pi-compass"
        title="No hay cursos publicados"
        description="Cuando un docente publique un curso, vas a poder matricularte desde acá."
      />
      <div v-else class="course-grid">
        <article v-for="course in courses" :key="course.id" class="course-card">
          <h2>{{ course.title }}</h2>
          <p v-if="course.description">{{ course.description }}</p>
          <div v-if="course.labels?.length" class="course-labels">
            <span v-for="label in course.labels" :key="label">{{ label }}</span>
          </div>
          <Button
            v-if="enrolled(course.id)"
            label="Ya estás matriculado"
            icon="pi pi-check"
            severity="secondary"
            outlined
            disabled
            size="small"
          />
          <Button
            v-else
            :label="enrolling === course.id ? 'Matriculando…' : 'Matricularme'"
            :aria-label="`Matricularme en ${course.title}`"
            size="small"
            :loading="enrolling === course.id"
            @click="enroll(course.id)"
          />
        </article>
      </div>
    </div>
  </StudentLayout>
</template>
<style scoped>
.explore{max-width:960px}.course-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:var(--space-4)}.course-card{display:flex;flex-direction:column;padding:var(--space-5);border:1px solid var(--surface-border);border-radius:var(--radius-lg);background:var(--surface-card);box-shadow:var(--shadow-card);transition:var(--transition)}.course-card:hover{border-color:var(--practiq-violet-light);box-shadow:var(--shadow-card-lg)}.course-card :deep(.p-button){margin-top:auto;align-self:flex-start}h2{font-size:var(--text-md);color:var(--text-heading);margin-bottom:var(--space-2)}.course-card p{font-size:var(--text-sm);color:var(--text-secondary);min-height:40px}.course-labels{display:flex;gap:var(--space-1);flex-wrap:wrap;margin-bottom:var(--space-3)}.course-labels span{padding:2px 6px;border-radius:999px;background:var(--fill-primary-soft);color:var(--practiq-violet-dark);font-size:10px;font-weight:800}
</style>
