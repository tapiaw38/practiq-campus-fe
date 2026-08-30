import { ref } from "vue";
import { useToast } from "primevue/usetoast";
import { campusApi } from "@/api/request/server";
import { MaterialService, type CreateMaterialParams } from "@/services/materials/materialService";
import type { CourseMaterial } from "@/types";

const materialService = new MaterialService(campusApi);

export function useCourseMaterials() {
  const toast = useToast();
  const materials = ref<CourseMaterial[]>([]);
  const loading = ref(false);

  async function loadMaterials(courseId: string) {
    loading.value = true;
    try { materials.value = await materialService.list(courseId); return materials.value; }
    catch (error) { toast.add({ severity: "error", summary: "Error", detail: "No se pudieron cargar los materiales", life: 3000 }); throw error; }
    finally { loading.value = false; }
  }

  async function createMaterial(courseId: string, params: CreateMaterialParams) {
    try { const material = await materialService.create(courseId, params); materials.value = [material, ...materials.value]; toast.add({ severity: "success", summary: "Material agregado", life: 2000 }); return material; }
    catch (error) { toast.add({ severity: "error", summary: "Error", detail: "No se pudo agregar el material", life: 3000 }); throw error; }
  }

  async function uploadMaterial(file: File) {
    try { return await materialService.upload(file); }
    catch (error) { toast.add({ severity: "error", summary: "Error", detail: "No se pudo subir el archivo", life: 3000 }); throw error; }
  }

  async function deleteMaterial(id: string) {
    try { await materialService.remove(id); materials.value = materials.value.filter((material) => material.id !== id); toast.add({ severity: "success", summary: "Material eliminado", life: 2000 }); }
    catch (error) { toast.add({ severity: "error", summary: "Error", detail: "No se pudo eliminar el material", life: 3000 }); throw error; }
  }

  return { materials, loading, loadMaterials, createMaterial, uploadMaterial, deleteMaterial };
}
