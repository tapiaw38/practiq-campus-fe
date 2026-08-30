import { ref } from "vue";
import { useToast } from "primevue/usetoast";
import { campusApi } from "@/api/request/server";
import { CalendarService } from "@/services/calendar/calendarService";
import type { CreateEventParams } from "@/services/calendar/calendarService";
import type { CalendarEvent } from "@/types";

const calendarService = new CalendarService(campusApi);

export function useCalendar() {
  const toast = useToast();
  const events = ref<CalendarEvent[]>([]);
  const loading = ref(false);

  async function loadEvents() {
    loading.value = true;
    try {
      const { data } = await calendarService.listMine();
      events.value = data;
      return data;
    } finally {
      loading.value = false;
    }
  }

  async function createEvent(params: CreateEventParams) {
    try {
      const { data } = await calendarService.create(params);
      events.value = [...events.value, data].sort((a, b) =>
        a.starts_at.localeCompare(b.starts_at),
      );
      toast.add({ severity: "success", summary: "Evento creado", life: 2000 });
      return data;
    } catch (error) {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "No se pudo crear el evento",
        life: 3000,
      });
      throw error;
    }
  }

  async function updateEvent(id: string, params: CreateEventParams) {
    try {
      const { data } = await calendarService.update(id, params);
      events.value = events.value.map((event) => event.id === id ? data : event).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      toast.add({ severity: "success", summary: "Evento actualizado", life: 2000 });
      return data;
    } catch (error) { toast.add({ severity: "error", summary: "Error", detail: "No se pudo actualizar el evento", life: 3000 }); throw error; }
  }

  async function deleteEvent(id: string) {
    try { await calendarService.remove(id); events.value = events.value.filter((event) => event.id !== id); toast.add({ severity: "success", summary: "Evento eliminado", life: 2000 }); }
    catch (error) { toast.add({ severity: "error", summary: "Error", detail: "No se pudo eliminar el evento", life: 3000 }); throw error; }
  }

  return { events, loading, loadEvents, createEvent, updateEvent, deleteEvent };
}
