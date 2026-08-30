<script setup lang="ts">
  import { computed, onMounted, ref, watch } from "vue";
  import { useToast } from "primevue/usetoast";
  import StudentLayout from "@/layouts/StudentLayout.vue";
  import StateMessage from "@/components/ui/StateMessage.vue";
  import SkeletonGrid from "@/components/ui/SkeletonGrid.vue";
  import { useCourses } from "@/composables/useCourses";
  import { useCalendar } from "@/composables/useCalendar";
  import { useMessages } from "@/composables/useMessages";
  import { usePreferences } from "@/composables/usePreferences";
  import { useAuthStore } from "@/stores/authStore";

  const toast = useToast();
  const authStore = useAuthStore();
  const { courses, loading, loadCourses } = useCourses();
  const { events, loading: calendarLoading, loadEvents } = useCalendar();
  const { conversations, loading: messagesLoading, loadConversations } = useMessages();
  const { loadPreference, savePreference } = usePreferences();

  const viewMode = ref<"grid" | "list">("grid");
  const groupByLabels = ref(false);
  const preferencesLoaded = ref(false);

  // Draft is authoring state, not student-facing. Archived courses remain
  // visible as completed history, with a friendly status label.
  const visibleCourses = computed(() =>
    courses.value.filter((course) => course.status === "published" || course.status === "archived"),
  );

  const courseGroups = computed(() => {
    if (!groupByLabels.value) return [{ label: "", courses: visibleCourses.value }];
    const groups = new Map<string, typeof visibleCourses.value>();
    for (const course of visibleCourses.value) {
      const label = course.labels?.[0]?.trim() || "Sin etiqueta";
      groups.set(label, [...(groups.get(label) ?? []), course]);
    }
    return [...groups.entries()]
      .sort(([first], [second]) => first.localeCompare(second, "es"))
      .map(([label, groupedCourses]) => ({ label, courses: groupedCourses }));
  });

  const hasLabels = computed(() => visibleCourses.value.some((course) => course.labels?.length));

  // The dashboard shows only what needs acting on now; the full list lives in
  // the calendar.
  const upcomingAssignments = computed(() => {
    const now = Date.now();
    return events.value
      .filter((event) => event.source === "assignment_due" && new Date(event.starts_at).getTime() > now)
      .sort((first, second) => new Date(first.starts_at).getTime() - new Date(second.starts_at).getTime())
      .slice(0, 2);
  });

  const unreadCount = computed(() => conversations.value.filter((conversation) => conversation.unread).length);

  // Unread first, then by recency: read state is what makes the row worth
  // looking at, so sorting by date alone would bury it.
  const recentConversations = computed(() =>
    [...conversations.value]
      .sort((first, second) => {
        if (first.unread !== second.unread) return first.unread ? -1 : 1;
        return new Date(second.last_message_at || 0).getTime() - new Date(first.last_message_at || 0).getTime();
      })
      .slice(0, 3),
  );

  // Without this the preview of a message you sent reads exactly like an
  // incoming one, so your own last word looks like something to answer.
  function messagePreview(conversation: { last_message_body: string; last_message_sender_id: string }) {
    const mine = conversation.last_message_sender_id === authStore.profile?.id;
    return mine ? `Vos: ${conversation.last_message_body}` : conversation.last_message_body;
  }

  function studentCourseStatus(status: string) {
    return status === "archived" ? "Finalizado" : "Activo";
  }

  function courseTitle(courseId: string | null) {
    return courses.value.find((course) => course.id === courseId)?.title;
  }

  // Anything inside two days is what a student actually needs to act on, so it
  // gets visual weight instead of blending into the rest of the list.
  function isUrgent(startsAt: string) {
    return new Date(startsAt).getTime() - Date.now() < 48 * 3600 * 1000;
  }

  function formatDate(value: string | null) {
    if (!value) return "";
    return new Intl.DateTimeFormat("es-AR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  }

  async function loadDashboard() {
    const results = await Promise.allSettled([loadCourses(), loadEvents(), loadConversations()]);
    if (results.some((result) => result.status === "rejected")) {
      toast.add({
        severity: "error",
        summary: "No se pudo cargar toda la información",
        detail: "Podés actualizar la página para volver a intentar.",
        life: 3500,
      });
    }
  }

  onMounted(async () => {
    void loadDashboard();
    try {
      const preference = await loadPreference<{ coursesView?: "grid" | "list"; groupCoursesBy?: "label" | "none" }>(
        "student.dashboard",
      );
      if (preference.settings.coursesView === "list" || preference.settings.coursesView === "grid") {
        viewMode.value = preference.settings.coursesView;
      }
      groupByLabels.value = preference.settings.groupCoursesBy === "label";
    } catch {
      // Defaults keep the dashboard usable when preferences are unavailable.
    } finally {
      preferencesLoaded.value = true;
    }
  });

  watch([viewMode, groupByLabels], () => {
    if (!preferencesLoaded.value) return;
    void savePreference("student.dashboard", {
      coursesView: viewMode.value,
      groupCoursesBy: groupByLabels.value ? "label" : "none",
    }).catch(() => undefined);
  });
</script>

<template>
  <StudentLayout>
    <div class="dashboard">
      <header class="dashboard-head">
        <div>
          <span class="eyebrow">Tu espacio de aprendizaje</span>
          <h1>Hola, {{ authStore.profile?.full_name?.split(" ")[0] || "estudiante" }}</h1>
          <p>Continuá con tus cursos y mantené al día tus actividades.</p>
        </div>
        <RouterLink to="/student/calendar" class="head-action"><i class="pi pi-calendar"></i> Ver calendario</RouterLink>
      </header>

      <div class="summary-grid">
        <div class="summary-card">
          <span class="summary-icon"><i class="pi pi-book" aria-hidden="true"></i></span>
          <div>
            <span v-if="loading" class="skeleton summary-skeleton" aria-hidden="true"></span>
            <strong v-else>{{ visibleCourses.length }}</strong>
            <small>{{ visibleCourses.length === 1 ? "curso activo" : "cursos activos" }}</small>
          </div>
        </div>
        <RouterLink to="/student/calendar" class="summary-card summary-card--link">
          <span class="summary-icon summary-icon--warning"><i class="pi pi-clock" aria-hidden="true"></i></span>
          <div>
            <span v-if="calendarLoading" class="skeleton summary-skeleton" aria-hidden="true"></span>
            <strong v-else>{{ upcomingAssignments.length }}</strong>
            <small>entregas próximas</small>
          </div>
          <i class="pi pi-arrow-right summary-arrow" aria-hidden="true"></i>
        </RouterLink>
        <RouterLink to="/student/messages" class="summary-card summary-card--link">
          <span class="summary-icon summary-icon--message"><i class="pi pi-envelope" aria-hidden="true"></i></span>
          <div>
            <span v-if="messagesLoading" class="skeleton summary-skeleton" aria-hidden="true"></span>
            <strong v-else>{{ unreadCount }}</strong>
            <small>{{ unreadCount === 1 ? "mensaje sin leer" : "mensajes sin leer" }}</small>
          </div>
          <i class="pi pi-arrow-right summary-arrow" aria-hidden="true"></i>
        </RouterLink>
      </div>

      <div class="courses-heading">
        <div>
          <h2>Mis cursos</h2>
          <p>Abrí un curso para ver material, tareas y el foro.</p>
        </div>
        <div class="courses-tools">
          <div v-if="visibleCourses.length" class="view-controls" aria-label="Vista de cursos">
            <button
              type="button"
              :class="{ active: viewMode === 'grid' }"
              :aria-pressed="viewMode === 'grid'"
              title="Vista tarjetas"
              @click="viewMode = 'grid'"
            >
              <i class="pi pi-th-large" />
            </button>
            <button
              type="button"
              :class="{ active: viewMode === 'list' }"
              :aria-pressed="viewMode === 'list'"
              title="Vista lista"
              @click="viewMode = 'list'"
            >
              <i class="pi pi-list" />
            </button>
            <template v-if="hasLabels">
              <span></span>
              <button
                type="button"
                :class="{ active: groupByLabels }"
                :aria-pressed="groupByLabels"
                title="Agrupar por etiquetas"
                @click="groupByLabels = !groupByLabels"
              >
                <i class="pi pi-tags" /> <em>Etiquetas</em>
              </button>
            </template>
          </div>
          <RouterLink to="/student/explore" class="text-action"><i class="pi pi-compass"></i> Explorar</RouterLink>
        </div>
      </div>

      <SkeletonGrid v-if="loading" :cards="3" loading-label="Cargando tus cursos" />
      <StateMessage
        v-else-if="!visibleCourses.length"
        icon="pi-book"
        title="Todavía no estás matriculado en ningún curso"
        description="Explorá los cursos publicados o pedile a tu docente que te agregue."
      >
        <template #action>
          <RouterLink to="/student/explore" class="empty-action">
            <i class="pi pi-compass" aria-hidden="true"></i> Explorar cursos
          </RouterLink>
        </template>
      </StateMessage>
      <div v-else>
        <component
          v-for="group in courseGroups"
          :is="groupByLabels ? 'section' : 'div'"
          :key="group.label || 'all'"
          :class="groupByLabels ? 'course-group' : 'course-collection'"
        >
          <div v-if="groupByLabels" class="course-group-head">
            <span><i class="pi pi-tag" /> {{ group.label }}</span>
            <small>{{ group.courses.length }}</small>
          </div>
          <div class="course-grid" :class="{ 'course-list': viewMode === 'list' }">
            <RouterLink
              v-for="course in group.courses"
              :key="course.id"
              :to="`/student/courses/${course.id}`"
              class="course-card"
            >
              <div class="course-card-top">
                <span class="course-icon"><i class="pi pi-book"></i></span>
                <span class="course-status" :class="`course-status--${course.status}`">
                  {{ studentCourseStatus(course.status) }}
                </span>
              </div>
              <div class="course-main">
                <div class="course-title">{{ course.title }}</div>
                <p v-if="course.description" class="course-description">{{ course.description }}</p>
                <div v-if="course.labels?.length" class="course-labels">
                  <span v-for="label in course.labels" :key="label">{{ label }}</span>
                </div>
              </div>
              <span class="course-open">Abrir curso <i class="pi pi-arrow-right"></i></span>
            </RouterLink>
          </div>
        </component>
      </div>

      <div class="dashboard-sections">
        <section class="dashboard-section">
          <div class="section-heading">
            <div>
              <h2>Próximas entregas</h2>
              <p>Las 2 más cercanas. El resto, en el calendario.</p>
            </div>
            <RouterLink to="/student/calendar" class="section-link">Ver calendario</RouterLink>
          </div>
          <StateMessage v-if="calendarLoading" variant="loading" dense :rows="2" loading-label="Cargando entregas" />
          <p v-else-if="!upcomingAssignments.length" class="section-state">No tenés entregas próximas.</p>
          <div v-else class="assignment-list">
            <RouterLink
              v-for="assignment in upcomingAssignments"
              :key="assignment.id"
              :to="assignment.course_id ? `/student/courses/${assignment.course_id}` : '/student/calendar'"
              class="assignment-item"
              :class="{ 'assignment-item--urgent': isUrgent(assignment.starts_at) }"
            >
              <span class="assignment-icon"><i class="pi pi-calendar"></i></span>
              <span class="assignment-content">
                <strong>{{ assignment.title }}</strong>
                <small>{{ courseTitle(assignment.course_id) || "Actividad" }}</small>
              </span>
              <time>{{ formatDate(assignment.starts_at) }}</time>
            </RouterLink>
          </div>
        </section>

        <section class="dashboard-section">
          <div class="section-heading">
            <div>
              <h2>Mensajes</h2>
              <p>Primero los que no leíste.</p>
            </div>
            <RouterLink to="/student/messages" class="section-link">Ver mensajes</RouterLink>
          </div>
          <StateMessage v-if="messagesLoading" variant="loading" dense :rows="2" loading-label="Cargando mensajes" />
          <p v-else-if="!recentConversations.length" class="section-state">Todavía no tenés mensajes.</p>
          <div v-else class="message-list">
            <RouterLink
              v-for="conversation in recentConversations"
              :key="conversation.id"
              to="/student/messages"
              class="message-item"
            >
              <span class="message-avatar">{{ conversation.other_user_name.charAt(0) }}</span>
              <span class="message-content">
                <strong>{{ conversation.other_user_name }}</strong>
                <small>{{ messagePreview(conversation) }}</small>
              </span>
              <span v-if="conversation.unread" class="unread-dot" aria-label="Sin leer"></span>
              <time>{{ formatDate(conversation.last_message_at) }}</time>
            </RouterLink>
          </div>
        </section>
      </div>
    </div>
  </StudentLayout>
</template>

<style scoped>
  .dashboard {
    max-width: 960px;
  }

  .dashboard-head { display:flex;align-items:flex-end;justify-content:space-between;gap:var(--space-4);padding:var(--space-6);margin-bottom:var(--space-4);border:1px solid var(--surface-border);border-radius:var(--radius-lg);background:var(--gradient-brand-soft); }

  .dashboard-head h1 {
    margin:var(--space-1) 0;
    font-size: clamp(24px,4vw,32px);
    font-weight: 700;
    color: var(--text-heading);
  }
  .dashboard-head p{margin:0;color:var(--text-secondary);font-size:var(--text-sm)}.eyebrow{color:var(--practiq-violet-dark);font-size:var(--text-xs);font-weight:800;text-transform:uppercase;letter-spacing:.06em}.head-action{display:inline-flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);background:var(--surface-card);color:var(--practiq-violet-dark);font-size:var(--text-sm);font-weight:700;box-shadow:var(--shadow-card)}
  .summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--space-3);margin-bottom:var(--space-6)}.summary-card{display:flex;align-items:center;gap:var(--space-3);min-width:0;padding:var(--space-4);border:1px solid var(--surface-border);border-radius:var(--radius-md);background:var(--surface-card);color:inherit}.summary-card strong,.summary-card small{display:block}.summary-skeleton{display:block;width:28px;height:16px;margin-bottom:2px}.summary-card strong{color:var(--text-heading);font-size:var(--text-lg)}.summary-card small{color:var(--text-secondary);font-size:var(--text-xs)}.summary-card--link:hover{box-shadow:var(--shadow-card)}.summary-icon{display:grid;place-items:center;width:38px;height:38px;flex:0 0 38px;border-radius:var(--radius-md);background:var(--fill-primary-subtle);color:var(--practiq-violet-dark)}.summary-icon--warning{background:var(--fill-warning-subtle);color:var(--color-warning-dark)}.summary-icon--message{background:var(--fill-success-subtle);color:var(--color-success-dark)}.summary-arrow{margin-left:auto;color:var(--text-muted);font-size:var(--text-sm)}

  .courses-heading{display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);margin-bottom:var(--space-3)}.courses-heading h2{margin:0;color:var(--text-heading);font-size:var(--text-lg)}.courses-heading p{margin:var(--space-1) 0 0;color:var(--text-secondary);font-size:var(--text-xs)}.courses-tools{display:flex;align-items:center;gap:var(--space-3)}.text-action{display:inline-flex;align-items:center;gap:var(--space-1);color:var(--practiq-violet-dark);font-size:var(--text-xs);font-weight:800}.view-controls{display:flex;align-items:center;gap:2px;padding:3px;border:1px solid var(--surface-border);border-radius:var(--radius-sm);background:var(--surface-card)}.view-controls button{display:inline-flex;align-items:center;justify-content:center;gap:var(--space-1);height:28px;min-width:28px;padding:0 var(--space-2);border:0;border-radius:calc(var(--radius-sm) - 2px);background:transparent;color:var(--text-muted);font-size:var(--text-xs);font-weight:800;cursor:pointer}.view-controls button:hover{background:var(--surface-hover);color:var(--text-primary)}.view-controls button.active{background:var(--fill-primary-soft);color:var(--practiq-violet-dark)}.view-controls span{width:1px;height:16px;margin:0 2px;background:var(--surface-border)}.view-controls em{font-style:normal}

  .empty-action{display:inline-flex;align-items:center;gap:var(--space-1);min-height:40px;padding:var(--space-2) var(--space-4);border-radius:var(--radius-md);background:var(--gradient-brand);color:var(--color-on-primary);font-size:var(--text-sm);font-weight:800;box-shadow:var(--shadow-violet)}

  .course-group + .course-group { margin-top: var(--space-6); }
  .course-group-head { display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-2);padding:0 var(--space-1);color:var(--text-secondary);font-size:var(--text-sm);font-weight:800; }
  .course-group-head span{display:inline-flex;align-items:center;gap:var(--space-1)}.course-group-head small{display:grid;min-width:21px;height:21px;place-items:center;border-radius:var(--radius-pill);background:var(--surface-hover);color:var(--text-secondary);font-size:var(--text-xs)}

  .course-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--space-3);
  }

  .course-card {
    display: block;
    padding: var(--space-4);
    border:1px solid var(--surface-border);
    border-radius: var(--radius-md);
    background: var(--surface-card);
    box-shadow: var(--shadow-card);
    color: inherit;
    transition: var(--transition-fast);
  }

  .course-list{grid-template-columns:1fr}.course-list .course-card{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:var(--space-3)}.course-list .course-card-top{margin:0}.course-list .course-main{min-width:0}.course-list .course-description{margin:3px 0 0}.course-list .course-labels{margin-top:var(--space-2)}.course-list .course-open{margin:0;white-space:nowrap}

  .course-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }
  .course-icon{display:grid;place-items:center;width:36px;height:36px;border-radius:var(--radius-md);background:var(--fill-primary-subtle);color:var(--practiq-violet-dark)}

  .course-status {
    flex-shrink: 0;
    padding: 2px var(--space-2);
    border-radius: var(--radius-pill);
    font-size: var(--text-xs);
    font-weight: 700;
    text-transform: uppercase;
  }

  .course-status--published {
    background: var(--fill-success-subtle);
    color: var(--color-success-dark);
  }

  .course-status--archived {
    background: var(--surface-hover);
    color: var(--text-muted);
  }

  .dashboard-sections {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
    margin-top: var(--space-5);
  }

  .dashboard-section {
    min-width: 0;
    padding: var(--space-5);
    border:1px solid var(--surface-border);
    border-radius: var(--radius-md);
    background: var(--surface-card);
    box-shadow: var(--shadow-card);
  }

  .section-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .section-heading h2 {
    margin: 0;
    color: var(--text-heading);
    font-size: var(--text-base);
  }

  .section-heading p {
    margin: var(--space-1) 0 0;
    color: var(--text-secondary);
    font-size: var(--text-xs);
  }

  .section-link {
    flex-shrink: 0;
    color: var(--practiq-violet-700);
    font-size: var(--text-xs);
    font-weight: 700;
  }

  .section-state {
    margin: 0;
    padding: var(--space-4) 0;
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }

  .assignment-list,
  .message-list {
    display: grid;
    gap: var(--space-2);
  }

  .assignment-item,
  .message-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
    padding: var(--space-2);
    border-radius: var(--radius-md);
    color: inherit;
    transition: var(--transition-fast);
  }

  .assignment-item:hover,
  .message-item:hover {
    background: var(--surface-hover);
  }

  .assignment-item--urgent .assignment-icon{background:var(--fill-warning-subtle);color:var(--color-warning-dark)}.assignment-item--urgent time{color:var(--color-warning-dark);font-weight:800}
  .unread-dot{flex-shrink:0;width:8px;height:8px;border-radius:50%;background:var(--color-error)}

  .assignment-icon,
  .message-avatar {
    display: grid;
    flex: 0 0 32px;
    width: 32px;
    height: 32px;
    place-items: center;
    border-radius: var(--radius-md);
    background: var(--fill-primary-subtle);
    color: var(--practiq-violet-700);
    font-size: var(--text-xs);
    font-weight: 700;
  }

  .assignment-content,
  .message-content {
    display: grid;
    flex: 1;
    min-width: 0;
    gap: 2px;
  }

  .assignment-content strong,
  .message-content strong {
    overflow: hidden;
    color: var(--text-heading);
    font-size: var(--text-sm);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .assignment-content small,
  .message-content small {
    overflow: hidden;
    color: var(--text-secondary);
    font-size: var(--text-xs);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .assignment-item time,
  .message-item time {
    flex-shrink: 0;
    color: var(--text-muted);
    font-size: 11px;
  }

  .course-card:hover {
    box-shadow: var(--shadow-card-lg);
    transform:translateY(-2px);
  }

  .course-title {
    font-weight: 700;
    color: var(--text-heading);
    margin-bottom: var(--space-1);
  }

  .course-description {
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }
  .course-labels{display:flex;gap:var(--space-1);flex-wrap:wrap;margin-top:var(--space-3)}.course-labels span{padding:2px 6px;border-radius:999px;background:var(--fill-primary-soft);color:var(--practiq-violet-dark);font-size:10px;font-weight:800}
  .course-open{display:inline-flex;align-items:center;gap:var(--space-1);margin-top:var(--space-4);color:var(--practiq-violet-dark);font-size:var(--text-xs);font-weight:800}

  @media (max-width: 700px) {
    .dashboard-sections { grid-template-columns: 1fr; }
    .dashboard-head{align-items:stretch;flex-direction:column;padding:var(--space-5)}
    .head-action{justify-content:center}
    .summary-grid{grid-template-columns:1fr}
    .courses-heading{align-items:flex-start;flex-direction:column;margin-top:var(--space-5)}
    .courses-tools{width:100%;justify-content:space-between}
    .course-list .course-card{grid-template-columns:auto minmax(0,1fr);row-gap:var(--space-2)}
    .course-list .course-main{grid-column:1/-1;grid-row:2}
    .course-list .course-open{grid-column:1/-1;grid-row:3}
  }
</style>
