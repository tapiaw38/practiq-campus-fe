import { ref } from "vue";
import { useToast } from "primevue/usetoast";
import { campusApi } from "@/api/request/server";
import { AssignmentService } from "@/services/assignments/assignmentService";
import type { CreateAssignmentParams } from "@/services/assignments/assignmentService";
import type { Assignment } from "@/types";

const assignmentService = new AssignmentService(campusApi);

export function useAssignments() {
  const toast = useToast();
  const assignments = ref<Assignment[]>([]);
  const loading = ref(false);

  async function loadAssignments(courseId: string) {
    loading.value = true;
    try {
      const { data } = await assignmentService.listByCourse(courseId);
      assignments.value = data;
      return data;
    } finally {
      loading.value = false;
    }
  }

  async function createAssignment(courseId: string, params: CreateAssignmentParams) {
    try {
      const { data } = await assignmentService.create(courseId, params);
      assignments.value = [...assignments.value, data];
      toast.add({ severity: "success", summary: "Tarea creada", life: 2000 });
      return data;
    } catch (error) {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "No se pudo crear la tarea",
        life: 3000,
      });
      throw error;
    }
  }

  async function updateAssignment(courseId: string, id: string, params: CreateAssignmentParams) {
    try {
      const { data } = await assignmentService.update(courseId, id, params);
      assignments.value = assignments.value.map((assignment) => assignment.id === id ? data : assignment);
      toast.add({ severity: "success", summary: "Tarea actualizada", life: 2000 });
      return data;
    } catch (error) {
      toast.add({ severity: "error", summary: "Error", detail: "No se pudo actualizar la tarea", life: 3000 });
      throw error;
    }
  }

  async function deleteAssignment(courseId: string, id: string) {
    try {
      await assignmentService.remove(courseId, id);
      assignments.value = assignments.value.filter((assignment) => assignment.id !== id);
      toast.add({ severity: "success", summary: "Tarea eliminada", life: 2000 });
    } catch (error) {
      toast.add({ severity: "error", summary: "Error", detail: "No se pudo eliminar la tarea", life: 3000 });
      throw error;
    }
  }

  return { assignments, loading, loadAssignments, createAssignment, updateAssignment, deleteAssignment };
}
