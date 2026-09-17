import { computed } from "vue";
import { useAuthStore } from "@/stores/authStore";
import { useTenantStore } from "@/stores/tenantStore";

/**
 * The role the user holds *in the institution they are currently in*.
 *
 * Screens were reading `profile.profile_type`, which is one global label per
 * account. The same person can teach at one school and study at another, so
 * that label is wrong for at least one of them: it drew a teacher's grade book
 * for someone who is a student here, and then called teacher-only endpoints
 * that answered 403.
 *
 * Admin resolves to "teacher" because the product has two surfaces, not
 * three — the same rule the router already applies when it decides which
 * dashboard a person belongs on.
 */
export function useCampusRole() {
  const auth = useAuthStore();
  const tenants = useTenantStore();

  const role = computed<"teacher" | "student">(() => {
    const here = tenants.selected?.role;
    if (here) return here === "admin" || here === "teacher" ? "teacher" : "student";
    // No institution resolved yet — a superadmin browsing, or a cold load.
    // Falling back to the account-wide type is the old behaviour, kept only
    // for that gap rather than as the normal answer.
    if (auth.isSuperAdmin) return "teacher";
    return auth.profile?.profile_type === "teacher" ? "teacher" : "student";
  });

  const isTeacher = computed(() => role.value === "teacher");

  return { role, isTeacher };
}
