import type { CampusTenant } from "@/stores/tenantStore";

export function tenantDestination(tenant: CampusTenant, isSuperAdmin: boolean): string {
  if (isSuperAdmin || tenant.role === "admin") return "/school/dashboard";
  return tenant.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard";
}
