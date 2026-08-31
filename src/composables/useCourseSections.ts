import { ref } from "vue";
import { useToast } from "primevue/usetoast";
import { campusApi } from "@/api/request/server";
import { SectionService } from "@/services/sections/sectionService";
import type { CourseSection } from "@/types";

const sectionService = new SectionService(campusApi);

export function useCourseSections() {
  const toast = useToast();
  const sections = ref<CourseSection[]>([]);
  const loading = ref(false);

  async function loadSections(courseId: string) {
    loading.value = true;
    try {
      const { data } = await sectionService.listByCourse(courseId);
      sections.value = data;
      return data;
    } finally {
      loading.value = false;
    }
  }

  async function createSection(courseId: string, title: string, description = "") {
    try {
      const { data } = await sectionService.create(courseId, title, description);
      sections.value = [...sections.value, data];
      toast.add({ severity: "success", summary: "Sección creada", life: 2000 });
      return data;
    } catch (error) {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "No se pudo crear la sección",
        life: 3000,
      });
      throw error;
    }
  }

  async function updateSection(courseId: string, id: string, title: string, description = "") {
    try {
      const { data } = await sectionService.update(courseId, id, title, description);
      sections.value = sections.value.map((section) => section.id === id ? data : section);
      toast.add({ severity: "success", summary: "Sección actualizada", life: 2000 });
      return data;
    } catch (error) {
      toast.add({ severity: "error", summary: "Error", detail: "No se pudo actualizar la sección", life: 3000 });
      throw error;
    }
  }

  async function deleteSection(courseId: string, id: string) {
    try {
      await sectionService.remove(courseId, id);
      sections.value = sections.value.filter((section) => section.id !== id);
      toast.add({ severity: "success", summary: "Sección eliminada", life: 2000 });
    } catch (error) {
      toast.add({ severity: "error", summary: "Error", detail: "No se pudo eliminar la sección", life: 3000 });
      throw error;
    }
  }

  return { sections, loading, loadSections, createSection, updateSection, deleteSection };
}
