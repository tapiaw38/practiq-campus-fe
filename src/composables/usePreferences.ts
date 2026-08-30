import { useToast } from "primevue/usetoast";
import { campusApi } from "@/api/request/server";
import { PreferenceService } from "@/services/preferences/preferenceService";

export function usePreferences() {
  const toast = useToast();
  const service = new PreferenceService(campusApi);

  async function loadPreference<T extends Record<string, unknown>>(scope: string) {
    try { return await service.get<T>(scope); }
    catch (error) { toast.add({ severity: "error", summary: "Error", detail: "No se pudieron cargar tus preferencias", life: 3000 }); throw error; }
  }

  async function savePreference<T extends Record<string, unknown>>(scope: string, settings: T) {
    try { return await service.update(scope, settings); }
    catch (error) { toast.add({ severity: "error", summary: "Error", detail: "No se pudieron guardar tus preferencias", life: 3000 }); throw error; }
  }

  return { loadPreference, savePreference };
}
