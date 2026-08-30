import { storeToRefs } from "pinia";
import { useToast } from "primevue/usetoast";
import { campusApi } from "@/api/request/server";
import { EnrollmentService } from "@/services/enrollments/enrollmentService";
import { useEnrollmentStore } from "@/stores/enrollmentStore";
import type { EnrollmentRole } from "@/types";

export function useEnrollments() {
  const toast = useToast();
  const service = new EnrollmentService(campusApi);
  const store = useEnrollmentStore(service)();
  const { myEnrollments, courseEnrollments, loading } = storeToRefs(store);

  async function loadMine() {
    try {
      return await store.fetchMine();
    } catch (error) {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "No se pudieron cargar tus cursos",
        life: 3000,
      });
      throw error;
    }
  }

  async function loadByCourse(courseId: string) {
    try {
      return await store.fetchByCourse(courseId);
    } catch (error) {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "No se pudo cargar la lista de alumnos",
        life: 3000,
      });
      throw error;
    }
  }

  async function enroll(courseId: string, email: string, role?: EnrollmentRole) {
    try {
      const enrollment = await store.enroll(courseId, email, role);
      toast.add({
        severity: "success",
        summary: "Alumno matriculado",
        life: 2500,
      });
      return enrollment;
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ||
        "No se pudo matricular al alumno. Verificá que ya tenga cuenta en Campus.";
      toast.add({ severity: "error", summary: "Error", detail: message, life: 3500 });
      throw error;
    }
  }

  async function unenroll(id: string) {
    try {
      await store.unenroll(id);
      toast.add({ severity: "success", summary: "Alumno dado de baja", life: 2500 });
    } catch (error) {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "No se pudo dar de baja al alumno",
        life: 3000,
      });
      throw error;
    }
  }

  async function enrollSelf(courseId: string) {
    try {
      const enrollment = await store.enrollSelf(courseId);
      toast.add({ severity: "success", summary: "Te matriculaste al curso", life: 2500 });
      return enrollment;
    } catch (error) {
      toast.add({ severity: "error", summary: "Error", detail: "No se pudo realizar la matrícula", life: 3000 });
      throw error;
    }
  }

  return {
    myEnrollments,
    courseEnrollments,
    loading,
    loadMine,
    loadByCourse,
    enroll,
    unenroll,
    enrollSelf,
  };
}
