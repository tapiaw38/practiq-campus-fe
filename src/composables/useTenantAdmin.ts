import { ref } from "vue";
import { campusApi } from "@/api/request/server";
import { TenantAdminService } from "@/services/tenants/tenantService";
import type { CampusTenantAdmin, EligibleSchool } from "@/services/tenants/tenantService";

const tenantAdminService = new TenantAdminService(campusApi);

export function useTenantAdmin() {
    const tenants = ref<CampusTenantAdmin[]>([]);
    const eligible = ref<EligibleSchool[]>([]);
    const loading = ref(false);

    async function loadTenants() {
        loading.value = true;
        try {
            tenants.value = await tenantAdminService.list();
            return tenants.value;
        } finally {
            loading.value = false;
        }
    }

    async function loadEligibleSchools() {
        try {
            eligible.value = await tenantAdminService.eligibleSchools();
            return eligible.value;
        } catch (error) {
            eligible.value = [];
            throw error;
        }
    }

    async function activate(schoolID: string) {
        const tenant = await tenantAdminService.activate(schoolID);
        tenants.value = [tenant, ...tenants.value];
        return tenant;
    }

    async function setStatus(id: string, status: CampusTenantAdmin["status"]) {
        const patch = await tenantAdminService.setStatus(id, status);
        tenants.value = tenants.value.map((t) => (t.id === id ? { ...t, ...patch } : t));
        return tenants.value.find((t) => t.id === id);
    }

    return { tenants, eligible, loading, loadTenants, loadEligibleSchools, activate, setStatus };
}
