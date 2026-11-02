import { computed } from "vue";
import { useAuthStore } from "@/stores/authStore";
import { useTenant } from "@/composables/useTenant";

export function useCampusRole() {
  const auth = useAuthStore();
  const tenants = useTenant();

  const role = computed<"teacher" | "student">(() => {
    const here = tenants.selected?.role;
    if (here) return here === "admin" || here === "teacher" ? "teacher" : "student";
    if (auth.isSuperAdmin) return "teacher";
    return auth.profile?.profile_type === "teacher" ? "teacher" : "student";
  });

  const isTeacher = computed(() => role.value === "teacher");

  return { role, isTeacher };
}
