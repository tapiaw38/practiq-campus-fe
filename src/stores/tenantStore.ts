import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { campusApi } from "@/api/request/server";
import { TenantService, type CampusTenant } from "@/services/tenants/tenantService";

export type { CampusTenant } from "@/services/tenants/tenantService";

const KEY = "campus_tenant_id";
const service = new TenantService(campusApi);

export const useTenantStore = defineStore("campus-tenant", () => {
  const tenants = ref<CampusTenant[]>([]);
  const selectedID = ref(localStorage.getItem(KEY) || "");
  const selected = computed(() => tenants.value.find((tenant) => tenant.id === selectedID.value) || null);

  async function load() {
    tenants.value = await service.mine();
    // Do not silently open the first school returned by the API. That made a
    // person with two institutions work in the wrong one without noticing.
    // A sole membership is safe to select; several require an explicit choice.
    if (!selected.value && tenants.value.length === 1) select(tenants.value[0]?.id || "");
  }
  function select(id: string) { selectedID.value = id; id ? localStorage.setItem(KEY, id) : localStorage.removeItem(KEY); }
  function clear() { tenants.value = []; select(""); }
  return { tenants, selected, selectedID, load, select, clear };
});
