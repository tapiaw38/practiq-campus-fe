import { campusApi } from "@/api/request/server";
import { TenantService } from "@/services/tenants/tenantService";
import { useTenantStore } from "@/stores/tenantStore";

export type { CampusTenant } from "@/services/tenants/tenantService";

const tenantService = new TenantService(campusApi);
const store = useTenantStore(tenantService);

export function useTenant() {
    return store();
}
