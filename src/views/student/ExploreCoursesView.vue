<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import StudentLayout from "@/layouts/StudentLayout.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import StateMessage from "@/components/ui/StateMessage.vue";
import { useCourses } from "@/composables/useCourses";
import { useEnrollments } from "@/composables/useEnrollments";

const { courses, loading, loadCourses } = useCourses();
const { myEnrollments, loadMine, enrollSelf } = useEnrollments();
const enrolling = ref<string | null>(null);
const search = ref("");
const area = ref("");

onMounted(() => { loadCourses({ publishedOnly: true }); loadMine(); });

function enrolled(id: string) { return myEnrollments.value.some((e) => e.course_id === id && e.status === "active"); }
async function enroll(id: string) { if (enrolling.value) return; enrolling.value = id; try { await enrollSelf(id); } finally { enrolling.value = null; } }

// The filter offers only labels that exist in the catalogue, so it can never
// point at an empty result set.
const areas = computed(() => [...new Set(courses.value.flatMap((course) => course.labels ?? []))].sort((a, b) => a.localeCompare(b, "es")));

const visibleCourses = computed(() => {
  const term = search.value.trim().toLowerCase();
  return courses.value.filter((course) => {
    const matchesArea = !area.value || course.labels?.includes(area.value);
    if (!matchesArea) return false;
    if (!term) return true;
    return `${course.title} ${course.description}`.toLowerCase().includes(term);
  });
});
</script>

<template>
  <StudentLayout>
    <div class="explore">
      <PageHeader
        eyebrow="Catálogo de tu institución"
        title="Explorar cursos"
        subtitle="Cursos publicados disponibles para vos. Pedí el alta y tu docente la confirma."
      />

      <div v-if="courses.length" class="explore-filters">
        <label class="search-field">
          <i class="pi pi-search" aria-hidden="true"></i>
          <input v-model="search" type="search" placeholder="Buscar por nombre o descripción" aria-label="Buscar cursos" />
        </label>
        <select v-if="areas.length" v-model="area" class="area-select" aria-label="Filtrar por área">
          <option value="">Todas las áreas</option>
          <option v-for="option in areas" :key="option" :value="option">{{ option }}</option>
        </select>
      </div>

      <StateMessage v-if="loading" variant="loading" loading-label="Cargando cursos" :rows="3" />
      <StateMessage
        v-else-if="!courses.length"
        icon="pi-compass"
        title="No hay cursos publicados"
        description="Cuando un docente publique un curso, vas a poder matricularte desde acá."
      />
      <StateMessage
        v-else-if="!visibleCourses.length"
        icon="pi-search"
        title="Ningún curso coincide con tu búsqueda"
        description="Probá con otro término o quitá el filtro de área."
      />
      <div v-else class="course-grid">
        <article v-for="course in visibleCourses" :key="course.id" class="course-card">
          <div class="course-card-top">
            <span class="course-icon"><i class="pi pi-book" aria-hidden="true"></i></span>
            <span v-if="course.labels?.length" class="course-area">{{ course.labels[0] }}</span>
          </div>
          <div class="course-main">
            <h2>{{ course.title }}</h2>
            <p v-if="course.description">{{ course.description }}</p>
          </div>
          <div v-if="course.labels && course.labels.length > 1" class="course-labels">
            <span v-for="label in course.labels.slice(1)" :key="label">{{ label }}</span>
          </div>
          <button v-if="enrolled(course.id)" type="button" class="enroll-btn enroll-btn--done" disabled>
            <i class="pi pi-check" aria-hidden="true"></i> Ya estás matriculado
          </button>
          <button
            v-else
            type="button"
            class="enroll-btn"
            :disabled="enrolling === course.id"
            :aria-label="`Matricularme en ${course.title}`"
            @click="enroll(course.id)"
          >
            {{ enrolling === course.id ? "Matriculando…" : "Pedir inscripción" }}
          </button>
        </article>
      </div>
    </div>
  </StudentLayout>
</template>

<style scoped>
  .explore { max-width: 960px; }

  .explore-filters {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-bottom: var(--space-5);
  }

  .search-field {
    display: flex;
    flex: 1;
    min-width: 230px;
    min-height: 46px;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-4);
    border: 1px solid var(--surface-border);
    border-radius: 11px;
    background: var(--surface-card);
    color: var(--text-muted);
  }

  .search-field input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: var(--text-heading);
    font-family: var(--font-body-family);
    font-size: var(--text-base);
  }

  .area-select {
    min-height: 46px;
    padding: 0 var(--space-3);
    border: 1px solid var(--surface-border);
    border-radius: 11px;
    background: var(--surface-card);
    color: var(--text-primary);
    font-family: var(--font-body-family);
    font-size: var(--text-base);
  }

  .course-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--space-3);
  }

  .course-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-5);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    background: var(--surface-card);
    transition: var(--transition);
  }

  .course-card:hover {
    border-color: var(--practiq-violet-200);
    box-shadow: var(--shadow-card-lg);
  }

  .course-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .course-icon {
    display: grid;
    width: 32px;
    height: 32px;
    place-items: center;
    border-radius: var(--radius-lg);
    background: var(--practiq-violet-pale);
    color: var(--practiq-violet-dark);
  }

  .course-area {
    padding: 3px 9px;
    border-radius: var(--radius-pill);
    background: var(--practiq-violet-pale);
    color: var(--practiq-violet-dark);
    font-size: var(--text-xs);
    font-weight: 700;
  }

  .course-main { flex: 1; }

  .course-main h2 {
    margin: 0;
    color: var(--text-heading);
    font-family: var(--font-ui-family);
    font-size: var(--text-lg);
    font-weight: 900;
    letter-spacing: -0.02em;
  }

  .course-main p {
    margin: var(--space-2) 0 0;
    color: var(--text-secondary);
    font-size: var(--text-sm);
    line-height: 1.55;
  }

  .course-labels { display: flex; flex-wrap: wrap; gap: var(--space-1); }
  .course-labels span { padding: 2px 6px; border-radius: var(--radius-pill); background: var(--fill-primary-soft); color: var(--practiq-violet-dark); font-size: 10px; font-weight: 800; }

  .enroll-btn {
    min-height: 44px;
    border: 0;
    border-radius: 11px;
    background: var(--practiq-violet);
    color: var(--color-on-primary);
    font-family: var(--font-ui-family);
    font-size: var(--text-base);
    font-weight: 900;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .enroll-btn:hover:not(:disabled) { background: var(--practiq-violet-600); transform: translateY(-2px); }
  .enroll-btn:disabled { cursor: not-allowed; }

  .enroll-btn--done {
    border: 1px solid var(--surface-border);
    background: var(--surface-bg);
    color: var(--text-secondary);
  }
</style>
