import { ref } from "vue";
import { useToast } from "primevue/usetoast";
import { campusApi } from "@/api/request/server";
import { CourseGroupService } from "@/services/courseGroups/courseGroupService";

const service = new CourseGroupService(campusApi);

export function useCourseGroups() {
  const toast = useToast();
  const groups = ref<import("@/types/courseGroup").CourseGroup[]>([]);
  const loading = ref(false);

  async function load(courseId: string) {
    loading.value = true;
    try {
      groups.value = await service.listByCourse(courseId);
      return groups.value;
    } finally {
      loading.value = false;
    }
  }

  async function createGroup(courseId: string, name: string) {
    try {
      const created = await service.create(courseId, name);
      groups.value = [...groups.value, created];
      toast.add({ severity: "success", summary: "Grupo creado", life: 2000 });
      return created;
    } catch (error) {
      toast.add({ severity: "error", summary: "Error", detail: "No se pudo crear el grupo", life: 3000 });
      throw error;
    }
  }

  async function deleteGroup(id: string) {
    try {
      await service.remove(id);
      groups.value = groups.value.filter((g) => g.id !== id);
      toast.add({ severity: "success", summary: "Grupo eliminado", life: 2000 });
    } catch (error) {
      toast.add({ severity: "error", summary: "Error", detail: "No se pudo eliminar el grupo", life: 3000 });
      throw error;
    }
  }

  async function addMember(groupId: string, userId: string) {
    await service.addMember(groupId, userId);
    groups.value = groups.value.map((g) => g.id === groupId ? { ...g, member_ids: [...g.member_ids, userId] } : g);
  }

  async function removeMember(groupId: string, userId: string) {
    await service.removeMember(groupId, userId);
    groups.value = groups.value.map((g) => g.id === groupId ? { ...g, member_ids: g.member_ids.filter((id) => id !== userId) } : g);
  }

  return { groups, loading, load, createGroup, deleteGroup, addMember, removeMember };
}
