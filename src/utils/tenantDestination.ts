import type { CampusTenant } from "@/stores/tenantStore";

/**
 * Where someone lands when they enter an institution.
 *
 * Shared by the picker and the switcher so both agree. The switcher used to
 * reload the current URL instead, which carried a path from the institution
 * being left — `/teacher/courses/:id` of one school requested under another's
 * header — and the backend rightly answered that no such course exists. The
 * role is read from the membership being entered, since the same person can
 * be an admin in one school and a student in the next.
 */
export function tenantDestination(tenant: CampusTenant, isSuperAdmin: boolean): string {
  if (isSuperAdmin || tenant.role === "admin") return "/school/dashboard";
  return tenant.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard";
}
