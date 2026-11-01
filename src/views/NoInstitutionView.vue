<script setup lang="ts">
  import { computed } from "vue";
  import { useTenant } from "@/composables/useTenant";

  const tenants = useTenant();

  const hasNone = computed(() => tenants.tenants.length === 0);
</script>

<template>
  <main class="no-institution">
    <div class="card">
      <div class="icon" aria-hidden="true">🏛️</div>
      <h1>No perteneces a una institución</h1>
      <p v-if="hasNone">
        Campus es para instituciones. Tu cuenta todavía no está asociada a
        ninguna, o perdiste el acceso a la que tenías.
      </p>
      <p v-else>
        La institución que tenías seleccionada ya no está disponible. Puede
        estar suspendida o haber cerrado.
      </p>
      <p class="hint">
        Si esperabas tener acceso, escribile a quien administra tu institución:
        el alta la hacen ellos.
      </p>
    </div>
  </main>
</template>

<style scoped>
  .no-institution {
    display: grid;
    place-items: center;
    min-height: 100vh;
    padding: 1.5rem;
  }

  .card {
    max-width: 460px;
    padding: 2.5rem 2rem;
    border: 1px solid var(--surface-border);
    border-radius: 16px;
    background: var(--surface-card);
    text-align: center;
  }

  .icon {
    font-size: 2.5rem;
    margin-bottom: 0.75rem;
  }

  h1 {
    margin: 0 0 0.75rem;
    font-size: 1.35rem;
    color: var(--text-heading);
  }

  p {
    margin: 0 0 0.75rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .hint {
    margin-bottom: 0;
    font-size: 0.88rem;
    color: var(--text-muted);
  }
</style>
