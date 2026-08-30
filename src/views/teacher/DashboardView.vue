<script setup lang="ts">
  import { computed, onMounted, ref, watch } from "vue";
  import TeacherLayout from "@/layouts/TeacherLayout.vue";
  import StateMessage from "@/components/ui/StateMessage.vue";
  import SkeletonGrid from "@/components/ui/SkeletonGrid.vue";
  import { useCourses } from "@/composables/useCourses";
  import { useAuthStore } from "@/stores/authStore";
  import { usePreferences } from "@/composables/usePreferences";

  const { courses, loading, loadCourses, deleteCourse, createCourse } = useCourses();
  const { loadPreference, savePreference } = usePreferences();
  const authStore = useAuthStore();
  const deleting = ref(false);
  const showCreate = ref(false);
  const creating = ref(false);
  const draft = ref({ title: "", description: "", labels: [] as string[] });
  const labelDraft = ref("");
  const savedLabels = computed(() =>
    [...new Set(courses.value.flatMap((course) => course.labels ?? []))]
      .filter((label) => !draft.value.labels.some((item) => item.toLowerCase() === label.toLowerCase())),
  );
  const viewMode = ref<"grid" | "list">("grid");
  const groupByLabels = ref(false);
  const preferencesLoaded = ref(false);
  const courseToDelete = ref<(typeof courses.value)[number] | null>(null);
  const publishedCount = computed(() => courses.value.filter((course) => course.status === "published").length);
  const draftCount = computed(() => courses.value.filter((course) => course.status === "draft").length);
  const courseGroups = computed(() => {
    if (!groupByLabels.value) return [{ label: "", courses: courses.value }];
    const groups = new Map<string, typeof courses.value>();
    for (const course of courses.value) {
      const label = course.labels?.[0]?.trim() || "Sin etiqueta";
      groups.set(label, [...(groups.get(label) ?? []), course]);
    }
    return [...groups.entries()]
      .sort(([first], [second]) => first.localeCompare(second, "es"))
      .map(([label, groupedCourses]) => ({ label, courses: groupedCourses }));
  });

  onMounted(async () => {
    void loadCourses();
    try {
      const preference = await loadPreference<{ coursesView?: "grid" | "list"; groupCoursesBy?: "label" | "none" }>("teacher.dashboard");
      if (preference.settings.coursesView === "list" || preference.settings.coursesView === "grid") viewMode.value = preference.settings.coursesView;
      groupByLabels.value = preference.settings.groupCoursesBy === "label";
    } catch {
      // Defaults keep dashboard usable when preferences are unavailable.
    } finally {
      preferencesLoaded.value = true;
    }
  });

  watch([viewMode, groupByLabels], () => {
    if (!preferencesLoaded.value) return;
    void savePreference("teacher.dashboard", {
      coursesView: viewMode.value,
      groupCoursesBy: groupByLabels.value ? "label" : "none",
    }).catch(() => undefined);
  });

  function openCreate() {
    draft.value = { title: "", description: "", labels: [] };
    labelDraft.value = "";
    showCreate.value = true;
  }

  function addLabel(value = labelDraft.value) {
    const label = value.trim();
    if (label && !draft.value.labels.some((item) => item.toLowerCase() === label.toLowerCase())) draft.value.labels.push(label);
    labelDraft.value = "";
  }

  function removeLabel(label: string) {
    draft.value.labels = draft.value.labels.filter((item) => item !== label);
  }

  async function handleCreate() {
    if (creating.value || !draft.value.title.trim()) return;
    creating.value = true;
    try {
      await createCourse({ ...draft.value });
      showCreate.value = false;
    } catch {
      // useCourses already surfaced the error via toast
    } finally { creating.value = false; }
  }

  async function confirmDelete() {
    if (!courseToDelete.value || deleting.value) return;
    deleting.value = true;
    try {
      await deleteCourse(courseToDelete.value.id);
      courseToDelete.value = null;
    } finally { deleting.value = false; }
  }
  // The card used to print the raw API value — "published", "draft" — in an
  // otherwise entirely Spanish interface.
  const COURSE_STATUS_LABELS: Record<string, string> = {
    draft: "Borrador",
    published: "Publicado",
    archived: "Archivado",
  };

  function courseStatusLabel(status: string) {
    return COURSE_STATUS_LABELS[status] ?? status;
  }
