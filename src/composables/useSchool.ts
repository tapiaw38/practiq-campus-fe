import { ref } from "vue";
import { campusApi } from "@/api/request/server";
import { SchoolService } from "@/services/school/schoolService";
import type { SchoolMember } from "@/services/school/schoolService";

const schoolService = new SchoolService(campusApi);

function reason(e: unknown, fallback: string) {
  const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return message ? message : fallback;
}

export function useSchool() {
  const members = ref<SchoolMember[]>([]);
  const loading = ref(false);

  async function loadMembers() {
    loading.value = true;
    try {
      members.value = await schoolService.members();
      return members.value;
    } finally {
      loading.value = false;
    }
  }

  async function addMember(userID: string, role: SchoolMember["role"]) {
    try {
      await schoolService.addMember(userID, role);
      await loadMembers();
    } catch (e) {
      throw new Error(reason(e, "No se pudo agregar. Verificá que esta persona ya tenga perfil en Practiq."));
    }
  }

  async function removeMember(userID: string) {
    try {
      await schoolService.removeMember(userID);
      await loadMembers();
    } catch (e) {
      throw new Error(reason(e, "No se pudo quitar esta persona."));
    }
  }

  return { members, loading, loadMembers, addMember, removeMember };
}
