import { ref } from "vue";
import { useToast } from "primevue/usetoast";
import { campusApi } from "@/api/request/server";
import { ProfileService } from "@/services/profile/profileService";
import type { Profile, CreateOrSyncUserParams } from "@/types";
import type { UsersPage } from "@/services/profile/profileService";

const profileService = new ProfileService(campusApi);

export function useUsers() {
  const toast = useToast();
  const users = ref<Profile[]>([]);
  const loading = ref(false);
  const pageMeta = ref<UsersPage>({ page: 1, per_page: 20, total: 0, total_pages: 0 });

  async function loadUsers(params?: { search?: string; page?: number }) {
    loading.value = true;
    try {
      const result = await profileService.listUsers(params);
      users.value = result.data;
      pageMeta.value = result.meta;
      return result;
    } catch {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "No se pudo cargar la lista de usuarios",
        life: 3000,
      });
      throw new Error("failed to load users");
    } finally {
      loading.value = false;
    }
  }

  async function setBlocked(id: string, blocked: boolean) {
    try {
      const { data } = await profileService.setBlocked(id, blocked);
      users.value = users.value.map((user) => user.id === id ? data : user);
      toast.add({ severity: "success", summary: blocked ? "Usuario bloqueado" : "Usuario desbloqueado", life: 2500 });
      return data;
    } catch (error) { toast.add({ severity: "error", summary: "Error", detail: "No se pudo cambiar el estado del usuario", life: 3000 }); throw error; }
  }

  // Returns { needsDetails: true } when the email has no shared account yet
  // and the caller should collect first_name/last_name/password and call
  // this again with them included — everything else (email already synced,
  // or found on auth-api-be/practiq already) resolves in one call.
  async function createOrSyncUser(
    params: CreateOrSyncUserParams,
  ): Promise<{ needsDetails: true } | { needsDetails: false; data: Profile }> {
    try {
      const { data } = await profileService.createOrSyncUser(params);
      users.value = [data, ...users.value.filter((u) => u.id !== data.id)];
      toast.add({ severity: "success", summary: "Usuario listo", life: 2500 });
      return { needsDetails: false, data };
    } catch (error) {
      const code = (error as { response?: { data?: { code?: string } } })?.response?.data
        ?.code;
      if (code === "profile:missing-fields") {
        return { needsDetails: true };
      }
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "No se pudo crear ni sincronizar el usuario";
      toast.add({ severity: "error", summary: "Error", detail: message, life: 3500 });
      throw error;
    }
  }

  return { users, loading, pageMeta, loadUsers, createOrSyncUser, setBlocked };
}