</script>

<template>
  <TeacherLayout>
    <div class="dashboard">
      <header class="dashboard-head">
        <div>
          <span class="eyebrow">Panel docente</span>
          <h1>Hola, {{ authStore.profile?.full_name?.split(" ")[0] || "docente" }}</h1>
          <p>Administrá tus cursos, actividades y comunicación en un solo lugar.</p>
        </div>
        <div class="dashboard-actions">
          <button type="button" class="new-course-btn" @click="openCreate">
            <i class="pi pi-plus"></i> Nuevo curso
          </button>
        </div>
      </header>

      <div class="summary-grid">
        <div class="summary-card"><span class="summary-icon"><i class="pi pi-book" aria-hidden="true"></i></span><div><span v-if="loading" class="skeleton summary-skeleton" aria-hidden="true"></span><strong v-else>{{ courses.length }}</strong><small>{{ courses.length === 1 ? "curso creado" : "cursos creados" }}</small></div></div>
        <div class="summary-card"><span class="summary-icon summary-icon--success"><i class="pi pi-check-circle" aria-hidden="true"></i></span><div><span v-if="loading" class="skeleton summary-skeleton" aria-hidden="true"></span><strong v-else>{{ publishedCount }}</strong><small>cursos publicados</small></div></div>
        <RouterLink to="/teacher/calendar" class="summary-card summary-card--link"><span class="summary-icon summary-icon--info"><i class="pi pi-calendar" aria-hidden="true"></i></span><div><span v-if="loading" class="skeleton summary-skeleton" aria-hidden="true"></span><strong v-else>{{ draftCount }}</strong><small>borradores por revisar</small></div><i class="pi pi-arrow-right summary-arrow" aria-hidden="true"></i></RouterLink>
      </div>

      <div class="courses-heading"><div><h2>Mis cursos</h2><p>Seleccioná un curso para gestionar secciones, tareas, alumnos y foro.</p></div><div class="courses-tools"><div class="view-controls" aria-label="Vista de cursos"><button type="button" :class="{ active: viewMode === 'grid' }" :aria-pressed="viewMode === 'grid'" title="Vista tarjetas" @click="viewMode = 'grid'"><i class="pi pi-th-large" /></button><button type="button" :class="{ active: viewMode === 'list' }" :aria-pressed="viewMode === 'list'" title="Vista lista" @click="viewMode = 'list'"><i class="pi pi-list" /></button><span></span><button type="button" :class="{ active: groupByLabels }" :aria-pressed="groupByLabels" title="Agrupar por etiquetas" @click="groupByLabels = !groupByLabels"><i class="pi pi-tags" /> <em>Etiquetas</em></button></div><RouterLink to="/teacher/messages" class="text-action"><i class="pi pi-envelope"></i> Mensajes</RouterLink></div></div>

      <SkeletonGrid v-if="loading" :cards="3" loading-label="Cargando tus cursos" />
      <StateMessage
        v-else-if="!courses.length"
        icon="pi-book"
        title="Todavía no creaste ningún curso"
        description="Creá tu primer curso para empezar a organizar contenido y alumnos."
      >
        <template #action>
          <button type="button" class="empty-action" @click="openCreate">
            <i class="pi pi-plus" aria-hidden="true"></i> Crear curso
          </button>
        </template>
      </StateMessage>
      <div v-else>
        <component v-for="group in courseGroups" :is="groupByLabels ? 'section' : 'div'" :key="group.label || 'all'" :class="groupByLabels ? 'course-group' : 'course-collection'">
          <div v-if="groupByLabels" class="course-group-head"><span><i class="pi pi-tag" /> {{ group.label }}</span><small>{{ group.courses.length }}</small></div>
          <div class="course-grid" :class="{ 'course-list': viewMode === 'list' }">
            <RouterLink v-for="course in group.courses" :key="course.id" :to="`/teacher/courses/${course.id}`" class="course-card">
              <div class="course-card-top"><span class="course-icon"><i class="pi pi-book"></i></span><span class="course-status" :class="`course-status--${course.status}`">{{ courseStatusLabel(course.status) }}</span></div>
              <div class="course-main"><div class="course-title">{{ course.title }}</div><p v-if="course.description" class="course-description">{{ course.description }}</p><div v-if="course.labels?.length" class="course-labels"><span v-for="label in course.labels" :key="label">{{ label }}</span></div></div>
              <div class="course-actions">
                <span class="course-open">Gestionar curso <i class="pi pi-arrow-right" aria-hidden="true"></i></span>
                <button class="delete-course" type="button" :aria-label="`Eliminar ${course.title}`" @click.prevent.stop="courseToDelete = course"><i class="pi pi-trash" aria-hidden="true"></i> Eliminar</button>
              </div>
            </RouterLink>
          </div>
        </component>
      </div>
      <Dialog v-model:visible="showCreate" modal header="Nuevo curso" :style="{ width: 'min(520px, calc(100vw - 32px))' }">
        <form class="course-form" @submit.prevent="handleCreate">
          <label class="field">
            <span class="field-label">Título</span>
            <InputText v-model="draft.title" autofocus required />
          </label>
          <div class="field">
            <span class="field-label">Etiquetas</span>
            <div class="label-entry">
              <InputText v-model="labelDraft" list="saved-course-labels" placeholder="Ej.: 2.º A, Turno tarde" @keydown.enter.prevent="addLabel()" />
              <datalist id="saved-course-labels"><option v-for="label in savedLabels" :key="label" :value="label" /></datalist>
              <Button type="button" label="Agregar" size="small" @click="addLabel()" />
            </div>
            <div v-if="draft.labels.length" class="label-chips">
              <span v-for="label in draft.labels" :key="label">{{ label }} <button type="button" @click="removeLabel(label)"><i class="pi pi-times" /></button></span>
            </div>
            <small>Al escribir se sugieren etiquetas usadas anteriormente. También podés crear una nueva.</small>
          </div>
          <label class="field">
            <span class="field-label">Descripción</span>
            <Textarea v-model="draft.description" rows="4" />
          </label>
          <div class="dialog-actions">
            <Button type="button" label="Cancelar" severity="secondary" text :disabled="creating" @click="showCreate = false" />
            <Button type="submit" label="Crear curso" :loading="creating" />
          </div>
        </form>
      </Dialog>
      <Dialog :visible="!!courseToDelete" modal header="Eliminar curso" :style="{ width: 'min(440px, calc(100vw - 32px))' }" @update:visible="(visible) => { if (!visible && !deleting) courseToDelete = null; }">
        <div class="delete-dialog"><span class="delete-dialog-icon"><i class="pi pi-exclamation-triangle"></i></span><p>Vas a eliminar <strong>{{ courseToDelete?.title }}</strong>.</p><small>También se eliminarán matrículas, secciones, tareas, entregas, foros y eventos vinculados. Esta acción no se puede deshacer.</small></div>
        <div class="dialog-actions"><Button label="Cancelar" severity="secondary" text :disabled="deleting" @click="courseToDelete = null" /><Button label="Eliminar curso" severity="danger" :loading="deleting" @click="confirmDelete" /></div>
      </Dialog>
    </div>
  </TeacherLayout>
