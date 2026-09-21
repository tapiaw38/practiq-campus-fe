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
  import { campusApi } from "@/api/request/server";

  const toast = useToast();
  const authStore = useAuthStore();
  const { courses, loading, loadCourses } = useCourses();
  const { events, loading: calendarLoading, loadEvents } = useCalendar();
  const { conversations, loading: messagesLoading, loadConversations } = useMessages();
  const { loadPreference, savePreference } = usePreferences();

  const viewMode = ref<"grid" | "list">("grid");
  const groupByLabels = ref(false);
  const preferencesLoaded = ref(false);
  type CourseProgress = { course_id: string; progress_percent: number; pending_items: number; next_due_at: string | null; next_due_title: string };
  const progressByCourse = ref(new Map<string, CourseProgress>());

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
  const pendingAssignments = computed(() => {
    const now = Date.now();
    return events.value
      .filter((event) => event.source === "assignment_due" && new Date(event.starts_at).getTime() > now)
      .sort((first, second) => new Date(first.starts_at).getTime() - new Date(second.starts_at).getTime());
  });

  function endOfToday() {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return end.getTime();
  }

  // Today and the rest of the week are different decisions: one is "do this
  // now", the other is "know it is coming". Mixing them in one list made every
  // row look equally urgent.
  const todayAssignments = computed(() =>
    pendingAssignments.value.filter((event) => new Date(event.starts_at).getTime() <= endOfToday()).slice(0, 2),
  );

  const weekAssignments = computed(() =>
    pendingAssignments.value.filter((event) => new Date(event.starts_at).getTime() > endOfToday()).slice(0, 3),
  );

  const todayLabel = computed(() => {
    const label = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(
      new Date(),
    );
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  const focusSummary = computed(() => {
    const today = todayAssignments.value.length;
    const week = weekAssignments.value.length;
    if (!today && !week) return "No tenés entregas pendientes. Buen momento para repasar.";
    const todayPart = today === 1 ? "1 cosa para resolver hoy" : `${today} cosas para resolver hoy`;
    const weekPart = week === 1 ? "1 esta semana" : `${week} esta semana`;
    if (!today) return `Tenés ${weekPart}.`;
    if (!week) return `Tenés ${todayPart}.`;
    return `Tenés ${todayPart} y ${weekPart}.`;
  });

  const pendingByCourse = computed(() => {
    if (progressByCourse.value.size) return new Map([...progressByCourse.value].map(([id, item]) => [id, item.pending_items]));
    const counts = new Map<string, number>();
    for (const event of pendingAssignments.value) {
      if (!event.course_id) continue;
      counts.set(event.course_id, (counts.get(event.course_id) ?? 0) + 1);
    }
    return counts;
  });

  function nextDueLabel(courseId: string) {
    const summary = progressByCourse.value.get(courseId);
    if (summary?.next_due_at) return `Próxima entrega: ${formatDate(summary.next_due_at)}`;
    const next = pendingAssignments.value.find((event) => event.course_id === courseId);
    return next ? `Próxima entrega: ${formatDate(next.starts_at)}` : "Sin entregas próximas";
  }

  function dayNumber(value: string) {
    return new Date(value).getDate();
  }

  function monthLabel(value: string) {
    return new Intl.DateTimeFormat("es-AR", { month: "short" }).format(new Date(value)).replace(".", "").toUpperCase();
  }

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
    const results = await Promise.allSettled([loadCourses(), loadEvents(), loadConversations(), loadCourseProgress()]);
    if (results.some((result) => result.status === "rejected")) {
      toast.add({
        severity: "error",
        summary: "No se pudo cargar toda la información",
        detail: "Podés actualizar la página para volver a intentar.",
        life: 3500,
      });
    }
  }

  async function loadCourseProgress() {
    const { data } = await campusApi.get<{ data: CourseProgress[] }>("/student/dashboard");
    progressByCourse.value = new Map(data.data.map((item) => [item.course_id, item]));
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
          <span class="eyebrow">{{ todayLabel }}</span>
          <h1>Hola, {{ authStore.profile?.full_name?.split(" ")[0] || "estudiante" }}</h1>
          <p>{{ focusSummary }}</p>
        </div>
        <RouterLink to="/student/calendar" class="head-action"><i class="pi pi-calendar"></i> Ver calendario</RouterLink>
      </header>

      <section v-if="todayAssignments.length" class="today-focus" aria-labelledby="today-focus-title">
        <div class="today-focus-head">
          <h2 id="today-focus-title">Para hoy</h2>
          <span>{{ todayAssignments.length }} {{ todayAssignments.length === 1 ? "pendiente" : "pendientes" }}</span>
        </div>
        <div class="today-focus-list">
          <article
            v-for="(assignment, index) in todayAssignments"
            :key="assignment.id"
            class="today-focus-item"
            :class="{ 'today-focus-item--lead': index === 0 }"
          >
            <span class="today-focus-icon"><i class="pi" :class="index === 0 ? 'pi-clock' : 'pi-verified'"></i></span>
            <span class="today-focus-copy">
              <strong>{{ assignment.title }}</strong>
              <small>{{ courseTitle(assignment.course_id) || "Actividad" }} · {{ formatDate(assignment.starts_at) }}</small>
            </span>
            <RouterLink
              :to="assignment.course_id ? `/student/courses/${assignment.course_id}` : '/student/calendar'"
              class="today-focus-action"
              :class="index === 0 ? 'today-focus-action--solid' : 'today-focus-action--quiet'"
            >
              {{ index === 0 ? "Ver entrega" : "Abrir" }} <i class="pi pi-arrow-right"></i>
            </RouterLink>
          </article>
        </div>
      </section>

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
                <span
                  v-if="pendingByCourse.get(course.id)"
                  class="course-status course-status--pending"
                >
                  {{ pendingByCourse.get(course.id) }}
                  {{ pendingByCourse.get(course.id) === 1 ? "pendiente" : "pendientes" }}
                </span>
                <span v-else class="course-status" :class="`course-status--${course.status}`">
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
              <div v-if="progressByCourse.get(course.id)?.progress_percent != null" class="course-progress">
                <span>Avance</span><b>{{ progressByCourse.get(course.id)?.progress_percent }}%</b>
                <i><em :style="{ width: `${progressByCourse.get(course.id)?.progress_percent}%` }"></em></i>
              </div>
              <span class="course-open" :class="{ 'course-open--due': pendingByCourse.get(course.id) }">
                {{ nextDueLabel(course.id) }} <i class="pi pi-arrow-right"></i>
              </span>
            </RouterLink>
          </div>
        </component>
      </div>

      <div class="dashboard-sections">
        <section class="dashboard-section">
          <div class="section-heading">
            <div>
              <h2>Esta semana</h2>
              <p>Lo que viene después de hoy.</p>
            </div>
            <RouterLink to="/student/calendar" class="section-link">Calendario</RouterLink>
          </div>
          <StateMessage v-if="calendarLoading" variant="loading" dense :rows="2" loading-label="Cargando entregas" />
          <p v-else-if="!weekAssignments.length" class="section-state">No tenés entregas esta semana.</p>
          <div v-else class="assignment-list">
            <RouterLink
              v-for="assignment in weekAssignments"
              :key="assignment.id"
              :to="assignment.course_id ? `/student/courses/${assignment.course_id}` : '/student/calendar'"
              class="assignment-item"
              :class="{ 'assignment-item--urgent': isUrgent(assignment.starts_at) }"
            >
              <span class="assignment-date" aria-hidden="true">
                <b>{{ dayNumber(assignment.starts_at) }}</b>
                <i>{{ monthLabel(assignment.starts_at) }}</i>
              </span>
              <span class="assignment-content">
                <strong>{{ assignment.title }}</strong>
                <small>{{ courseTitle(assignment.course_id) || "Actividad" }} · {{ formatDate(assignment.starts_at) }}</small>
              </span>
              <i class="pi pi-angle-right assignment-chevron" aria-hidden="true"></i>
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
              :class="{ 'message-item--unread': conversation.unread }"
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

  .dashboard-head { display:flex;align-items:flex-end;justify-content:space-between;gap:var(--space-4);padding:var(--space-2) 0 var(--space-5);margin-bottom:var(--space-3); }

  .dashboard-head h1 {
    margin:var(--space-1) 0;
    font-family: var(--font-ui-family);
    font-size: clamp(28px,4vw,34px);
    font-weight: 900;
    letter-spacing: -.035em;
    color: var(--text-heading);
  }
  .dashboard-head p{margin:0;color:var(--text-secondary);font-size:var(--text-sm)}.eyebrow{color:var(--practiq-violet-dark);font-family:var(--font-ui-family);font-size:var(--text-xs);font-weight:900;text-transform:uppercase;letter-spacing:.09em}.head-action{display:inline-flex;align-items:center;gap:var(--space-2);min-height:44px;padding:0 var(--space-4);border:1px solid var(--surface-border);border-radius:11px;background:var(--surface-card);color:var(--practiq-violet-dark);font-family:var(--font-ui-family);font-size:var(--text-sm);font-weight:900}.head-action:hover{background:var(--practiq-violet-pale);border-color:var(--practiq-violet-200)}
  .today-focus{margin-bottom:var(--space-5);padding:var(--space-5);border:1px solid var(--practiq-violet-200);border-radius:14px;background:var(--practiq-violet-pale)}.today-focus-head{display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);margin-bottom:var(--space-3)}.today-focus-head h2{margin:0;color:var(--practiq-violet-dark);font-family:var(--font-ui-family);font-size:var(--text-sm);font-weight:900;letter-spacing:.09em;text-transform:uppercase}.today-focus-head span{color:var(--text-secondary);font-size:var(--text-xs);font-weight:600}.today-focus-list{display:grid;gap:var(--space-3)}.today-focus-item{display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-4);padding:var(--space-4);border:1px solid var(--surface-border);border-radius:12px;background:var(--surface-card);color:inherit}.today-focus-item--lead{box-shadow:0 8px 20px rgba(57,49,104,.07)}.today-focus-icon{display:grid;place-items:center;width:40px;height:40px;flex:0 0 40px;border-radius:12px;background:var(--practiq-violet-pale);color:var(--practiq-violet-dark)}.today-focus-item--lead .today-focus-icon{width:44px;height:44px;flex:0 0 44px;background:var(--color-warning-bg);color:var(--color-warning-dark)}.today-focus-copy{display:grid;gap:3px;min-width:190px;flex:1}.today-focus-copy strong{overflow:hidden;color:var(--text-heading);font-family:var(--font-ui-family);font-size:var(--text-md);font-weight:900;letter-spacing:-.02em;text-overflow:ellipsis;white-space:nowrap}.today-focus-item--lead .today-focus-copy strong{font-size:var(--text-lg)}.today-focus-copy small{overflow:hidden;color:var(--text-secondary);font-size:var(--text-xs);text-overflow:ellipsis;white-space:nowrap}.today-focus-action{display:inline-flex;align-items:center;gap:var(--space-2);min-height:44px;padding:0 var(--space-5);border-radius:11px;font-family:var(--font-ui-family);font-size:var(--text-sm);font-weight:900;white-space:nowrap;transition:var(--transition-fast)}.today-focus-action--solid{background:var(--practiq-violet);color:var(--color-on-primary)}.today-focus-action--solid:hover{background:var(--practiq-violet-600);transform:translateY(-2px)}.today-focus-action--quiet{border:1px solid var(--practiq-violet-200);background:var(--surface-card);color:var(--practiq-violet-dark)}.today-focus-action--quiet:hover{background:var(--practiq-violet-pale)}

  .courses-heading{display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);margin-bottom:var(--space-3)}.courses-heading h2{margin:0;color:var(--text-heading);font-size:var(--text-lg)}.courses-heading p{margin:var(--space-1) 0 0;color:var(--text-secondary);font-size:var(--text-xs)}.courses-tools{display:flex;align-items:center;gap:var(--space-3)}.text-action{display:inline-flex;align-items:center;gap:var(--space-1);color:var(--practiq-violet-dark);font-size:var(--text-xs);font-weight:800}.view-controls{display:flex;align-items:center;gap:2px;padding:3px;border:1px solid var(--surface-border);border-radius:var(--radius-sm);background:var(--surface-card)}.view-controls button{display:inline-flex;align-items:center;justify-content:center;gap:var(--space-1);height:28px;min-width:28px;padding:0 var(--space-2);border:0;border-radius:calc(var(--radius-sm) - 2px);background:transparent;color:var(--text-muted);font-size:var(--text-xs);font-weight:800;cursor:pointer}.view-controls button:hover{background:var(--surface-hover);color:var(--text-primary)}.view-controls button.active{background:var(--fill-primary-soft);color:var(--practiq-violet-dark)}.view-controls span{width:1px;height:16px;margin:0 2px;background:var(--surface-border)}.view-controls em{font-style:normal}

  .empty-action{display:inline-flex;align-items:center;gap:var(--space-1);min-height:40px;padding:var(--space-2) var(--space-4);border-radius:var(--radius-md);background:var(--gradient-brand);color:var(--color-on-primary);font-size:var(--text-sm);font-weight:800;box-shadow:var(--shadow-violet)}

  .course-group + .course-group { margin-top: var(--space-6); }
  .course-group-head { display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-2);padding:0 var(--space-1);color:var(--text-secondary);font-size:var(--text-sm);font-weight:800; }
  .course-group-head span{display:inline-flex;align-items:center;gap:var(--space-1)}.course-group-head small{display:grid;min-width:21px;height:21px;place-items:center;border-radius:var(--radius-pill);background:var(--surface-hover);color:var(--text-secondary);font-size:var(--text-xs)}

  .course-grid {
    display: grid;
    /* 240px only ever fit three columns on a desktop width, leaving the row
       half empty while each card grew to hold it. */
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: var(--space-3);
  }

  .course-card {
    /* A column, so the "Abrir curso" line sits at the bottom of every card
       and a row of cards ends level regardless of description length. */
    display: flex;
    flex-direction: column;
    padding: var(--space-3);
    border:1px solid var(--surface-border);
    border-radius: var(--radius-md);
    background: var(--surface-card);
    box-shadow: var(--shadow-card);
    color: inherit;
    transition: var(--transition-fast);
  }

  .course-list{grid-template-columns:1fr}.course-list .course-card{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:var(--space-3)}.course-list .course-card-top{margin:0}.course-list .course-main{min-width:0}.course-list .course-description{display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:3px 0 0}.course-list .course-labels{margin-top:var(--space-2)}.course-list .course-open{margin:0;white-space:nowrap}

  .course-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }
  .course-icon{display:grid;place-items:center;width:26px;height:26px;flex:0 0 26px;border-radius:var(--radius-sm);background:var(--fill-primary-subtle);color:var(--practiq-violet-dark);font-size:var(--text-xs)}

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

  .course-status--pending {
    background: var(--color-warning-bg);
    color: var(--color-warning-dark);
    text-transform: none;
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

  .assignment-item--urgent .assignment-date{background:var(--color-warning-bg);color:var(--color-warning-dark)}
  .unread-dot{flex-shrink:0;width:8px;height:8px;border-radius:50%;background:var(--color-error)}
  .message-item--unread{background:var(--practiq-violet-50)}
  .message-item--unread:hover{background:var(--practiq-violet-pale)}
  .assignment-chevron{flex-shrink:0;color:var(--text-muted);font-size:var(--text-base)}

  .assignment-date {
    display: grid;
    flex: 0 0 38px;
    width: 38px;
    height: 38px;
    place-content: center;
    justify-items: center;
    border-radius: var(--radius-lg);
    background: var(--practiq-violet-pale);
    color: var(--practiq-violet-dark);
    font-family: var(--font-ui-family);
    font-weight: 900;
    line-height: 1;
  }

  .assignment-date b { font-size: var(--text-md); }
  .assignment-date i { font-size: 9px; font-style: normal; letter-spacing: 0.06em; }

  .message-avatar {
    display: grid;
    flex: 0 0 38px;
    width: 38px;
    height: 38px;
    place-items: center;
    border-radius: var(--radius-lg);
    background: var(--practiq-violet-pale);
    color: var(--practiq-violet-700);
    font-family: var(--font-ui-family);
    font-size: var(--text-md);
    font-weight: 900;
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
  .course-progress{display:grid;grid-template-columns:1fr auto;gap:5px;margin-top:var(--space-3);color:var(--text-secondary);font-size:var(--text-xs);font-weight:600}.course-progress b{color:var(--text-heading)}.course-progress i{grid-column:1/-1;display:block;height:6px;overflow:hidden;border-radius:999px;background:var(--surface-hover)}.course-progress em{display:block;height:100%;border-radius:inherit;background:var(--practiq-violet)}
  .course-labels{display:flex;gap:var(--space-1);flex-wrap:wrap;margin-top:var(--space-3)}.course-labels span{padding:2px 6px;border-radius:999px;background:var(--fill-primary-soft);color:var(--practiq-violet-dark);font-size:10px;font-weight:800}
  .course-main{flex:1;min-width:0}.course-open{display:flex;align-items:center;justify-content:space-between;gap:var(--space-2);margin-top:auto;padding-top:var(--space-3);border-top:1px solid var(--surface-border);color:var(--text-secondary);font-size:var(--text-xs);font-weight:700}.course-open .pi{color:var(--practiq-violet-dark)}.course-open--due{color:var(--color-warning-dark)}

  @media (max-width: 700px) {
    .dashboard-sections { grid-template-columns: 1fr; }
    .dashboard-head{align-items:stretch;flex-direction:column;padding:var(--space-2) 0 var(--space-4)}
    .head-action{justify-content:center}
    .today-focus{padding:var(--space-4)}.today-focus-item{align-items:flex-start}.today-focus-action{width:100%;justify-content:center}
    .courses-heading{align-items:flex-start;flex-direction:column;margin-top:var(--space-5)}
    .courses-tools{width:100%;justify-content:space-between}
    .course-list .course-card{grid-template-columns:auto minmax(0,1fr);row-gap:var(--space-2)}
    .course-list .course-main{grid-column:1/-1;grid-row:2}
    .course-list .course-open{grid-column:1/-1;grid-row:3}
  }
</style>
