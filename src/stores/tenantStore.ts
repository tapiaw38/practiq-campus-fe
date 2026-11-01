import { computed, ref } from "vue";
import { defineStore } from "pinia";
import type { TenantService, CampusTenant } from "@/services/tenants/tenantService";

export type { CampusTenant } from "@/services/tenants/tenantService";

const KEY = "campus_tenant_id";

export const useTenantStore = (service: TenantService) =>
  defineStore("campus-tenant", () => {
  const tenants = ref<CampusTenant[]>([]);
  const selectedID = ref(localStorage.getItem(KEY) || "");
  const selected = computed(() => tenants.value.find((tenant) => tenant.id === selectedID.value) || null);

  async function load() {
    tenants.value = await service.mine();
    if (!selected.value && tenants.value.length === 1) select(tenants.value[0]?.id || "");
  }
  function select(id: string) { selectedID.value = id; id ? localStorage.setItem(KEY, id) : localStorage.removeItem(KEY); }
  function clear() { tenants.value = []; select(""); }
  return { tenants, selected, selectedID, load, select, clear };
});