</template>

<style scoped>
  .dashboard {
    max-width: 960px;
  }

  .dashboard-head { display:flex;align-items:flex-end;justify-content:space-between;gap:var(--space-4);padding:var(--space-6);margin-bottom:var(--space-4);border:1px solid var(--surface-border);border-radius:var(--radius-md);background:var(--gradient-brand-soft); }

  .dashboard-head h1 {
    margin:var(--space-1) 0;
    font-size: clamp(24px,4vw,32px);
    font-weight: 700;
    color: var(--text-heading);
  }
  .dashboard-head p{margin:0;color:var(--text-secondary);font-size:var(--text-sm)}.eyebrow{color:var(--practiq-violet-dark);font-size:var(--text-xs);font-weight:800;text-transform:uppercase;letter-spacing:.06em}

  .dashboard-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .new-course-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-4);
    border: 0;
    border-radius: var(--radius-md);
    background: var(--gradient-brand);
    color: var(--color-on-primary);
    font-weight: 700;
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .course-form { display:flex;flex-direction:column;gap:var(--space-4); }
  .field { display:flex;flex-direction:column;gap:var(--space-1); }
  .field-label { font-size:var(--text-xs);font-weight:700;color:var(--text-secondary); }
  .label-entry{display:flex;gap:var(--space-2)}.label-entry .p-inputtext{flex:1}.label-chips{display:flex;gap:var(--space-1);flex-wrap:wrap}.label-chips span{display:inline-flex;align-items:center;gap:var(--space-1);padding:3px 7px;border-radius:999px;background:var(--fill-primary-soft);color:var(--practiq-violet-dark);font-size:var(--text-xs);font-weight:700}.label-chips button{border:0;background:transparent;color:inherit;padding:0;cursor:pointer}.field small{color:var(--text-muted);font-size:var(--text-xs)}
  .summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--space-3);margin-bottom:var(--space-6)}.summary-card{display:flex;align-items:center;gap:var(--space-3);min-width:0;padding:var(--space-4);border:1px solid var(--surface-border);border-radius:var(--radius-md);background:var(--surface-card);color:inherit}.summary-card strong,.summary-card small{display:block}.summary-skeleton{display:block;width:28px;height:16px;margin-bottom:2px}.summary-card strong{color:var(--text-heading);font-size:var(--text-lg)}.summary-card small{color:var(--text-secondary);font-size:var(--text-xs)}.summary-card--link:hover{box-shadow:var(--shadow-card)}.summary-icon{display:grid;place-items:center;width:38px;height:38px;flex:0 0 38px;border-radius:var(--radius-md);background:var(--fill-primary-subtle);color:var(--practiq-violet-dark)}.summary-icon--success{background:var(--fill-success-subtle);color:var(--color-success-dark)}.summary-icon--info{background:var(--fill-primary-soft);color:var(--practiq-violet-dark)}.summary-arrow{margin-left:auto;color:var(--text-muted);font-size:var(--text-sm)}
  .courses-heading{display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);margin-bottom:var(--space-3)}.courses-heading h2{margin:0;color:var(--text-heading);font-size:var(--text-lg)}.courses-heading p{margin:var(--space-1) 0 0;color:var(--text-secondary);font-size:var(--text-xs)}.courses-tools{display:flex;align-items:center;gap:var(--space-3)}.text-action{display:inline-flex;align-items:center;gap:var(--space-1);color:var(--practiq-violet-dark);font-size:var(--text-xs);font-weight:800}.view-controls{display:flex;align-items:center;gap:2px;padding:3px;border:1px solid var(--surface-border);border-radius:var(--radius-sm);background:var(--surface-card)}.view-controls button{display:inline-flex;align-items:center;justify-content:center;gap:var(--space-1);height:28px;min-width:28px;padding:0 var(--space-2);border:0;border-radius:calc(var(--radius-sm) - 2px);background:transparent;color:var(--text-muted);font-size:var(--text-xs);font-weight:800;cursor:pointer}.view-controls button:hover{background:var(--surface-hover);color:var(--text-primary)}.view-controls button.active{background:var(--fill-primary-soft);color:var(--practiq-violet-dark)}.view-controls span{width:1px;height:16px;margin:0 2px;background:var(--surface-border)}.view-controls em{font-style:normal}



  .course-grid {
    display: grid;
    /* 240px only ever fit three columns on a desktop width, leaving the row
       half empty while each card grew to hold it. */
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: var(--space-3);
  }
  .course-group + .course-group { margin-top: var(--space-6); }
  .course-group-head { display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-2);padding:0 var(--space-1);color:var(--text-secondary);font-size:var(--text-sm);font-weight:800; }
  .course-group-head span{display:inline-flex;align-items:center;gap:var(--space-1)}.course-group-head small{display:grid;min-width:21px;height:21px;place-items:center;border-radius:var(--radius-pill);background:var(--surface-hover);color:var(--text-secondary);font-size:var(--text-xs)}

  .course-card {
    /* A column with the actions pinned to the bottom: as a plain block the
       "Gestionar curso" link and the delete button ran together on one line,
       and cards of different description lengths ended their actions at
       different heights. */
    display: flex;
    flex-direction: column;
    padding: var(--space-3);border:1px solid var(--surface-border);
    border-radius: var(--radius-md);
    background: var(--surface-card);
    box-shadow: var(--shadow-card);
    color: inherit;
    transition: var(--transition-fast);
  }

  .course-card:hover {
    box-shadow: var(--shadow-card-lg);
    transform:translateY(-2px);
  }
  .course-list { grid-template-columns: 1fr; }
  .course-list .course-card { display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;column-gap:var(--space-4);padding:var(--space-3) var(--space-4); }
  .course-list .course-card-top { margin:0; }.course-list .course-main{min-width:0}.course-list .course-description{display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:3px 0 0}.course-list .course-labels{margin-top:var(--space-2)}.course-list .course-actions{margin:0;gap:var(--space-4)}.course-list .course-open{margin:0;white-space:nowrap}.course-list .delete-course{margin:0;white-space:nowrap}

  .course-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }
  .course-icon{display:grid;place-items:center;width:26px;height:26px;flex:0 0 26px;border-radius:var(--radius-sm);background:var(--fill-primary-subtle);color:var(--practiq-violet-dark);font-size:var(--text-xs)}

  .course-title {
    font-weight: 700;
    color: var(--text-heading);
  }

  .course-status {
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
    padding: 2px var(--space-2);
    border-radius: var(--radius-pill);
    flex-shrink: 0;
  }

  .course-status--draft {
    background: var(--fill-warning-subtle);
    color: var(--color-warning-dark);
  }

  .course-status--published {
    background: var(--fill-success-subtle);
    color: var(--color-success-dark);
  }

  .course-status--archived {
    background: var(--surface-hover);
    color: var(--text-muted);
  }

  .course-description {
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }
  .course-labels{display:flex;gap:var(--space-1);flex-wrap:wrap;margin-top:var(--space-3)}.course-labels span{padding:2px 6px;border-radius:999px;background:var(--fill-primary-soft);color:var(--practiq-violet-dark);font-size:10px;font-weight:800}.course-actions{display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);margin-top:auto;padding-top:var(--space-3)}.course-open{display:inline-flex;align-items:center;gap:var(--space-1);color:var(--practiq-violet-dark);font-size:var(--text-xs);font-weight:800}.delete-course{display:inline-flex;align-items:center;gap:var(--space-1);padding:0;border:0;background:transparent;color:var(--text-muted);font-size:var(--text-xs);cursor:pointer}.delete-course:hover{color:var(--color-error-dark);text-decoration:underline}.empty-action{display:inline-flex;align-items:center;gap:var(--space-1);min-height:40px;padding:var(--space-2) var(--space-4);border:0;border-radius:var(--radius-md);background:var(--gradient-brand);color:var(--color-on-primary);font-size:var(--text-sm);font-weight:800;box-shadow:var(--shadow-violet);cursor:pointer}.delete-dialog{display:grid;grid-template-columns:auto 1fr;gap:var(--space-3);align-items:start}.delete-dialog p{margin:0;color:var(--text-primary)}.delete-dialog small{grid-column:2;color:var(--text-secondary);line-height:1.45}.delete-dialog-icon{display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:var(--fill-warning-subtle);color:var(--color-warning-dark)}.dialog-actions{display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-5)}
  @media(max-width:700px){.dashboard-head{align-items:stretch;flex-direction:column;padding:var(--space-5)}.new-course-btn{justify-content:center}.summary-grid{grid-template-columns:1fr}.courses-heading{align-items:flex-start;flex-direction:column}.courses-tools{width:100%;justify-content:space-between}.course-list .course-card{grid-template-columns:auto minmax(0,1fr);row-gap:var(--space-2)}.course-list .course-main{grid-column:1/-1;grid-row:2}.course-list .course-open{grid-column:1;grid-row:3}.course-list .delete-course{grid-column:2;grid-row:3;justify-self:end}}
</style>
