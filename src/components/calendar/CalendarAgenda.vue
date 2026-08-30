<script setup lang="ts">
  import StateMessage from "@/components/ui/StateMessage.vue";
  import { computed, onMounted, ref, watch } from "vue";
  import { useCalendar } from "@/composables/useCalendar";
  import { useCourses } from "@/composables/useCourses";
  import { useEnrollments } from "@/composables/useEnrollments";
  import { useAuthStore } from "@/stores/authStore";
  import type { CalendarEvent, CalendarRecurrenceRule } from "@/types";

  const { events, loading, loadEvents, createEvent, updateEvent, deleteEvent } = useCalendar();
  const { courses, loadCourses } = useCourses();
  const { courseEnrollments, loadByCourse } = useEnrollments();
  const authStore = useAuthStore();
  const creating = ref(false);
  const editingEvent = ref<CalendarEvent | null>(null);
  const eventToDelete = ref<CalendarEvent | null>(null);
  const dialogVisible = ref(false);
  const dayDialogVisible = ref(false);
  const selectedDay = ref(new Date());
  const showAllDayEvents = ref(false);
  const viewDate = ref(new Date());
  const form = ref({ title: "", description: "", courseId: "", date: "", time: "09:00", duration: "1", recurrence: "none" as CalendarRecurrenceRule, reminder: "30" });
  const attendeeSearch = ref("");
  const attendeeIds = ref<string[]>([]);
  const selectableAttendees = computed(() => courseEnrollments.value.filter((item) => item.status === "active" && !attendeeIds.value.includes(item.user_id) && (item.user_name || item.user_id).toLocaleLowerCase().includes(attendeeSearch.value.toLocaleLowerCase())));
  const monthLabel = computed(() => viewDate.value.toLocaleDateString("es-AR", { month: "long", year: "numeric" }));
  const days = computed(() => {
    const first = new Date(viewDate.value.getFullYear(), viewDate.value.getMonth(), 1);
    const start = (first.getDay() + 6) % 7;
    const total = new Date(viewDate.value.getFullYear(), viewDate.value.getMonth() + 1, 0).getDate();
    const cells = Array.from({ length: start }, () => null as Date | null);
    for (let day = 1; day <= total; day++) cells.push(new Date(viewDate.value.getFullYear(), viewDate.value.getMonth(), day));
    while (cells.length % 7) cells.push(null);
    return cells;
  });
  const recurrenceOptions = [
    { label: "No se repite", value: "none" }, { label: "Todos los días", value: "daily" },
    { label: "Cada semana", value: "weekly" }, { label: "Cada mes", value: "monthly" },
  ];
  const reminderOptions = [
    { label: "Sin recordatorio", value: "none" }, { label: "5 minutos antes", value: "5" },
    { label: "15 minutos antes", value: "15" }, { label: "30 minutos antes", value: "30" },
    { label: "1 hora antes", value: "60" }, { label: "1 día antes", value: "1440" },
  ];

  function formatDateInput(day: Date) { return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`; }
  function formatTimeInput(day: Date) { return `${String(day.getHours()).padStart(2, "0")}:${String(day.getMinutes()).padStart(2, "0")}`; }
  function occursOn(event: CalendarEvent, day: Date) {
    const start = new Date(event.starts_at);
    const candidate = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const first = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    if (candidate < first) return false;
    if (event.recurrence_rule === "daily") return true;
    if (event.recurrence_rule === "weekly") return Math.floor((candidate.getTime() - first.getTime()) / 86400000) % 7 === 0;
    if (event.recurrence_rule === "monthly") return candidate.getDate() === first.getDate();
    return candidate.getTime() === first.getTime();
  }
  function eventsFor(day: Date | null) { return day ? events.value.filter((event) => occursOn(event, day)) : []; }
  function shiftMonth(amount: number) { viewDate.value = new Date(viewDate.value.getFullYear(), viewDate.value.getMonth() + amount, 1); }
  function isToday(day: Date | null) { const now = new Date(); return !!day && day.toDateString() === now.toDateString(); }
  function openEventModal(event?: CalendarEvent, day = new Date()) {
    editingEvent.value = event ?? null;
    const starts = event ? new Date(event.starts_at) : day;
    const duration = event?.ends_at ? Math.max(0.25, (new Date(event.ends_at).getTime() - starts.getTime()) / 3600000) : 1;
    form.value = event ? { title: event.title, description: event.description || "", courseId: event.course_id || "", date: formatDateInput(starts), time: formatTimeInput(starts), duration: String(duration), recurrence: event.recurrence_rule, reminder: event.reminder_minutes == null ? "none" : String(event.reminder_minutes) } : { title: "", description: "", courseId: "", date: formatDateInput(day), time: "09:00", duration: "1", recurrence: "none", reminder: "30" };
    attendeeSearch.value = ""; attendeeIds.value = event?.attendee_ids ?? [];
    dialogVisible.value = true;
  }
  // Picking a day only drives the side agenda. The dialog is reserved for
  // acting on an event (edit/delete), so browsing the month does not bury the
  // calendar behind a modal on every click.
  function selectDay(day: Date) {
    selectedDay.value = day;
    showAllDayEvents.value = false;
  }
  function isSelected(day: Date | null) { return !!day && day.toDateString() === selectedDay.value.toDateString(); }
  function openDayEvents(day: Date) {
    selectedDay.value = day;
    showAllDayEvents.value = false;
    dayDialogVisible.value = true;
  }
  const selectedDayEvents = computed(() => eventsFor(selectedDay.value));
  const visibleDayEvents = computed(() => showAllDayEvents.value ? selectedDayEvents.value : selectedDayEvents.value.slice(0, 5));
  const selectedDayLabel = computed(() => selectedDay.value.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }));
  function eventTime(event: CalendarEvent) { return event.all_day ? "Todo el día" : new Date(event.starts_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }); }
  async function handleCreate() {
    if (!form.value.title.trim() || !form.value.courseId || !form.value.date || creating.value) return;
    const starts = new Date(`${form.value.date}T${form.value.time}`);
    const duration = Math.max(0.25, Number(form.value.duration) || 1);
    const ends = new Date(starts.getTime() + duration * 3600000);
    creating.value = true;
    try {
      const payload = { title: form.value.title.trim(), description: form.value.description.trim(), course_id: form.value.courseId, attendee_ids: attendeeIds.value, starts_at: starts.toISOString(), ends_at: ends.toISOString(), recurrence_rule: form.value.recurrence, reminder_minutes: form.value.reminder === "none" ? null : Number(form.value.reminder) };
      if (editingEvent.value) await updateEvent(editingEvent.value.id, payload); else await createEvent(payload);
      dialogVisible.value = false;
    } catch { /* composable shows toast */ } finally { creating.value = false; }
  }

  watch(() => form.value.courseId, async (courseId) => { attendeeIds.value = []; attendeeSearch.value = ""; if (courseId) await loadByCourse(courseId); });
  function addAttendee(id: string) { attendeeIds.value = [...attendeeIds.value, id]; attendeeSearch.value = ""; }
  function removeAttendee(id: string) { attendeeIds.value = attendeeIds.value.filter((value) => value !== id); }
  function attendeeName(id: string) { return courseEnrollments.value.find((item) => item.user_id === id)?.user_name || id; }
  function canManageEvent(event: CalendarEvent) { return event.source === "manual" && event.owner_id === authStore.authUser?.id; }
  async function confirmDeleteEvent() { if (!eventToDelete.value) return; await deleteEvent(eventToDelete.value.id); eventToDelete.value = null; dayDialogVisible.value = false; }
  onMounted(() => { loadEvents(); if (authStore.isTeacher) loadCourses(); });
</script>

<template>
  <div class="calendar-agenda">
    <div class="page-head"><div><h1>Calendario</h1><p class="hint">Eventos de tus cursos y fechas de entrega.</p></div><Button v-if="authStore.isTeacher" icon="pi pi-plus" label="Agregar evento" @click="openEventModal()" /></div>
    <StateMessage v-if="loading" variant="loading" :rows="3" loading-label="Cargando calendario" />
    <div v-else class="calendar-layout">
      <section class="calendar-card" aria-label="Calendario mensual">
        <div class="calendar-toolbar"><Button icon="pi pi-chevron-left" text rounded aria-label="Mes anterior" @click="shiftMonth(-1)" /><h2>{{ monthLabel }}</h2><Button icon="pi pi-chevron-right" text rounded aria-label="Mes siguiente" @click="shiftMonth(1)" /></div>
        <div class="weekday-row"><span v-for="label in ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']" :key="label">{{ label }}</span></div>
        <div class="month-grid">
          <div v-for="(day, index) in days" :key="index" class="day-cell" :class="{ 'day-cell--muted': !day, 'day-cell--today': isToday(day), 'day-cell--selected': isSelected(day) }">
            <template v-if="day"><button class="day-number" type="button" :aria-label="`Ver eventos del ${day.toLocaleDateString('es-AR')}`" @click="selectDay(day)">{{ day.getDate() }}</button><button v-for="event in eventsFor(day).slice(0, 3)" :key="`${event.id}-${formatDateInput(day)}`" type="button" class="day-event" :class="`day-event--${event.source}`" :title="[event.title, event.description].filter(Boolean).join(': ')" @click="openDayEvents(day)"><b>{{ eventTime(event) }}</b> {{ event.title }}</button><button v-if="eventsFor(day).length > 3" class="more-events" type="button" @click="openDayEvents(day)">+{{ eventsFor(day).length - 3 }} más</button></template>
          </div>
        </div>
        <p v-if="!events.length" class="calendar-empty">Elegí un día o usá “Agregar evento” para crear tu primer evento.</p>
      </section>

      <section class="day-agenda" aria-label="Eventos del día"><div class="day-agenda-head"><div><span class="agenda-eyebrow">Agenda</span><h2>{{ selectedDayLabel }}</h2></div><Button v-if="selectedDayEvents.length" label="Ver detalle" text size="small" @click="openDayEvents(selectedDay)" /></div><p v-if="!selectedDayEvents.length" class="agenda-empty">No hay eventos para este día.</p><ul v-else class="agenda-list"><li v-for="event in visibleDayEvents" :key="`${event.id}-${formatDateInput(selectedDay)}`"><span class="agenda-dot" :class="`agenda-dot--${event.source}`"></span><div><strong>{{ event.title }}</strong><small>{{ eventTime(event) }}<template v-if="event.description"> · {{ event.description }}</template></small></div></li></ul><button v-if="selectedDayEvents.length > 5" class="show-more-events" type="button" @click="showAllDayEvents = !showAllDayEvents">{{ showAllDayEvents ? "Ver menos" : `Ver ${selectedDayEvents.length - 5} más` }}</button></section>
    </div>

    <Dialog v-model:visible="dialogVisible" modal :header="editingEvent ? 'Editar evento' : 'Nuevo evento'" :style="{ width: 'min(560px, calc(100vw - 32px))' }">
      <form class="event-form" @submit.prevent="handleCreate">
        <label>Título<InputText v-model="form.title" autofocus placeholder="Ej.: Reunión con familias" /></label>
        <label>Descripción <Textarea v-model="form.description" rows="3" placeholder="Detalles opcionales" /></label>
        <label>Curso<Select v-model="form.courseId" :options="courses" option-label="title" option-value="id" placeholder="Elegí el curso" required /></label>
        <div class="form-grid"><label>Fecha<InputText v-model="form.date" type="date" required /></label><label>Hora<InputText v-model="form.time" type="time" required /></label></div>
        <label>Duración<Select v-model="form.duration" :options="[{ label: '30 minutos', value: '0.5' }, { label: '1 hora', value: '1' }, { label: '1 h 30 min', value: '1.5' }, { label: '2 horas', value: '2' }, { label: '3 horas', value: '3' }]" option-label="label" option-value="value" /></label>
        <div class="form-grid"><label>Repetición<Select v-model="form.recurrence" :options="recurrenceOptions" option-label="label" option-value="value" /></label><label>Recordatorio<Select v-model="form.reminder" :options="reminderOptions" option-label="label" option-value="value" /></label></div>
        <div v-if="form.courseId" class="attendees-field"><span>Invitados del curso</span><InputText v-model="attendeeSearch" placeholder="Buscar alumno por nombre…" /><div v-if="attendeeSearch && selectableAttendees.length" class="attendee-results"><button v-for="attendee in selectableAttendees" :key="attendee.user_id" type="button" @click="addAttendee(attendee.user_id)"><i class="pi pi-user-plus" /> {{ attendee.user_name || attendee.user_id }}</button></div><div v-if="attendeeIds.length" class="attendee-chips"><span v-for="id in attendeeIds" :key="id">{{ attendeeName(id) }} <button type="button" aria-label="Quitar invitado" @click="removeAttendee(id)"><i class="pi pi-times" /></button></span></div><small>Solo personas matriculadas en este curso. Si no agregás invitados, evento queda solo para vos.</small></div>
        <p class="reminder-note"><i class="pi pi-bell"></i> Recordatorio dentro de Practiq Campus mientras tengas la sesión abierta.</p>
        <div class="dialog-actions"><Button type="button" label="Cancelar" severity="secondary" text @click="dialogVisible = false" /><Button type="submit" :label="editingEvent ? 'Guardar cambios' : 'Guardar evento'" :loading="creating" /></div>
      </form>
    </Dialog>
    <Dialog v-model:visible="dayDialogVisible" modal :header="`Eventos · ${selectedDayLabel}`" :style="{ width: 'min(560px, calc(100vw - 32px))' }"><p v-if="!selectedDayEvents.length" class="agenda-empty">No hay eventos programados.</p><ul v-else class="modal-event-list"><li v-for="event in selectedDayEvents" :key="`${event.id}-${formatDateInput(selectedDay)}`"><span class="agenda-dot" :class="`agenda-dot--${event.source}`"></span><div><strong>{{ event.title }}</strong><small>{{ eventTime(event) }}<template v-if="event.ends_at"> · hasta {{ new Date(event.ends_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) }}</template></small><p v-if="event.description">{{ event.description }}</p></div><div v-if="canManageEvent(event)" class="event-actions"><Button type="button" icon="pi pi-pencil" text rounded size="small" aria-label="Editar evento" @click="dayDialogVisible = false; openEventModal(event)" /><Button type="button" icon="pi pi-trash" severity="danger" text rounded size="small" aria-label="Eliminar evento" @click="eventToDelete = event" /></div></li></ul></Dialog>
    <Dialog :visible="!!eventToDelete" modal header="Eliminar evento" :style="{ width: 'min(420px, calc(100vw - 32px))' }" @update:visible="(visible) => { if (!visible) eventToDelete = null; }"><p>Vas a eliminar <strong>{{ eventToDelete?.title }}</strong>.</p><small>También deja de aparecer para invitados. Esta acción no se puede deshacer.</small><div class="dialog-actions"><Button label="Cancelar" severity="secondary" text @click="eventToDelete = null" /><Button label="Eliminar evento" severity="danger" @click="confirmDeleteEvent" /></div></Dialog>
  </div>
</template>

<style scoped>
  .calendar-agenda { max-width: 1100px; }
  /* Month grid leads and takes the width it needs; the day agenda rides
     alongside as a sticky column so picking a day never scrolls it away. */
  .calendar-layout { display:grid; grid-template-columns:minmax(0,1fr) 300px; gap:var(--space-4); align-items:start; }
  .calendar-layout .day-agenda { position:sticky; top:var(--space-4); margin-bottom:0; }
  .page-head { display:flex; justify-content:space-between; align-items:flex-start; gap:var(--space-4); margin-bottom:var(--space-5); }
  h1 { margin:0 0 var(--space-1); font-size:clamp(22px,4vw,30px); color:var(--text-heading); } .hint { margin:0; color:var(--text-secondary); font-size:var(--text-sm); }
  .calendar-card,.state-message { background:var(--surface-card); border:1px solid var(--surface-border); border-radius:var(--radius-md); overflow:hidden; }
  .calendar-toolbar { display:flex; align-items:center; justify-content:space-between; padding:var(--space-3) var(--space-4); border-bottom:1px solid var(--surface-border); } .calendar-toolbar h2 { margin:0; text-transform:capitalize; font-size:var(--text-lg); color:var(--text-heading); }
  .weekday-row,.month-grid { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); }.weekday-row { padding:var(--space-2) var(--space-3); background:var(--surface-hover); color:var(--text-muted); font-size:var(--text-xs); font-weight:700; text-align:right; }
  .day-agenda{margin-bottom:var(--space-5);padding:var(--space-4);border:1px solid var(--surface-border);border-radius:var(--radius-md);background:var(--surface-card)}.day-agenda-head{display:flex;justify-content:space-between;align-items:center}.agenda-eyebrow{color:var(--text-muted);font-size:var(--text-xs);font-weight:700;text-transform:uppercase;letter-spacing:.05em}.day-agenda h2{margin:2px 0 0;font-size:var(--text-lg);text-transform:capitalize;color:var(--text-heading)}.agenda-empty{margin:var(--space-3) 0 0;color:var(--text-muted);font-size:var(--text-sm)}.agenda-list,.modal-event-list{display:grid;gap:var(--space-2);padding:0;margin:var(--space-3) 0 0;list-style:none}.agenda-list li,.modal-event-list li{display:flex;gap:var(--space-2);align-items:flex-start}.agenda-list strong,.modal-event-list strong{display:block;color:var(--text-primary);font-size:var(--text-sm)}.agenda-list small,.modal-event-list small{display:block;color:var(--text-muted);font-size:var(--text-xs)}.modal-event-list p{margin:var(--space-1) 0 0;color:var(--text-secondary);font-size:var(--text-sm)}.event-actions{display:flex;margin-left:auto}.agenda-dot{width:8px;height:8px;flex:none;margin-top:5px;border-radius:50%;background:var(--practiq-violet)}.agenda-dot--assignment_due{background:var(--color-warning)}.show-more-events{margin-top:var(--space-3);padding:0;border:0;background:transparent;color:var(--practiq-violet-dark);font-size:var(--text-xs);font-weight:700;cursor:pointer}
  .day-cell { min-height:110px; padding:var(--space-2);border-top:1px solid var(--surface-border); border-right:1px solid var(--surface-border); overflow:hidden; }.day-cell:nth-child(7n){border-right:0}.day-cell--muted{background:var(--surface-ground)}.day-cell--selected{background:var(--fill-primary-subtle)}
  .day-number { display:grid;place-items:center;margin-left:auto;width:25px;height:25px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--text-secondary);font-size:var(--text-xs);font-weight:700;cursor:pointer}.day-number:hover{background:var(--surface-hover)}.day-cell--today .day-number{background:var(--practiq-violet); color:white}
  .day-event { display:block;width:100%;padding:3px 5px;border:0;border-radius:4px;background:var(--fill-primary-soft);color:var(--text-primary);font-size:11px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}.day-event:hover{filter:brightness(.96)}.day-event b{font-size:10px}.day-event--assignment_due{background:var(--color-warning-bg);color:var(--color-warning-dark)}.more-events{padding:0;border:0;background:transparent;color:var(--text-muted);font-size:10px;font-weight:700;cursor:pointer}
  .calendar-empty,.state-message{padding:var(--space-5); margin:0; color:var(--text-secondary);font-size:var(--text-sm)}
  .event-form{display:flex;flex-direction:column;gap:var(--space-3)}.event-form label,.attendees-field{display:flex;flex-direction:column;gap:var(--space-1);font-size:var(--text-sm);font-weight:700;color:var(--text-secondary)}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--space-3)}.reminder-note,.attendees-field small{margin:0;color:var(--text-muted);font-size:var(--text-xs);font-weight:400}.dialog-actions{display:flex;justify-content:flex-end;gap:var(--space-2);padding-top:var(--space-2)}.attendee-results{border:1px solid var(--surface-border);border-radius:var(--radius-sm);overflow:hidden}.attendee-results button{display:block;width:100%;padding:var(--space-2);border:0;border-bottom:1px solid var(--surface-border);background:var(--surface-card);text-align:left;color:var(--text-primary);cursor:pointer}.attendee-results button:hover{background:var(--surface-hover)}.attendee-chips{display:flex;gap:var(--space-1);flex-wrap:wrap}.attendee-chips span{display:inline-flex;gap:var(--space-1);align-items:center;padding:3px 7px;border-radius:999px;background:var(--fill-primary-soft);color:var(--practiq-violet-dark);font-size:var(--text-xs)}.attendee-chips button{border:0;background:transparent;color:inherit;cursor:pointer;padding:0}
  @media(max-width:900px){.calendar-layout{grid-template-columns:1fr}.calendar-layout .day-agenda{position:static}}
  @media(max-width:600px){.page-head{align-items:stretch;flex-direction:column}.page-head .p-button{width:100%}.day-cell{min-height:78px;padding:4px}.day-event{font-size:0;padding:3px}.day-event b{font-size:10px}.form-grid{grid-template-columns:1fr}.weekday-row{padding:var(--space-2) 4px;font-size:10px}}
</style>
