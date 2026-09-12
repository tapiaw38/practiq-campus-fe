import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { campusApi } from "@/api/request/server";
import { TenantService, type CampusTenant } from "@/services/tenants/tenantService";

const KEY = "campus_tenant_id";
const service = new TenantService(campusApi);

export const useTenantStore = defineStore("campus-tenant", () => {
  const tenants = ref<CampusTenant[]>([]);
  const selectedID = ref(localStorage.getItem(KEY) || "");
  const selected = computed(() => tenants.value.find((tenant) => tenant.id === selectedID.value) || null);

  async function load() {
    tenants.value = await service.mine();
    if (!selected.value) select(tenants.value[0]?.id || "");
  }
  function select(id: string) { selectedID.value = id; id ? localStorage.setItem(KEY, id) : localStorage.removeItem(KEY); }
  function clear() { tenants.value = []; select(""); }
  return { tenants, selected, selectedID, load, select, clear };
});
