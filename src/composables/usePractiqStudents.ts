import { ref } from "vue";
import { campusApi } from "@/api/request/server";
import { ProfileService } from "@/services/profile/profileService";
import type { PractiqStudent } from "@/types";

const profileService = new ProfileService(campusApi);

export function usePractiqStudents() {
  const practiqStudents = ref<PractiqStudent[]>([]);
  const loading = ref(false);

  async function loadPractiqStudents() {
    loading.value = true;
    try {
      const { data } = await profileService.listMyPractiqStudents();
      practiqStudents.value = data;
      return data;
    } finally {
      loading.value = false;
    }
  }

  return { practiqStudents, loading, loadPractiqStudents };
}
