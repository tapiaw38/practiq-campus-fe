<script setup lang="ts">
  import { computed } from "vue";
  import { useRouter } from "vue-router";
  import { useTenantStore } from "@/stores/tenantStore";

  const tenants = useTenantStore();
  const router = useRouter();

  // With one institution there is nothing to choose, and a select holding a
  // single option is just a control that does nothing. The name still shows,
  // because knowing which institution you are in matters even when it cannot
  // change.
  const canSwitch = computed(() => tenants.tenants.length > 1);

  async function change(event: Event) {
    const id = (event.target as HTMLSelectElement).value;
    if (!id || id === tenants.selectedID) return;

    tenants.select(id);
    // Everything on screen belongs to the institution that was selected a
    // moment ago, so the view is reloaded rather than patched: leaving one
    // institution's courses on screen under another's name is worse than a
    // blink.
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
