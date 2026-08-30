<script setup lang="ts">
  import { computed, onMounted } from "vue";
  import { useToast } from "primevue/usetoast";
  import StudentLayout from "@/layouts/StudentLayout.vue";
  import { useCourses } from "@/composables/useCourses";
  import { useCalendar } from "@/composables/useCalendar";
  import { useMessages } from "@/composables/useMessages";
  import { useAuthStore } from "@/stores/authStore";

  const toast = useToast();
  const authStore = useAuthStore();
  const { courses, loading, loadCourses } = useCourses();
  const {
    events,
    loading: calendarLoading,
    loadEvents,
  } = useCalendar();
  const {
    conversations,
    loading: messagesLoading,
    loadConversations,
  } = useMessages();

  const upcomingAssignments = computed(() => {
    const now = Date.now();
    return events.value
      .filter(
        (event) =>
          event.source === "assignment_due" &&
          new Date(event.starts_at).getTime() > now,
      )
      .sort(
        (first, second) =>
          new Date(first.starts_at).getTime() - new Date(second.starts_at).getTime(),
      )
      .slice(0, 5);
  });

  const recentConversations = computed(() =>
    [...conversations.value]
      .sort(
        (first, second) =>
          new Date(second.last_message_at || 0).getTime() -
          new Date(first.last_message_at || 0).getTime(),
      )
      .slice(0, 3),
  );
  // Draft is authoring state, not student-facing. Archived courses remain
  // visible as completed history, with a friendly status label.
  const visibleCourses = computed(() =>
    courses.value.filter((course) => course.status === "published" || course.status === "archived"),
  );

  function studentCourseStatus(status: string) {
    return status === "archived" ? "Finalizado" : "Activo";
  }

  function courseTitle(courseId: string | null) {
    return courses.value.find((course) => course.id === courseId)?.title;
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
    const results = await Promise.allSettled([
      loadCourses(),
      loadEvents(),
      loadConversations(),
    ]);

    if (results.some((result) => result.status === "rejected")) {
      toast.add({
        severity: "error",
        summary: "No se pudo cargar toda la información",
        detail: "Podés actualizar la página para volver a intentar.",
        life: 3500,
      });
    }
  }

  onMounted(() => {
    loadDashboard();
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
        <div class="summary-card"><span class="summary-icon"><i class="pi pi-book"></i></span><div><strong>{{ visibleCourses.length }}</strong><small>{{ visibleCourses.length === 1 ? "curso activo" : "cursos activos" }}</small></div></div>
        <div class="summary-card"><span class="summary-icon summary-icon--warning"><i class="pi pi-clock"></i></span><div><strong>{{ upcomingAssignments.length }}</strong><small>entregas próximas</small></div></div>
        <RouterLink to="/student/messages" class="summary-card summary-card--link"><span class="summary-icon summary-icon--message"><i class="pi pi-envelope"></i></span><div><strong>{{ recentConversations.length }}</strong><small>mensajes recientes</small></div><i class="pi pi-arrow-right summary-arrow"></i></RouterLink>
      </div>

      <div class="courses-heading"><h2>Mis cursos</h2><span v-if="visibleCourses.length">{{ visibleCourses.length }} en total</span></div>
      <div v-if="loading" class="state-message">Cargando tus cursos…</div>
      <div v-else-if="!visibleCourses.length" class="state-message">
        Todavía no estás matriculado en ningún curso. Pedile a tu docente que
        te agregue.
      </div>
      <div v-else class="course-grid">
        <RouterLink
          v-for="course in visibleCourses"
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
          <div class="course-title">{{ course.title }}</div>
          <p v-if="course.description" class="course-description">
            {{ course.description }}
          </p>
          <span class="course-open">Abrir curso <i class="pi pi-arrow-right"></i></span>
        </RouterLink>
      </div>

      <div class="dashboard-sections">
        <section class="dashboard-section">
          <div class="section-heading">
            <div>
              <h2>Próximas entregas</h2>
              <p>Fechas límite de tus actividades.</p>
            </div>
            <RouterLink to="/student/calendar" class="section-link">Ver calendario</RouterLink>
          </div>
          <div v-if="calendarLoading" class="section-state">Cargando entregas…</div>
          <div v-else-if="!upcomingAssignments.length" class="section-state">
            No tenés entregas próximas.
          </div>
          <div v-else class="assignment-list">
            <RouterLink
              v-for="assignment in upcomingAssignments"
              :key="assignment.id"
              :to="assignment.course_id ? `/student/courses/${assignment.course_id}` : '/student/calendar'"
              class="assignment-item"
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
              <h2>Mensajes recientes</h2>
              <p>Conversaciones más recientes.</p>
            </div>
            <RouterLink to="/student/messages" class="section-link">Ver mensajes</RouterLink>
          </div>
          <div v-if="messagesLoading" class="section-state">Cargando mensajes…</div>
          <div v-else-if="!recentConversations.length" class="section-state">
            Todavía no tenés mensajes.
          </div>
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
                <small>{{ conversation.last_message_body }}</small>
              </span>
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
  .summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--space-3);margin-bottom:var(--space-6)}.summary-card{display:flex;align-items:center;gap:var(--space-3);min-width:0;padding:var(--space-4);border:1px solid var(--surface-border);border-radius:var(--radius-md);background:var(--surface-card);color:inherit}.summary-card strong,.summary-card small{display:block}.summary-card strong{color:var(--text-heading);font-size:var(--text-lg)}.summary-card small{color:var(--text-secondary);font-size:var(--text-xs)}.summary-card--link:hover{box-shadow:var(--shadow-card)}.summary-icon{display:grid;place-items:center;width:38px;height:38px;flex:0 0 38px;border-radius:var(--radius-md);background:var(--fill-primary-subtle);color:var(--practiq-violet-dark)}.summary-icon--warning{background:var(--fill-warning-subtle);color:var(--color-warning-dark)}.summary-icon--message{background:var(--fill-success-subtle);color:var(--color-success-dark)}.summary-arrow{margin-left:auto;color:var(--text-muted);font-size:var(--text-sm)}
  .courses-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)}.courses-heading h2{margin:0;color:var(--text-heading);font-size:var(--text-lg)}.courses-heading span{color:var(--text-muted);font-size:var(--text-xs)}

  .state-message {
    padding: var(--space-6);
    border-radius: var(--radius-md);
    background: var(--surface-card);
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }

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

  @media (max-width: 700px) {
    .dashboard-sections {
      grid-template-columns: 1fr;
    }
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
  .course-open{display:inline-flex;align-items:center;gap:var(--space-1);margin-top:var(--space-4);color:var(--practiq-violet-dark);font-size:var(--text-xs);font-weight:800}
  @media (max-width:700px){.dashboard-head{align-items:stretch;flex-direction:column;padding:var(--space-5)}.head-action{justify-content:center}.summary-grid{grid-template-columns:1fr}.courses-heading{margin-top:var(--space-5)}}
</style>
