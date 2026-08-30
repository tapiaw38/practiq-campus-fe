import { storeToRefs } from "pinia";
import { useToast } from "primevue/usetoast";
import { campusApi } from "@/api/request/server";
import { CourseService } from "@/services/courses/courseService";
import { useCourseStore } from "@/stores/courseStore";
import type { CreateCourseParams, UpdateCourseParams } from "@/services/courses/courseService";

export function useCourses() {
  const toast = useToast();
  const service = new CourseService(campusApi);
  const store = useCourseStore(service)();
  const { courses, currentCourse, loading } = storeToRefs(store);

  async function loadCourses(params?: { publishedOnly?: boolean }) {
    try {
      return await store.fetchCourses(params);
    } catch (error) {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "No se pudieron cargar los cursos",
        life: 3000,
      });
      throw error;
    }
  }

  async function loadCourse(id: string) {
    try {
      return await store.fetchCourse(id);
    } catch (error) {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "No se pudo cargar el curso",
        life: 3000,
      });
      throw error;
    }
  }

  async function createCourse(params: CreateCourseParams) {
    try {
      const course = await store.createCourse(params);
      toast.add({
        severity: "success",
        summary: "Curso creado",
        detail: course.title,
        life: 2500,
      });
      return course;
    } catch (error) {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "No se pudo crear el curso",
        life: 3000,
      });
      throw error;
    }
  }

  async function updateCourse(id: string, params: UpdateCourseParams) {
    try {
      return await store.updateCourse(id, params);
    } catch (error) {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "No se pudo actualizar el curso",
        life: 3000,
      });
      throw error;
    }
  }

  async function syncFromPractiq() {
    try {
      const courses = await store.syncFromPractiq();
      toast.add({
        severity: "success",
        summary: "Cursos sincronizados desde Practiq",
        life: 2500,
      });
      return courses;
    } catch (error) {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "No se pudo sincronizar con Practiq",
        life: 3000,
      });
      throw error;
    }
  }

  async function deleteCourse(id: string) {
    try {
      await store.deleteCourse(id);
      toast.add({ severity: "success", summary: "Curso eliminado", life: 2500 });
    } catch (error) {
      toast.add({ severity: "error", summary: "Error", detail: "No se pudo eliminar el curso", life: 3000 });
      throw error;
    }
  }

  return {
    courses,
    currentCourse,
    loading,
    loadCourses,
    loadCourse,
    createCourse,
    updateCourse,
    deleteCourse,
    syncFromPractiq,
  };
}
