<script setup lang="ts">
  import { computed } from "vue";
  import { useRouter } from "vue-router";
  import { useTenantStore } from "@/stores/tenantStore";
  import { useAuthStore } from "@/stores/authStore";
  import { tenantDestination } from "@/utils/tenantDestination";

  const tenants = useTenantStore();
  const auth = useAuthStore();
  const router = useRouter();

  // With one institution there is nothing to choose, and a select holding a
  // single option is just a control that does nothing. The name still shows,
  // because knowing which institution you are in matters even when it cannot
  // change.
  const canSwitch = computed(() => tenants.tenants.length > 1);

  async function change(event: Event) {
    const select = event.target as HTMLSelectElement;
    const id = select.value;
    if (!id || id === tenants.selectedID) return;

    const tenant = tenants.tenants.find((t) => t.id === id);
    if (!tenant) {
      select.value = tenants.selectedID;
      return;
    }

    tenants.select(id);
    // Go to the new institution's own entry point rather than reloading
    // whatever is on screen. Reloading kept the old institution's path — a
    // course id from the school being left, requested under the new school's
    // header — which correctly resolved to nothing and dead-ended on a
    // not-found. The destination also follows the role held *here*: the same
    // person can administer one school and study at the next.
    await router.replace(tenantDestination(tenant, auth.isSuperAdmin));
    // A full reload clears every store still holding the previous
    // institution's data; the URL is now the right one to land on.
    router.go(0);
  }

  function chooseInstitution() {
    router.push("/choose-institution");
  }
</script>

<template>
  <div v-if="tenants.selected" class="tenant-switcher">
    <span class="label">Institución</span>

    <select
      v-if="canSwitch"
      class="picker"
      :value="tenants.selectedID"
      aria-label="Cambiar de institución"
      @change="change"
    >
      <option v-for="tenant in tenants.tenants" :key="tenant.id" :value="tenant.id">
        {{ tenant.name }}
      </option>
    </select>

    <div v-else class="single-row">
      <span class="single" :title="tenants.selected.name">{{ tenants.selected.name }}</span>
      <button type="button" class="change" @click="chooseInstitution">Cambiar</button>
    </div>
  </div>
</template>

<style scoped>
  .tenant-switcher {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
    padding: 0.5rem 0.75rem;
  }

  .label {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .picker {
    max-width: 100%;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    background: var(--surface-card);
    color: var(--text-primary);
    font: inherit;
    font-size: 0.88rem;
  }

  .single {
    overflow: hidden;
    color: var(--text-primary);
    font-size: 0.9rem;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .single-row { display: flex; align-items: center; gap: .4rem; min-width: 0; }
  .change { flex: 0 0 auto; border: 0; background: transparent; color: var(--practiq-violet); cursor: pointer; font: inherit; font-size: .76rem; font-weight: 700; padding: 0; }
</style>
